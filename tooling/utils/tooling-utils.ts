/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import * as path from 'path';

import { readdirSync, statSync } from 'fs';

export const getFilesInDir = (dir: string, filePattern: RegExp, recursive = true): string[] => {
  const all: string[] = [];
  const filesInDir = readdirSync(dir);
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
