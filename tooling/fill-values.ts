
import { readFileSync, writeFileSync } from 'fs';

const { compilerOptions: { outDir: targetDirExtension } } = JSON.parse(readFileSync('../tsconfig.json').toString());
const { compilerOptions: { outDir: targetDirContentScripts } } = JSON.parse(readFileSync('tsconfig.content_scripts.json').toString());
const packageJson = JSON.parse(readFileSync(`../package.json`).toString());

const replaceables = [
  { needle: /\[BUILD_REPLACEABLE_VERSION\]/g, val: packageJson.version },
];

const paths = [
  `../${targetDirExtension}/js/common/platform/catch.js`,
  `${targetDirContentScripts}/common/platform/catch.js`,
];

for (const path of paths) {
  let source = readFileSync(path).toString();
  for (const replaceable of replaceables) {
    source = source.replace(replaceable.needle, replaceable.val);
  }
  writeFileSync(path, source);
}
