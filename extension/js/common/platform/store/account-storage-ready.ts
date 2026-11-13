/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { AbstractStore } from './abstract-store.js';
import { BgNotReadyErr, BrowserMsg } from '../../browser/browser-msg.js';
import { storageGet } from '../../browser/chrome.js';
import { Time } from '../../browser/time.js';

let isBackground = false;
let readiness: Promise<void> | undefined;

export const initializeAccountStorageInBackground = () => {
  isBackground = true;
};

const waitForMigration = async () => {
  const markerKey = AbstractStore.singleScopeRawIndex('global', 'email_key_index_migrated');
  const { [markerKey]: migrated } = await storageGet('local', [markerKey]);
  if (migrated) {
    return;
  }
  const maxAttempts = 10;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await BrowserMsg.send.bg.await.accountStorageReady();
      return;
    } catch (e) {
      if (!(e instanceof BgNotReadyErr) || attempt === maxAttempts) {
        throw e;
      }
      await Time.sleep(300);
    }
  }
};

export const awaitAccountStorageReady = async (): Promise<void> => {
  if (isBackground) {
    return;
  }
  readiness ??= waitForMigration().catch((e: unknown) => {
    readiness = undefined;
    throw e;
  });
  await readiness;
};
