"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path = require("path");
const OUT_DIR = `build/chrome/js/content_scripts`;
const { compilerOptions: { outDir: sourceDir } } = JSON.parse(fs_1.readFileSync('./tsconfig.content_scripts.json').toString());
const get_files_in_dir = (dir, file_pattern) => {
    let all = [];
    const files_in_dir = fs_1.readdirSync(dir);
    for (const file_in_dir of files_in_dir) {
        const file_path = path.join(dir, file_in_dir);
        if (fs_1.statSync(file_path).isDirectory()) {
            all = all.concat(get_files_in_dir(file_path, file_pattern));
        }
        else if (file_pattern.test(file_path)) {
            all.push(file_path);
        }
    }
    return all;
};
const processed_source = (source_file_path) => {
    let file = fs_1.readFileSync(source_file_path).toString();
    file = file.replace(/^(import .*)$/gm, '// $1'); // comment out import statements
    file = file.replace(/^export (.*)$/gm, '$1 // export'); // remove export statements
    return file;
};
const build_content_script = (source_file_paths, output_file_name) => {
    let content_script_bundle = '';
    for (const file_path of source_file_paths) {
        content_script_bundle += `\n/* ----- ${file_path.replace(sourceDir, '')} ----- */\n\n${processed_source(file_path)}\n`;
    }
    content_script_bundle = `(() => {\n${content_script_bundle}\n})();\n`;
    fs_1.writeFileSync(`${OUT_DIR}/${output_file_name}`, content_script_bundle);
};
fs_1.mkdirSync(OUT_DIR);
// webmail
build_content_script([].concat(get_files_in_dir(`${sourceDir}/common`, /\.js$/), get_files_in_dir(`${sourceDir}/content_scripts/webmail`, /\.js$/)), 'webmail_bundle.js');
// checkout
build_content_script([
    `${sourceDir}/common/common.js`,
    `${sourceDir}/common/extension.js`,
    `${sourceDir}/content_scripts/checkout/stripe.js`,
], 'stripe_bundle.js');
// oAuth window
build_content_script([
    `${sourceDir}/common/common.js`,
    `${sourceDir}/common/extension.js`,
    `${sourceDir}/common/browser.js`,
    `${sourceDir}/content_scripts/oauth_window/google.js`,
], 'google_bundle.js');
//# sourceMappingURL=bundle-content-scripts.js.map