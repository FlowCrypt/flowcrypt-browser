/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store } from '../common/platform/store.js';

export const migrateGlobal = async () => {
  const s = await Store.getGlobal(['cryptup_account_email', 'cryptup_account_uuid', 'cryptup_account_subscription']);
  if (s.cryptup_account_email) {
    // this migration should stay here until March 2019
    // there used to be one global account, as of Dec 2019 each is treated separately
    // if there is any account info stored globally, assign it to the appropriate account, then delete it from global storage
    const acctEmail = s.cryptup_account_email.toLowerCase().trim();
    await Store.setAcct(acctEmail, { uuid: s.cryptup_account_uuid || undefined, subscription: s.cryptup_account_subscription || undefined });
    await Store.removeGlobal(['cryptup_account_email', 'cryptup_account_uuid', 'cryptup_account_subscription']);
  }
};
