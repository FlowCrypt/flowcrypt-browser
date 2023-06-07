#!/usr/bin/env bash

# Define constants for source and output directories
OUTPUT_DIRECTORY="./build/generic-extension-wip"
SOURCE_DIRECTORY="./extension"
BUILD_DIRECTORY="./build"

set -euxo pipefail

# Define a function for repeated rsync operation
synchronize_files() {
  local OUTDIR="$1"

  # Copying files with the given extensions
  find . -type f \( -name '*.js' -o -name '*.htm' -o -name '*.css' -o -name '*.woff2' -o -name '*.png' -o -name '*.svg' -o -name '*.txt' \) \
      -exec rsync -R {} "../$OUTDIR" \;
}

# Function to build TypeScript code
build_typescript_project() {
    # $1 -> use_our_compiler: If true, use custom compiler; if false, use default compiler.
    # $2 -> ts_config: The path to the TypeScript configuration file.
    # $3 -> is_incremental: If true, perform an incremental build.
    # $4 -> ts_build_info: The path to the TypeScript build information file.
    local compiler=$([ "$1" = true ] && echo "node $BUILD_DIRECTORY/tooling/tsc-compiler" || echo "npx tsc")
    local config="--project $2"
    local build_info=$([ "$3" = true ] && echo "--incremental --tsBuildInfoFile $4")
    $compiler $config $build_info & pids+=($!)
}

# remove directories function
delete_directories() {
    rm -rf "$@"
}

# copy node dependencies
copy_dependencies() {
  mkdir -p $OUTPUT_DIRECTORY/lib/ $OUTPUT_DIRECTORY/css/ $OUTPUT_DIRECTORY/lib/bootstrap $OUTPUT_DIRECTORY/lib/streams
  cp node_modules/dompurify/dist/purify.js $OUTPUT_DIRECTORY/lib/purify.js
  cp node_modules/dompurify/dist/purify.js.map $OUTPUT_DIRECTORY/lib/purify.js.map
  cp node_modules/jquery/dist/jquery.min.js $OUTPUT_DIRECTORY/lib/jquery.min.js
  cp node_modules/openpgp/dist/openpgp.js $OUTPUT_DIRECTORY/lib/openpgp.js
  cp node_modules/linkifyjs/dist/linkify.min.js $OUTPUT_DIRECTORY/lib/linkify.min.js
  cp node_modules/linkify-html/dist/linkify-html.min.js $OUTPUT_DIRECTORY/lib/linkify-html.min.js
  cp node_modules/sweetalert2/dist/sweetalert2.js $OUTPUT_DIRECTORY/lib/sweetalert2.js
  cp node_modules/sweetalert2/dist/sweetalert2.css $OUTPUT_DIRECTORY/css/sweetalert2.css
  cp node_modules/iso-8859-2/iso-8859-2.js $OUTPUT_DIRECTORY/lib/iso-8859-2.js
  cp node_modules/zxcvbn/dist/zxcvbn.js $OUTPUT_DIRECTORY/lib/zxcvbn.js
  cp node_modules/squire-rte/build/squire-raw.js $OUTPUT_DIRECTORY/lib/squire-raw.js
  cp node_modules/clipboard/dist/clipboard.js $OUTPUT_DIRECTORY/lib/clipboard.js
  cp node_modules/@flowcrypt/fine-uploader/fine-uploader/fine-uploader.js $OUTPUT_DIRECTORY/lib/fine-uploader.js
  cp node_modules/filesize/dist/filesize.js $OUTPUT_DIRECTORY/lib/filesize.js
  cp node_modules/pdfjs-dist/build/pdf.js $OUTPUT_DIRECTORY/lib/pdf.js
  cp node_modules/pdfjs-dist/build/pdf.worker.js $OUTPUT_DIRECTORY/lib/pdf.worker.js
  cp node_modules/bootstrap/dist/js/bootstrap.min.js $OUTPUT_DIRECTORY/lib/bootstrap/bootstrap.min.js
  cp node_modules/bootstrap/dist/css/bootstrap.min.css $OUTPUT_DIRECTORY/lib/bootstrap/bootstrap.min.css
  cp node_modules/@openpgp/web-stream-tools/lib/*.js $OUTPUT_DIRECTORY/lib/streams
}

# Function to run a regex replace command with sed
apply_regex_replace() {
    local regex=$1
    shift
    local backup_ext=""

    # On macOS, sed requires an extension for in-place editing (-i option)
    [[ "$OSTYPE" == "darwin"* ]] && backup_ext="''"

    for file in "$@"; do
        sed -i$backup_ext -E "$regex" "$file"
    done
}

main() {
  if [[ "$#" == 1 ]] && [[ "$1" == "--assets-only" ]]; then # only build static assets, without re-building TS
    cd "$SOURCE_DIRECTORY" && {
      # Execute the function with different output directories
      synchronize_files "build/chrome-enterprise"
      synchronize_files "build/chrome-consumer"
      synchronize_files "build/firefox-consumer"
    }
    exit 0
  fi

  if [[ "$#" == 1 ]] && [[ "$1" == "--incremental" ]]; then
    delete_directories $BUILD_DIRECTORY/firefox-consumer $BUILD_DIRECTORY/chrome-consumer $BUILD_DIRECTORY/chrome-consumer-mock $BUILD_DIRECTORY/chrome-enterprise $BUILD_DIRECTORY/chrome-enterprise-mock $BUILD_DIRECTORY/generic-extension-wip/js/content_scripts
    # build concurrently - using standard typescript compiler with --incremental flag
    mkdir -p $BUILD_DIRECTORY
    build_typescript_project false "./tsconfig.json" true "$BUILD_DIRECTORY/tsconfig.tsbuildinfo"
    build_typescript_project false "./conf/tsconfig.content_scripts.json" true "$BUILD_DIRECTORY/tsconfig.content_scripts.tsbuildinfo"
    build_typescript_project false "./conf/tsconfig.streams.json" true "$BUILD_DIRECTORY/tsconfig.streams.tsbuildinfo"
    [[ -d ./build/tooling ]] || build_typescript_project false "./conf/tsconfig.tooling.json" false "" # only build tool if missing
  else
    # prebuild tools (and our compiler)
    rm -rf $BUILD_DIRECTORY
    npx tsc --project ./conf/tsconfig.tooling.json
    mkdir -p $OUTPUT_DIRECTORY

    # build concurrently - using our own compiler (which fixes async stack, but doesn't support incremental builds)
    build_typescript_project true "./tsconfig.json" false ""
    build_typescript_project true "./conf/tsconfig.content_scripts.json" false ""
    build_typescript_project true "./conf/tsconfig.streams.json" false ""
  fi

  copy_dependencies

  # patch imports with .js, e.g. replace './streams' with './streams.js'
  # until https://github.com/openpgpjs/web-stream-tools/pull/20 is resolved
  STREAMS_REGEX="s/'\.\/(streams|util|writer|reader|node-conversions)'/'\.\/\1\.js'/g"
  STREAMS_FILES=$OUTPUT_DIRECTORY/lib/streams/*
  # patch isUint8Array until https://github.com/openpgpjs/web-stream-tools/pull/23 is resolved
  ISUINT8ARRAY_REGEX="s/(\s*)return\x20Uint8Array\.prototype\.isPrototypeOf\(input\);/\1return\x20Uint8Array\.prototype\.isPrototypeOf\(input\)\x20\|\|\x20globalThis\.Uint8Array\.prototype\.isPrototypeOf\(input\);/g"
  OPENPGP_FILE=$OUTPUT_DIRECTORY/lib/openpgp.js

  apply_regex_replace $STREAMS_REGEX $STREAMS_FILES
  apply_regex_replace $ISUINT8ARRAY_REGEX $STREAMS_FILES
  apply_regex_replace $ISUINT8ARRAY_REGEX $OPENPGP_FILE

  # bundle web-stream-tools as Stream var for the content script
  ( cd conf && npx webpack ) & pids+=($!)
  for pid in "${pids[@]}"; do wait "$pid" || exit 1; done

  # to update node-forge library, which is missing the non-minified version in dist, we have to build it manually
  # cd ~/git && rm -rf ./forge && git clone https://github.com/digitalbazaar/forge.git && cd ./forge && npm install && npm run-script build
  # cp dist/forge.js ../flowcrypt-browser/extension/lib/forge.js
  # WARN: the steps above are not working as of forge 0.10.0 due to eval/CSP mentioned here: https://github.com/digitalbazaar/forge/issues/814

  # remaining build steps sequentially
  cd "$SOURCE_DIRECTORY" && synchronize_files $OUTPUT_DIRECTORY && cd ..

  cp $SOURCE_DIRECTORY/manifest.json $OUTPUT_DIRECTORY
  cp $SOURCE_DIRECTORY/.web-extension-id $OUTPUT_DIRECTORY

  node ./build/tooling/resolve-modules --project ./tsconfig.json
  node ./build/tooling/fill-values
  node ./build/tooling/bundle-content-scripts
  cp -r $OUTPUT_DIRECTORY ./build/chrome-enterprise
  cp -r $OUTPUT_DIRECTORY ./build/chrome-consumer
  cp -r $OUTPUT_DIRECTORY ./build/firefox-consumer
  node ./build/tooling/build-types-and-manifests
}

main "$@"