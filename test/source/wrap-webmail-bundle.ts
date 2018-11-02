
import {readdirSync, statSync, readFileSync, symlinkSync, writeFileSync} from 'fs';

const {compilerOptions} = JSON.parse(readFileSync('./tsconfig.webmail.json').toString());

let webmail_script = readFileSync(compilerOptions.outFile).toString();

if(!webmail_script) {
  console.error(`Webmail script empty at ${compilerOptions.outFile}`);
  process.exit(1);
}

writeFileSync(compilerOptions.outFile, `(() => {\n${webmail_script}\n})();\n`);
