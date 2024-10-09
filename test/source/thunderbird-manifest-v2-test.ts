/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */
import * as fs from 'fs';

/* This test looks for any unexpected change for Thunderbird port of FlowCrypt ensuring its using Manifest v2 */

const manifestPath = 'build/thunderbird-consumer/manifest.json';
const manifestContent = fs.readFileSync(manifestPath, 'utf8');
const manifest = JSON.parse(manifestContent);

const testManifestV2Format = () => {
  try {
    if (manifest.manifest_version !== 2) {
      throw new Error('Manifest version is not 2');
    }
    if (!Array.isArray(manifest.web_accessible_resources)) {
      throw new Error('web_accessible_resources should be an array');
    }
    if (typeof manifest.content_security_policy !== 'string') {
      throw new Error('content_security_policy should be a string');
    }
  } catch (error) {
    console.error('Manifest V2 format test failed:', error.message);
  }
};

testManifestV2Format();
