
import { readdirSync, statSync, readFileSync, symlinkSync, writeFileSync } from 'fs';
import * as path from 'path';

const get_all_files_in_directory = (dir: string, file_pattern: RegExp): string[] => {
  let all: string[] = [];
  const files_in_dir = readdirSync(dir);
  for (const file_in_dir of files_in_dir) {
    const file_path = path.join(dir, file_in_dir);
    const stat = statSync(file_path);
    if (stat.isDirectory()) {
      all = all.concat(get_all_files_in_directory(file_path, file_pattern));
    } else if(file_pattern.test(file_path)) {
      all.push(file_path);
    }
  }
  return all;
};

const {compilerOptions} = JSON.parse(readFileSync('../tsconfig.json').toString());
const module_map: {[name: string]: string|null} = {};
for(let module_name of Object.keys(compilerOptions.paths)) {
  if(compilerOptions.paths[module_name].indexOf('COMMENT') !== -1) {
    module_map[module_name] = null; // remove such import statements from the code, because they will be imported with script tags for compatibility
  } else {
    module_map[module_name] = `/${compilerOptions.paths[module_name].find((x: string) => x.match(/\.js$/) !== null)}`;
  }
}

const resolve_imports = (line: string, path: string) => line.replace(/^(import (?:.+ from )?['"])([^.][^'"/]+)(['"];)$/g, (found, prefix, libname, suffix) => {
  if(module_map[libname] === null) {
    return `// ${prefix}${libname}${suffix} // commented during build process: imported with script tag`;
  } else if (!module_map[libname]) {
    console.error(`Unknown path for module: ${libname} in ${path}`);
    process.exit(1);
    return '';
  } else {
    const resolved = `${prefix}${module_map[libname]}${suffix}`;
    // console.log(`${path}: ${found} -> ${resolved}`);
    return resolved;
  }
});

const source_file_paths = get_all_files_in_directory(`../${compilerOptions.outDir}`, /\.js$/);

for (const source_file_path of source_file_paths) {
  const original = readFileSync(source_file_path).toString();
  const resolved = original.split('\n').map(l => resolve_imports(l, source_file_path)).join('\n');
  if(resolved !== original) {
    writeFileSync(source_file_path, resolved);
  }
}
