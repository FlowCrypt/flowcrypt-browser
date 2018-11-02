"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const { compilerOptions } = JSON.parse(fs_1.readFileSync('./tsconfig.webmail.json').toString());
let webmail_script = fs_1.readFileSync(compilerOptions.outFile).toString();
if (!webmail_script) {
    console.error(`Webmail script empty at ${compilerOptions.outFile}`);
    process.exit(1);
}
fs_1.writeFileSync(compilerOptions.outFile, `(() => {\n${webmail_script}\n})();\n`);
//# sourceMappingURL=wrap-webmail-bundle.js.map