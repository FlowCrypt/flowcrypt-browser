/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { KeyInfo, KeyUtil } from '../common/core/crypto/key.js';
import { Catch } from '../common/platform/catch.js';
import { GlobalStore } from '../common/platform/store/global-store.js';
import { KeyStore } from '../common/platform/store/key-store.js';

const addKeyInfoFingerprints = async () => {
  for (const acctEmail of await GlobalStore.acctEmailsGet()) {
    const keyinfos = await KeyStore.get(acctEmail);
    const output: KeyInfo[] = [];
    for (const keyinfo of keyinfos) {
      const processed = await Catch.undefinedOnException(KeyUtil.keyInfoObj(await KeyUtil.parse(keyinfo.private)));
      if (processed) {
        output.push(processed);
      }
    }
    await KeyStore.set(acctEmail, output);
  }
}

export const migrateGlobal = async () => {
  const globalStore = await GlobalStore.get(['key_info_store_fingerprints_added']);
  if (!globalStore.key_info_store_fingerprints_added) {
    await addKeyInfoFingerprints();
    await GlobalStore.set({ key_info_store_fingerprints_added: true });
  }
};
