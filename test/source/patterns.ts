
import { readdirSync, statSync, readFileSync } from 'fs';
import * as path from 'path';

let errsFound = 0;

const getAllFilesInDir = (dir: string, filePattern: RegExp): string[] => {
  const all: string[] = [];
  const filesInDir = readdirSync(dir);
  for (const fileInDir of filesInDir) {
    const filePath = path.join(dir, fileInDir);
    const stat = statSync(filePath);
    if (stat.isDirectory()) {
      all.push(...getAllFilesInDir(filePath, filePattern));
    } else if (filePattern.test(filePath)) {
      all.push(filePath);
    }
  }
  return all;
};

const hasXssComment = (line: string) => {
  return /\/\/ xss-(known-source|direct|escaped|safe-factory|safe-value|sanitized|none|reinsert|dangerous-function)/.test(line);
};

const hasErrHandledComment = (line: string) => {
  return /\/\/ error-handled/.test(line);
};

const validateLine = (line: string, location: string) => {
  if (line.match(/\.(innerHTML|outerHTML) ?= ?/) && !hasXssComment(line)) {
    console.error(`unchecked xss in ${location}:\n${line}\n`);
    errsFound++;
  }
  if (line.match(/\.(html|append|prepend|replaceWith|insertBefore|insertAfter)\([^)]/) && !hasXssComment(line)) {
    console.error(`unchecked xss in ${location}:\n${line}\n`);
    errsFound++;
  }
  if (line.match(/DANGEROUS/i) && !hasXssComment(line) && !line.includes(' is dangerous ')) {
    console.error(`unchecked xss in ${location}:\n${line}\n`);
    errsFound++;
  }
  if (line.match(/setInterval|setTimeout/) && !hasErrHandledComment(line)) {
    console.error(`errors not handled in ${location}:\n${line}\n`);
    errsFound++;
  }
};

const srcFilePaths = getAllFilesInDir('./extension', /\.ts$/);

for (const srcFilePath of srcFilePaths) {
  const lines = readFileSync(srcFilePath).toString().split('\n');
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    validateLine(lines[lineIndex], `${srcFilePath}:${lineIndex + 1}`);
  }
}

if (errsFound) {
  console.error(`patterns.ts: Found ${errsFound} unhandled patterns, exiting\n`);
  process.exit(1);
}
