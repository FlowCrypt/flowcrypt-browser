#!/bin/bash

set -euxo pipefail

git checkout master
git fetch
git pull
git checkout "remotes/origin/$1"
npm run-script run_firefox
