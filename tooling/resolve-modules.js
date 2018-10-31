"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path = require("path");
let errors_found = 0;
const get_all_files_in_directory = (dir, file_pattern) => {
    let all = [];
    const files_in_dir = fs_1.readdirSync(dir);
    for (const file_in_dir of files_in_dir) {
        const file_path = path.join(dir, file_in_dir);
        const stat = fs_1.statSync(file_path);
        if (stat.isDirectory()) {
            all = all.concat(get_all_files_in_directory(file_path, file_pattern));
        }
        else if (file_pattern.test(file_path)) {
            all.push(file_path);
        }
    }
    return all;
};
const { compilerOptions } = JSON.parse(fs_1.readFileSync('./tsconfig.json').toString());
const module_map = {};
for (let module_name of Object.keys(compilerOptions.paths)) {
    if (compilerOptions.paths[module_name].indexOf('COMMENT') !== -1) {
        module_map[module_name] = null; // remove such import statements from the code, because they will be imported with script tags for compatibility
    }
    else {
        module_map[module_name] = `/${compilerOptions.paths[module_name].find((x) => x.match(/\.js$/) !== null)}`;
    }
}
const resolve_imports = (line, path) => line.replace(/^(import (?:.+ from )?['"])([^.][^'"/]+)(['"];)$/g, (found, prefix, libname, suffix) => {
    if (module_map[libname] === null) {
        return `// ${prefix}${libname}${suffix} // commented during build process: imported with script tag`;
    }
    else if (!module_map[libname]) {
        console.error(`Unknown path for module: ${libname} in ${path}`);
        process.exit(1);
        return '';
    }
    else {
        const resolved = `${prefix}${module_map[libname]}${suffix}`;
        // console.log(`${path}: ${found} -> ${resolved}`);
        return resolved;
    }
});
const source_file_paths = get_all_files_in_directory('./build/chrome', /\.js$/);
for (const source_file_path of source_file_paths) {
    const original = fs_1.readFileSync(source_file_path).toString();
    const resolved = original.split('\n').map(l => resolve_imports(l, source_file_path)).join('\n');
    if (resolved !== original) {
        fs_1.writeFileSync(source_file_path, resolved);
    }
}
// if(errors_found) {
//   console.error(`patterns.ts: Found ${errors_found} unhandled patterns, exiting\n`);
//   process.exit(1);
// }
//# sourceMappingURL=resolve-modules.js.map