
import { readdirSync, statSync, readFileSync } from 'fs';
import * as path from 'path';

let errors_found = 0;

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

const has_xss_comment = (line: string) => {
  return /\/\/ xss-(known-source|direct|escaped|safe-factory|safe-value|sanitized|none|reinsert|dangerous-function)/.test(line);
};

const has_error_handled_comment = (line: string) => {
  return /\/\/ error-handled/.test(line);
};

const validate_line = (line: string, location: string) => {

  if(line.match(/\.(innerHTML|outerHTML) ?= ?/) && !has_xss_comment(line)) {
    console.error(`unchecked xss in ${location}:\n${line}\n`);
    errors_found++;
  }

  if(line.match(/\.(html|append|prepend|replaceWith)\([^)]/) && !has_xss_comment(line)) {
    console.error(`unchecked xss in ${location}:\n${line}\n`);
    errors_found++;
  }

  if(line.match(/DANGEROUS/i) && !has_xss_comment(line)) {
    console.error(`unchecked xss in ${location}:\n${line}\n`);
    errors_found++;
  }

  if(line.match(/setInterval|setTimeout/) && !has_error_handled_comment(line)) {
    console.error(`errors not handled in ${location}:\n${line}\n`);
    errors_found++;
  }

};

const source_file_paths = get_all_files_in_directory('./extension', /\.ts$/);

for(const source_file_path of source_file_paths) {
  const lines = readFileSync(source_file_path).toString().split('\n');
  for(let line_i = 0; line_i < lines.length; line_i++) {
    validate_line(lines[line_i], `${source_file_path}:${line_i + 1}`);
  }
}

if(errors_found) {
  console.error(`patterns.ts: Found ${errors_found} unhandled patterns, exiting\n`);
  process.exit(1);
}
