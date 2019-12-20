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


# build sequentially
( cd $SRCDIR && cp -r --parents ./**/*.{js,htm,css,ttf,woff2,png,svg,txt} ./{.web-extension-id,manifest.json} ../$OUTDIR )
node ./build/tooling/resolve-modules
node ./build/tooling/fill-values
node ./build/tooling/bundle-content-scripts
cp -r $OUTDIR ./build/chrome-enterprise
cp -r $OUTDIR ./build/chrome-consumer
cp -r $OUTDIR ./build/firefox-consumer
node ./build/tooling/build-manifests
node ./build/tooling/build-types
