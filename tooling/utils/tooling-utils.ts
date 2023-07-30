/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import * as path from 'path';

import { readdirSync, statSync } from 'fs';

export const getFilesInDir = (dir: string, filePattern: RegExp, recursive = true, reverseFilesInDir = false): string[] => {
  const all: string[] = [];
  const filesInDir = readdirSync(dir);
  if (reverseFilesInDir) {
    filesInDir.reverse();
  }
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
