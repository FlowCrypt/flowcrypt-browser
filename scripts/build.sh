#!/usr/bin/env bash

OUTDIR=./build/generic-extension-wip
SRCDIR=./extension

set -euxo pipefail
shopt -s globstar

if [[ "$#" == 1 ]] && [[ "$1" == "--assets-only" ]]; then # only build static assets, without re-building TS
    ( cd $SRCDIR && cp -r --parents ./**/*.{js,htm,css,woff2,png,svg,txt} ../build/chrome-enterprise )
    ( cd $SRCDIR && cp -r --parents ./**/*.{js,htm,css,woff2,png,svg,txt} ../build/chrome-consumer )
    ( cd $SRCDIR && cp -r --parents ./**/*.{js,htm,css,woff2,png,svg,txt} ../build/firefox-consumer )
    exit 0
fi

if [[ "$#" == 1 ]] && [[ "$1" == "--incremental" ]]; then

  mkdir -p ./build
  rm -rf ./build/firefox-consumer
  rm -rf ./build/chrome-consumer
  rm -rf ./build/chrome-consumer-mock
  rm -rf ./build/chrome-enterprise
  rm -rf ./build/chrome-enterprise-mock
  rm -rf ./build/generic-extension-wip/js/content_scripts

  # build concurrently - using standard typescript compiler with --incremental flag
  npx tsc --project ./tsconfig.json --incremental --tsBuildInfoFile ./build/tsconfig.tsbuildinfo & pids+=($!)
  npx tsc --project ./conf/tsconfig.content_scripts.json --incremental --tsBuildInfoFile ./build/tsconfig.content_scripts.tsbuildinfo & pids+=($!)
  # we can have unpatched version of web-stream-tools for NodeJS tests
  npx tsc --project ./conf/tsconfig.streams.json --incremental --tsBuildInfoFile ./build/tsconfig.streams.tsbuildinfo & pids+=($!)
  [[ -d ./build/tooling ]] || npx tsc --project ./conf/tsconfig.tooling.json & pids+=($!)  # only build tooling if missing

else

  # prebuild tools (and our compiler)
  rm -rf ./build
  npx tsc --project ./conf/tsconfig.tooling.json
  mkdir -p $OUTDIR

  # build concurrently - using our own compiler (which fixes async stack, but doesn't support incremental builds)
  node ./build/tooling/tsc-compiler --project ./tsconfig.json & pids+=($!)
  node ./build/tooling/tsc-compiler --project ./conf/tsconfig.content_scripts.json & pids+=($!)
  # we can have unpatched version of web-stream-tools for NodeJS tests
  node ./build/tooling/tsc-compiler --project ./conf/tsconfig.streams.json & pids+=($!)

fi

# copy dependencies from npm
mkdir -p $OUTDIR/lib/
mkdir -p $OUTDIR/css/
cp node_modules/dompurify/dist/purify.js $OUTDIR/lib/purify.js
cp node_modules/dompurify/dist/purify.js.map $OUTDIR/lib/purify.js.map
cp node_modules/jquery/dist/jquery.min.js $OUTDIR/lib/jquery.min.js
cp node_modules/openpgp/dist/openpgp.js $OUTDIR/lib/openpgp.js
cp node_modules/linkifyjs/dist/linkify.min.js $OUTDIR/lib/linkify.min.js
cp node_modules/linkify-html/dist/linkify-html.min.js $OUTDIR/lib/linkify-html.min.js
cp node_modules/sweetalert2/dist/sweetalert2.js $OUTDIR/lib/sweetalert2.js
cp node_modules/sweetalert2/dist/sweetalert2.css $OUTDIR/css/sweetalert2.css
cp node_modules/iso-8859-2/iso-8859-2.js $OUTDIR/lib/iso-8859-2.js
cp node_modules/zxcvbn/dist/zxcvbn.js $OUTDIR/lib/zxcvbn.js
cp node_modules/squire-rte/build/squire-raw.js $OUTDIR/lib/squire-raw.js
cp node_modules/clipboard/dist/clipboard.js $OUTDIR/lib/clipboard.js
cp node_modules/@flowcrypt/fine-uploader/fine-uploader/fine-uploader.js $OUTDIR/lib/fine-uploader.js
cp node_modules/filesize/dist/filesize.js $OUTDIR/lib/filesize.js
cp node_modules/pdfjs-dist/build/pdf.js $OUTDIR/lib/pdf.js
cp node_modules/pdfjs-dist/build/pdf.worker.js $OUTDIR/lib/pdf.worker.js
mkdir -p $OUTDIR/lib/bootstrap
cp node_modules/bootstrap/dist/js/bootstrap.min.js $OUTDIR/lib/bootstrap/bootstrap.min.js
cp node_modules/bootstrap/dist/css/bootstrap.min.css $OUTDIR/lib/bootstrap/bootstrap.min.css

mkdir -p $OUTDIR/lib/streams
cp node_modules/@openpgp/web-stream-tools/lib/*.js $OUTDIR/lib/streams
# patch imports with .js, e.g. replace './streams' with './streams.js'
# until https://github.com/openpgpjs/web-stream-tools/pull/20 is resolved
STREAMS_REGEX="s/'\.\/(streams|util|writer|reader|node-conversions)'/'\.\/\1\.js'/g"
STREAMS_FILES=$OUTDIR/lib/streams/*
# patch isUint8Array until https://github.com/openpgpjs/web-stream-tools/pull/23 is resolved
ISUINT8ARRAY_REGEX="s/(\s*)return\x20Uint8Array\.prototype\.isPrototypeOf\(input\);/\1return\x20Uint8Array\.prototype\.isPrototypeOf\(input\)\x20\|\|\x20globalThis\.Uint8Array\.prototype\.isPrototypeOf\(input\);/g"
OPENPGP_FILE=$OUTDIR/lib/openpgp.js
if [[ "$OSTYPE" =~ ^darwin ]]; then # macOS needs additional parameter for backup files
  sed -i '' -E $STREAMS_REGEX $STREAMS_FILES
  sed -i '' -E $ISUINT8ARRAY_REGEX $STREAMS_FILES
  sed -i '' -E $ISUINT8ARRAY_REGEX $OPENPGP_FILE
else
  sed -i -E $STREAMS_REGEX $STREAMS_FILES
  sed -i -E $ISUINT8ARRAY_REGEX $STREAMS_FILES
  sed -i -E $ISUINT8ARRAY_REGEX $OPENPGP_FILE
fi

# bundle web-stream-tools as Stream var for the content script
( cd conf && npx webpack ) & pids+=($!)
for pid in "${pids[@]}"; do wait "$pid" || exit 1; done

# to update node-forge library, which is missing the non-minified version in dist, we have to build it manually
# cd ~/git && rm -rf ./forge && git clone https://github.com/digitalbazaar/forge.git && cd ./forge && npm install && npm run-script build
# cp dist/forge.js ../flowcrypt-browser/extension/lib/forge.js
# WARN: the steps above are not working as of forge 0.10.0 due to eval/CSP mentioned here: https://github.com/digitalbazaar/forge/issues/814

# remaining build steps sequentially
( cd $SRCDIR && cp -r --parents ./**/*.{js,htm,css,woff2,png,svg,txt} ./{.web-extension-id,manifest.json} ../$OUTDIR )
node ./build/tooling/resolve-modules --project ./tsconfig.json
node ./build/tooling/fill-values
node ./build/tooling/bundle-content-scripts
cp -r $OUTDIR ./build/chrome-enterprise
cp -r $OUTDIR ./build/chrome-consumer
cp -r $OUTDIR ./build/firefox-consumer
node ./build/tooling/build-types-and-manifests