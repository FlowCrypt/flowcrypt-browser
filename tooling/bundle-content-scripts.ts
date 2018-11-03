
import { readdirSync, statSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import * as path from 'path';

const OUT_DIR = `../build/chrome/js/content_scripts`;
const {compilerOptions: {outDir: sourceDir}} = JSON.parse(readFileSync('./tsconfig.content_scripts.json').toString());

const get_files_in_dir = (dir: string, file_pattern: RegExp): string[] => {
  let all: string[] = [];
  const files_in_dir = readdirSync(dir);
  for (const file_in_dir of files_in_dir) {
    const file_path = path.join(dir, file_in_dir);
    if (statSync(file_path).isDirectory()) {
      all = all.concat(get_files_in_dir(file_path, file_pattern));
    } else if(file_pattern.test(file_path)) {
      all.push(file_path);
    }
  }
  return all;
};

const processed_source = (source_file_path: string) => {
  let file = readFileSync(source_file_path).toString();
  file = file.replace(/^(import .*)$/gm, '// $1'); // comment out import statements
  file = file.replace(/^export (.*)$/gm, '$1 // export'); // remove export statements
  return file;
};

const build_content_script = (source_file_paths: string[], output_file_name: string) => {
  let content_script_bundle = '';
  for (const file_path of source_file_paths) {
    content_script_bundle += `\n/* ----- ${file_path.replace(sourceDir, '')} ----- */\n\n${processed_source(file_path)}\n`;
  }
  content_script_bundle = `(() => {\n${content_script_bundle}\n})();\n`;
  writeFileSync(`${OUT_DIR}/${output_file_name}`, content_script_bundle);
};

mkdirSync(OUT_DIR);

// webmail
build_content_script(([] as string[]).concat(
  get_files_in_dir(`${sourceDir}/common`, /\.js$/),
  get_files_in_dir(`${sourceDir}/content_scripts/webmail`, /\.js$/),
), 'webmail_bundle.js');

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
