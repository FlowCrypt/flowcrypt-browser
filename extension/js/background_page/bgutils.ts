/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch, UnreportableError } from '../common/platform/catch.js';
import { Url } from '../common/core/common.js';
import { StoreCorruptedError, StoreDeniedError, StoreFailedError } from '../common/platform/store/abstract-store.js';

export class BgUtils {

  public static handleStoreErr = async (e: any, reason?: 'storage_undefined' | 'db_corrupted' | 'db_denied' | 'db_failed') => {
    if (!reason) {
      if (e instanceof StoreCorruptedError) {
        reason = 'db_corrupted';
      } else if (e instanceof StoreDeniedError) {
        reason = 'db_denied';
      } else if (e instanceof StoreFailedError) {
        reason = 'db_failed';
      } else {
        Catch.reportErr(e);
        reason = 'db_failed';
      }
    }
    await chrome.tabs.create({ url: Url.create('fatal.htm', { reason, stack: e instanceof Error ? e.stack : Catch.stackTrace() }) });
    throw new UnreportableError();
  }

}
