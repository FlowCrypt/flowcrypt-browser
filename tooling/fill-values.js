"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const { compilerOptions: { outDir: targetDir } } = JSON.parse(fs_1.readFileSync('./tsconfig.json').toString());
const commonPath = `${targetDir}/js/common/common.js`;
const package_json = JSON.parse(fs_1.readFileSync(`package.json`).toString());
let source = fs_1.readFileSync(commonPath).toString();
source = source.replace(/\[BUILD_REPLACEABLE_VERSION\]/, package_json.version);
fs_1.writeFileSync(commonPath, source);
//# sourceMappingURL=fill-values.js.map