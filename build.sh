#!/usr/bin/env bash

OUTDIR=./build/generic-extension-wip
SRCDIR=./extension

set -euxo pipefail
shopt -s globstar

if [[ "$#" == 1 ]] && [[ "$1" == "--assets-only" ]]; then # only build static assets, without re-building TS
    ( cd $SRCDIR && cp -r --parents ./**/*.{js,htm,css,ttf,woff2,png,svg,txt} ../build/chrome-enterprise )
    ( cd $SRCDIR && cp -r --parents ./**/*.{js,htm,css,ttf,woff2,png,svg,txt} ../build/chrome-consumer )
    ( cd $SRCDIR && cp -r --parents ./**/*.{js,htm,css,ttf,woff2,png,svg,txt} ../build/firefox-consumer )
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
  [[ -d ./build/tooling ]] || npx tsc --project ./conf/tsconfig.tooling.json & pids+=($!)  # only build tooling if missing
  for pid in "${pids[@]}"; do wait "$pid" || exit 1; done

else

  # prebuild tools (and our compiler)
  rm -rf ./build
  npx tsc --project ./conf/tsconfig.tooling.json
  mkdir -p $OUTDIR

  # build concurrently - using our own compiler (which fixes async stack, but doesn't support incremental builds)
  node ./build/tooling/tsc-compiler --project ./tsconfig.json & pids+=($!)
  node ./build/tooling/tsc-compiler --project ./conf/tsconfig.content_scripts.json & pids+=($!)
  for pid in "${pids[@]}"; do wait "$pid" || exit 1; done

fi

# copy dependencies from npm
mkdir -p $OUTDIR/lib/
mkdir -p $OUTDIR/css/
cp node_modules/dompurify/dist/purify.js $OUTDIR/lib/purify.js
cp node_modules/jquery/dist/jquery.min.js $OUTDIR/lib/jquery.min.js
cp node_modules/openpgp/dist/openpgp.js $OUTDIR/lib/openpgp.js
cp node_modules/openpgp/dist/openpgp.worker.js $OUTDIR/lib/openpgp.worker.js
cp node_modules/sweetalert2/dist/sweetalert2.js $OUTDIR/lib/sweetalert2.js
cp node_modules/sweetalert2/dist/sweetalert2.css $OUTDIR/css/sweetalert2.css
cp node_modules/iso-8859-2/iso-8859-2.js $OUTDIR/lib/iso-8859-2.js
cp node_modules/zxcvbn/dist/zxcvbn.js $OUTDIR/lib/zxcvbn.js
cp node_modules/squire-rte/build/squire-raw.js $OUTDIR/lib/squire-raw.js
cp node_modules/clipboard/dist/clipboard.js $OUTDIR/lib/clipboard.js
cp node_modules/fine-uploader/fine-uploader/fine-uploader.js $OUTDIR/lib/fine-uploader.js
mkdir -p $OUTDIR/lib/bootstrap
cp node_modules/bootstrap/dist/js/bootstrap.min.js $OUTDIR/lib/bootstrap/bootstrap.min.js
cp node_modules/bootstrap/dist/css/bootstrap.min.css $OUTDIR/lib/bootstrap/bootstrap.min.css

# remaining build steps sequentially
( cd $SRCDIR && cp -r --parents ./**/*.{js,htm,css,ttf,woff2,png,svg,txt} ./{.web-extension-id,manifest.json} ../$OUTDIR )
node ./build/tooling/resolve-modules
node ./build/tooling/fill-values
node ./build/tooling/bundle-content-scripts
cp -r $OUTDIR ./build/chrome-enterprise
cp -r $OUTDIR ./build/chrome-consumer
cp -r $OUTDIR ./build/firefox-consumer
node ./build/tooling/build-manifests
node ./build/tooling/build-types
