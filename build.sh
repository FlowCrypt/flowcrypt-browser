#!/usr/bin/env bash

OUTDIR=./build/generic-extension-wip
SRCDIR=./extension

set -euxo pipefail

shopt -s globstar

# prebuild tools
rm -rf ./build
npx tsc --project ./conf/tsconfig.tooling.json
mkdir -p $OUTDIR

# build concurrently
node ./build/tooling/tsc-compiler --project ./tsconfig.json & pids+=($!)
node ./build/tooling/tsc-compiler --project ./conf/tsconfig.content_scripts.json & pids+=($!)
for pid in "${pids[@]}"; do wait "$pid" || exit 1; done

# build sequentially
node ./build/tooling/tsc-compiler --project ./tsconfig.json
node ./build/tooling/tsc-compiler --project ./conf/tsconfig.content_scripts.json
( cd $SRCDIR && cp -r --parents ./**/*.{js,htm,css,ttf,woff2,png,svg,txt} ./{.web-extension-id,manifest.json} ../$OUTDIR )
node ./build/tooling/resolve-modules
node ./build/tooling/fill-values
node ./build/tooling/bundle-content-scripts
cp -r $OUTDIR ./build/chrome-enterprise
cp -r $OUTDIR ./build/chrome-consumer
cp -r $OUTDIR ./build/firefox-consumer
node ./build/tooling/build-manifests
node ./build/tooling/build-types

# used to have:
# spacesToTabs: (folder) => gulp.src(`${folder}/**/*.js`)
#   .pipe(replace(/}\n\s+(else|catch)/gm, (_, statement) => `} ${statement}`)) // `} catch () {` and `} else {` on the same line
#   .pipe(replace(/^( {4})+/gm, (m) => '\t'.repeat(m.length / 4)))
#   .pipe(gulp.dest(folder)),
