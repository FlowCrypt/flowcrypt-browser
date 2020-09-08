import { readFileSync, writeFileSync } from 'fs';

// tslint:disable:no-unsafe-any

const DIR = './build';
const version: string = JSON.parse(readFileSync('./package.json').toString()).version;

const addManifest = (toBuildType: string, transform: (manifest: { [k: string]: any }) => void) => {
  const manifest = JSON.parse(readFileSync(`${DIR}/generic-extension-wip/manifest.json`).toString());
  transform(manifest);
  writeFileSync(`${DIR}/${toBuildType}/manifest.json`, JSON.stringify(manifest, undefined, 2));
};

addManifest('chrome-consumer', manifest => {
  manifest.version = version;
});

addManifest('firefox-consumer', manifest => {
  manifest.version = version;
  manifest.applications = { gecko: { id: 'firefox@cryptup.io', update_url: 'https://flowcrypt.com/api/update/firefox', strict_min_version: '60.0' } };
  manifest.permissions = manifest.permissions.filter((p: string) => p !== 'unlimitedStorage');
  delete manifest.minimum_chrome_version;
});

addManifest('chrome-enterprise', manifest => {
  manifest.version = version;
  manifest.name = 'FlowCrypt for Enterprise';
  manifest.description = 'FlowCrypt Chrome Extension for Enterprise clients (stable)';
  // careful - changing this will likely cause all extensions to be disabled in their user's browsers
  manifest.permissions = ["storage", "tabs", "https://*.google.com/*", "https://www.googleapis.com/*", "https://flowcrypt.com/*", "unlimitedStorage"];
  for (const csDef of manifest.content_scripts) {
    csDef.matches = csDef.matches.filter((host: string) => host === 'https://mail.google.com/*');
  }
  manifest.content_scripts = manifest.content_scripts.filter((csDef: { matches: string[] }) => csDef.matches.length); // remove empty defs
  if (!manifest.content_scripts.length) {
    throw new Error('Content script defs ended up empty in enterprise manifest');
  }
});
