
import { readdirSync, statSync, readFileSync, symlinkSync, writeFileSync } from 'fs';
import * as path from 'path';

const getAllFilesInDir = (dir: string, filePattern: RegExp): string[] => {
  let all: string[] = [];
  const filesInDir = readdirSync(dir);
  for (const fileInDir of filesInDir) {
    const filePath = path.join(dir, fileInDir);
    const stat = statSync(filePath);
    if (stat.isDirectory()) {
      all = all.concat(getAllFilesInDir(filePath, filePattern));
    } else if (filePattern.test(filePath)) {
      all.push(filePath);
    }
  }
  return all;
};

const { compilerOptions } = JSON.parse(readFileSync('../tsconfig.json').toString());
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

const namedImportLineRegEx = /^(import (?:.+ from )?['"])([^.][^'"/]+)(['"];)$/g;
const importLineNotEndingWithJs = /import (?:.+ from )?['"]\.[^'"]+[^.][^j][^s]['"];/g;

const resolveLineImports = (line: string, path: string) => line.replace(namedImportLineRegEx, (found, prefix, libname, suffix) => {
  if (moduleMap[libname] === null) {
    return `// ${prefix}${libname}${suffix} // commented during build process: imported with script tag`;
  } else if (!moduleMap[libname]) {
    console.error(`Unknown path for module: ${libname} in ${path}`);
    process.exit(1);
    return '';
  } else {
    const resolved = `${prefix}${moduleMap[libname]}${suffix}`;
    // console.log(`${path}: ${found} -> ${resolved}`);
    return resolved;
  }
});

const errIfSrcMissingJs = (stc: string, path: string) => {
  const matched = stc.match(importLineNotEndingWithJs);
  if (matched) {
    console.error(`\nresolve-modules ERROR:\nImport not ending with .js in ${path}:\n${matched[0]}`);
    process.exit(1);
  }
};

const srcFilePaths = getAllFilesInDir(`../${compilerOptions.outDir}`, /\.js$/);

for (const srcFilePath of srcFilePaths) {
  const original = readFileSync(srcFilePath).toString();
  const resolved = original.split('\n').map(l => resolveLineImports(l, srcFilePath)).join('\n');
  if (resolved !== original) {
    writeFileSync(srcFilePath, resolved);
  }
  errIfSrcMissingJs(resolved, srcFilePath);
}
