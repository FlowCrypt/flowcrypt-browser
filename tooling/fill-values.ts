
import { readFileSync, writeFileSync } from 'fs';

const {compilerOptions: {outDir: targetDir}} = JSON.parse(readFileSync('../tsconfig.json').toString());

const commonPath = `${targetDir}/js/common/common.js`;
const package_json = JSON.parse(readFileSync(`../package.json`).toString());

let source = readFileSync(commonPath).toString();
source = source.replace(/\[BUILD_REPLACEABLE_VERSION\]/, package_json.version);
writeFileSync(commonPath, source);
