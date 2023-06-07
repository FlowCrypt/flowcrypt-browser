/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'fs';

import { getFilesInDir } from './utils/tooling-utils';

const OUT_DIR = `./build/generic-extension-wip/js/content_scripts`;
let {
  compilerOptions: { outDir: sourceDir },
} = JSON.parse(readFileSync('./conf/tsconfig.content_scripts.json').toString());
sourceDir = `./build/${sourceDir}`;

const processedSrc = (srcFilePath: string) => {
  let file = readFileSync(srcFilePath).toString();
  file = file.replace(/^(import .*)$/gm, '// $1'); // comment out import statements
  file = file.replace(/^export (.*)$/gm, '$1 // export'); // remove export statements
  return file;
};

const buildContentScript = (srcFilePaths: string[], outFileName: string) => {
  let contentScriptBundle = '';
  for (const filePath of srcFilePaths) {
    contentScriptBundle += `\n/* ----- ${filePath.replace(sourceDir, '')} ----- */\n\n${processedSrc(filePath)}\n`;
  }
  contentScriptBundle = `(() => {\n${contentScriptBundle}\n})();\n`;
  writeFileSync(`${OUT_DIR}/${outFileName}`, contentScriptBundle);
};

if (existsSync(OUT_DIR)) {
  rmSync(OUT_DIR, { recursive: true });
}
mkdirSync(OUT_DIR);

// webmail
buildContentScript(
  ([] as string[]).concat(
    getFilesInDir(`${sourceDir}/js/common/platform`, /\.js$/, false),
    getFilesInDir(`${sourceDir}/js/common/platform/store`, /\.js$/, false),
    getFilesInDir(`${sourceDir}/js/common/core`, /\.js$/, false),
    getFilesInDir(`${sourceDir}/js/common/core/crypto`, /\.js$/, false),
    getFilesInDir(`${sourceDir}/js/common/core/crypto/pgp`, /\.js$/, false),
    getFilesInDir(`${sourceDir}/js/common/core/crypto/smime`, /\.js$/, false),
    getFilesInDir(`${sourceDir}/js/common/api/shared`, /\.js$/, false),
    getFilesInDir(`${sourceDir}/js/common/api/key-server`, /\.js$/, false),
    getFilesInDir(`${sourceDir}/js/common/api/account-servers`, /\.js$/, false),
    getFilesInDir(`${sourceDir}/js/common/api/email-provider`, /\.js$/, false),
    getFilesInDir(`${sourceDir}/js/common/api/email-provider/gmail`, /\.js$/, false),
    getFilesInDir(`${sourceDir}/js/common/api`, /\.js$/, false),
    getFilesInDir(`${sourceDir}/js/common/browser`, /\.js$/, false),
    getFilesInDir(`${sourceDir}/js/common`, /\.js$/, false),
    getFilesInDir(`${sourceDir}/js/content_scripts/webmail`, /\.js$/)
  ),
  'webmail_bundle.js'
);
