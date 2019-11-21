/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch } from '../common/platform/catch.js';
import { Store } from '../common/platform/store.js';
import { Api } from '../common/api/api.js';
import { Pgp } from '../common/core/pgp.js';
import { Attester } from '../common/api/attester.js';

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
  updateAcctInfo().catch(reportSignificantErrs); // update local info about keyserver status of user keys
};

const updateAcctInfo = async () => {
  for (const acctEmail of await Store.acctEmailsGet()) {
    await accountUpdateStatusKeyserver(acctEmail);
  }
};

const accountUpdateStatusKeyserver = async (acctEmail: string) => { // checks which emails were registered on Attester
  const keyinfos = await Store.keysGet(acctEmail);
  const myLongids = keyinfos.map(ki => ki.longid);
  const storage = await Store.getAcct(acctEmail, ['sendAs', 'addresses_keyserver']);
  if (storage.sendAs) {
    const addresses = Object.keys(storage.sendAs);
    if (addresses.length) {
      try {
        const lookupEmailsRes = await Attester.lookupEmails(addresses);
        const addressesKeyserver = [];
        for (const email of Object.keys(lookupEmailsRes)) {
          const result = lookupEmailsRes[email];
          if (result && result.pubkey && myLongids.includes(String(await Pgp.key.longid(result.pubkey)))) {
            addressesKeyserver.push(email);
          }
        }
        await Store.setAcct(acctEmail, { addresses_keyserver: addressesKeyserver });
      } catch (e) {
        reportSignificantErrs(e);
      }
    }
  }
};

const reportSignificantErrs = (e: any) => {
  if (Api.err.isSignificant(e)) {
    Catch.reportErr(e);
  }
};
