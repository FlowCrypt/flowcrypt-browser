/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { readFileSync, writeFileSync } from 'fs';

const {
  compilerOptions: { outDir: targetDirExtension },
} = JSON.parse(readFileSync('./tsconfig.json').toString());
const {
  compilerOptions: { outDir: targetDirContentScripts },
} = JSON.parse(readFileSync('./conf/tsconfig.content_scripts.json').toString());
const { version } = JSON.parse(readFileSync(`./package.json`).toString());

// mock values for a consumer-mock or enterprise-mock test builds are regex-replaced later in `build-types-and-manifests.ts`
const replaceables: { needle: RegExp; val: string }[] = [
  { needle: /\[BUILD_REPLACEABLE_VERSION\]/g, val: version },
  { needle: /\[BUILD_REPLACEABLE_FLAVOR\]/g, val: 'consumer' },
  { needle: /\[BUILD_REPLACEABLE_OAUTH_GOOGLE_API_HOST\]/g, val: 'https://oauth2.googleapis.com' },
  // www.googleapis.com used on consumer (for now until cors fixed), gmail.googleapis.com on enterprise
  { needle: /\[BUILD_REPLACEABLE_GMAIL_GOOGLE_API_HOST\]/g, val: 'https://www.googleapis.com' },
  { needle: /\[BUILD_REPLACEABLE_PEOPLE_GOOGLE_API_HOST\]/g, val: 'https://people.googleapis.com' },
  { needle: /\[BUILD_REPLACEABLE_GOOGLE_OAUTH_SCREEN_HOST\]/g, val: 'https://accounts.google.com' },
  { needle: /\[BUILD_REPLACEABLE_BACKEND_API_HOST\]/g, val: 'https://flowcrypt.com/api/' },
  { needle: /\[BUILD_REPLACEABLE_ATTESTER_API_HOST\]/g, val: 'https://flowcrypt.com/attester/' },
  { needle: /\[BUILD_REPLACEABLE_SHARED_TENANT_API_HOST\]/g, val: 'https://flowcrypt.com/shared-tenant-fes' },
];

const paths = [`${targetDirExtension}/js/common/core/const.js`, `./build/${targetDirContentScripts}/js/common/core/const.js`];

for (const path of paths) {
  let source = readFileSync(path).toString();
  for (const replaceable of replaceables) {
    source = source.replace(replaceable.needle, replaceable.val);
  }
  writeFileSync(path, source);
}
