/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import * as path from 'path';

import { readdirSync, statSync } from 'fs';

export const getFilesInDir = (dir: string, filePattern: RegExp, recursive = true, excludedFiles: string[] = []): string[] => {
  const all: string[] = [];
  let filesInDir = readdirSync(dir);
  filesInDir = filesInDir.filter(dir => !excludedFiles.includes(dir));
  for (const fileInDir of filesInDir) {
    const filePath = path.join(dir, fileInDir);
    if (statSync(filePath).isDirectory() && recursive) {
      all.push(...getFilesInDir(filePath, filePattern, recursive));
    } else if (filePattern.test(filePath)) {
      all.push(filePath);
    }
  }
  return all;
};
