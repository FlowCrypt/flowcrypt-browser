/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { readFileSync, writeFileSync } from 'fs';

const { compilerOptions: { outDir: targetDirExtension } } = JSON.parse(readFileSync('../tsconfig.json').toString());
const { compilerOptions: { outDir: targetDirContentScripts } } = JSON.parse(readFileSync('tsconfig.content_scripts.json').toString());
const packageJson = JSON.parse(readFileSync(`../package.json`).toString());

const replaceables = [
  { needle: /\[BUILD_REPLACEABLE_VERSION\]/g, val: packageJson.version },
];

const paths = [
  `../${targetDirExtension}/js/common/core/const.js`,
  `${targetDirContentScripts}/common/core/const.js`,
];

for (const path of paths) {
  let source = readFileSync(path).toString();
  for (const replaceable of replaceables) {
    source = source.replace(replaceable.needle, replaceable.val);
  }
  writeFileSync(path, source);
}
