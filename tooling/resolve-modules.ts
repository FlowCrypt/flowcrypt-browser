/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

// tslint:disable:no-unsafe-any

import { readFileSync, writeFileSync } from 'fs';
import { getFilesInDir } from './utils/tooling-utils';

const { compilerOptions } = JSON.parse(readFileSync('./tsconfig.json').toString());
const moduleMap: { [name: string]: string | null } = {};
for (const moduleName of Object.keys(compilerOptions.paths)) {
  if (compilerOptions.paths[moduleName].indexOf('COMMENT') !== -1) {
    // COMMENT flag, remove such import statements from the code, because they will be imported with script tags for compatibility
    moduleMap[moduleName] = null; // tslint:disable-line:no-null-keyword
  } else {
    // replace import with full path from config
    moduleMap[moduleName] = `/${compilerOptions.paths[moduleName].find((x: string) => x.match(/\.js$/) !== null)}`;
  }
}

const namedImportLineRegEx = /^(import (?:.+ from )?['"])([^.][^'"/]+)(['"];)\r{0,1}$$/g;
const importLineNotEndingWithJs = /import (?:.+ from )?['"]\.[^'"]+[^.][^j][^s]['"];/g;
const importLineEndingWithJsNotStartingWithDot = /import (?:.+ from )?['"][^.][^'"]+\.js['"];/g;

const resolveLineImports = (line: string, path: string) => line.replace(namedImportLineRegEx, (found, prefix, libname, suffix) => {
  if (moduleMap[libname] === null) {
    return `// ${prefix}${libname}${suffix} // commented during build process: imported with script tag`;
  } else if (!moduleMap[libname]) {
    console.error(`Unknown path for module: ${libname} in ${path}`);
    process.exit(1);
    return '';
  } else {
    const resolved = `${prefix}${moduleMap[libname]}${suffix}`;
    // console.info(`${path}: ${found} -> ${resolved}`);
    return resolved;
  }
});

const errIfSrcMissingJsExtensionInImport = (src: string, path: string) => {
  const matched = src.match(importLineNotEndingWithJs);
  if (matched) {
    console.error(`\nresolve-modules ERROR:\nImport not ending with .js in ${path}:\n--\n${matched[0]}\n--\n`);
    process.exit(1);
  }
};

const errIfRelativeSrcDoesNotBeginWithDot = (src: string, path: string) => {
  const matched = src.match(importLineEndingWithJsNotStartingWithDot);
  if (matched) {
    console.error(`\nresolve-modules ERROR: Relative import should start with a dot in ${path}:\n--\n${matched[0]}\n--\n`);
    process.exit(1);
  }
};

const srcFilePaths = getFilesInDir(compilerOptions.outDir, /\.js$/);

for (const srcFilePath of srcFilePaths) {
  const original = readFileSync(srcFilePath).toString();
  const resolved = original.split('\n').map(l => resolveLineImports(l, srcFilePath)).join('\n');
  if (resolved !== original) {
    writeFileSync(srcFilePath, resolved);
  }
  errIfSrcMissingJsExtensionInImport(resolved, srcFilePath);
  errIfRelativeSrcDoesNotBeginWithDot(resolved, srcFilePath);
}
