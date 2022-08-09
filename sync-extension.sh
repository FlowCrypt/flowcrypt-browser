#!/usr/bin/env bash

OUTDIR=./build/generic-extension-wip

rm -rf ./build/firefox-consumer
rm -rf ./build/chrome-consumer
rm -rf ./build/chrome-enterprise

cp -r $OUTDIR ./build/chrome-enterprise
cp -r $OUTDIR ./build/chrome-consumer
cp -r $OUTDIR ./build/firefox-consumer
node ./build/tooling/build-types-and-manifests