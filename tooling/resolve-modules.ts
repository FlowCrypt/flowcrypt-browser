/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { readFileSync, writeFileSync } from 'fs';
import { sep } from 'path';
import { getFilesInDir } from './utils/tooling-utils';

let tsconfigPath: string | undefined;
for (let i = 0; i < process.argv.length; i++) {
  if (process.argv[i] === '-p' || process.argv[i] === '--project') {
    tsconfigPath = process.argv[i + 1];
    break;
  }
}

export interface TSConfig {
  compilerOptions: { paths: Record<string, string[]>; outDir: string };
  include: string[];
  exclude: string[];
  files: string[];
}

const { compilerOptions } = JSON.parse(readFileSync(tsconfigPath || './tsconfig.json').toString()) as TSConfig;
const moduleMap: { [name: string]: string | undefined } = {};
const commentImportedModules = new Set<string>();
for (const moduleName of Object.keys(compilerOptions.paths)) {
  if (compilerOptions.paths[moduleName].some((x: string) => x.endsWith('/COMMENT'))) {
    // COMMENT flag, remove such import statements from the code, because they will be imported with script tags for compatibility
    commentImportedModules.add(moduleName);
  } else {
    // replace import with full path from config
    const selectedPath = compilerOptions.paths[moduleName].find((x: string) => /\.(mjs|js)$/.test(x));
    moduleMap[moduleName] = selectedPath?.replace(/^\.\/extension\//, '');
  }
}

const namedImportLineRegEx = /^(import (?:.+ from )?['"])([^.][^'"]+)(['"];)\r{0,1}$$/g;
const requireLineRegEx = /^(.+require\(['"])([^.][^'"]+)(['"]\)+;)\r{0,1}$$/g;
const importLineNotEndingWithJs = /import (?:.+ from )?['"]\.[^'"]+[^.][^j][^s]['"];/g;
const importLineEndingWithJsNotStartingWithDot = /^(?!\s*\/\/)(?!\s*\/\*)(?:\s*import (?:.+ from )?['"][^.][^'"]+\.js['"];)/gm;

const resolveLineImports = (regex: RegExp, line: string, path: string) =>
  line.replace(regex, (found, prefix, libname: string, suffix) => {
    if (commentImportedModules.has(libname)) {
      return `// ${prefix}${libname}${suffix} // commented during build process: imported with script tag`;
    }
    const mappedModulePath = moduleMap[libname];
    if (!mappedModulePath) {
      return found;
    }
    const depth = path.split(sep).length;
    const prePath = '../'.repeat(depth - 3); // todo:
    const resolved = `${prefix}${prePath}${mappedModulePath}${suffix}`;
    // console.info(`${path}: ${found} -> ${resolved}`);
    return resolved;
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
  const resolved = original
    .split('\n')
    .map(l => resolveLineImports(requireLineRegEx, resolveLineImports(namedImportLineRegEx, l, srcFilePath), srcFilePath))
    .join('\n');
  if (resolved !== original) {
    writeFileSync(srcFilePath, resolved);
  }
  errIfSrcMissingJsExtensionInImport(resolved, srcFilePath);
  errIfRelativeSrcDoesNotBeginWithDot(resolved, srcFilePath);
}
