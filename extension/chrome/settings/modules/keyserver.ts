/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch } from '../../../js/common/platform/catch.js';
import { Store } from '../../../js/common/platform/store.js';
import { Value, Dict } from '../../../js/common/core/common.js';
import { Ui, Env } from '../../../js/common/browser.js';
import { BrowserMsg } from '../../../js/common/extension.js';
import { Settings } from '../../../js/common/settings.js';
import { Api } from '../../../js/common/api/api.js';
import { Attester } from '../../../js/common/api/attester.js';
import { Pgp } from '../../../js/common/core/pgp.js';
import { Assert } from '../../../js/common/assert.js';
import { Xss } from '../../../js/common/platform/xss.js';

type AttKeyserverDiagnosis = { hasPubkeyMissing: boolean, hasPubkeyMismatch: boolean, results: Dict<{ pubkey?: string, match: boolean }> };

Catch.try(async () => {

  const uncheckedUrlParams = Env.urlParams(['acctEmail', 'parentTabId']);
  const acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
  const parentTabId = Assert.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');

  $('.email-address').text(acctEmail);

  Xss.sanitizeRender('.summary', '<br><br><br><br>Loading from keyserver<br><br>' + Ui.spinner('green'));

  const diagnoseKeyserverPubkeys = async (acctEmail: string): Promise<AttKeyserverDiagnosis> => {
    const diagnosis: AttKeyserverDiagnosis = { hasPubkeyMissing: false, hasPubkeyMismatch: false, results: {} };
    const { addresses } = await Store.getAcct(acctEmail, ['addresses']);
    const storedKeys = await Store.keysGet(acctEmail);
    const storedKeysLongids = storedKeys.map(ki => ki.longid);
    const results = await Attester.lookupEmails(Value.arr.unique([acctEmail].concat(addresses || [])));
    for (const email of Object.keys(results)) {
      const pubkeySearchResult = results[email];
      if (!pubkeySearchResult.pubkey) {
        diagnosis.hasPubkeyMissing = true;
        diagnosis.results[email] = { pubkey: undefined, match: false };
      } else {
        let match = true;
        if (!storedKeysLongids.includes(String(await Pgp.key.longid(pubkeySearchResult.pubkey)))) {
          diagnosis.hasPubkeyMismatch = true;
          match = false;
        }
        diagnosis.results[email] = { pubkey: pubkeySearchResult.pubkey, match };
      }
    }
    return diagnosis;
  };

  const renderDiagnosis = (diagnosis: AttKeyserverDiagnosis) => {
    for (const email of Object.keys(diagnosis.results)) {
      const result = diagnosis.results[email];
      let note, action, remove, color;
      if (!result.pubkey) {
        note = 'Missing record. Your contacts will not know you have encryption set up.';
        action = `<div class="button gray2 small action_submit_key" email="${Xss.escape(email)}">Submit public key</div>`;
        if (email === acctEmail) {
          remove = '';
        } else {
          // todo - allow removing email even if pubkey submitted
          // part of the process should be sending user to the takedown link
          remove = ` &nbsp; <b class="bad action_remove_alias" email="${Xss.escape(email)}" title="Remove address from list of send-from addresses.">[x]</b> &nbsp; `;
        }
        color = 'orange';
      } else if (result.match) {
        note = 'Submitted correctly, can receive encrypted email.';
        action = '';
        remove = '';
        color = 'green';
      } else {
        note = 'Wrong public key recorded. Your incoming email may be unreadable when encrypted.';
        // todo - pass public key and email in
        action = `<div class="button gray2 small action_replace_pubkey" email="${Xss.escape(email)}">Correct public records</a>`;
        remove = '';
        color = 'red';
      }
      Xss.sanitizeAppend('#content', `<div class="line left">${Xss.escape(email)}: <span class="${color}">${note}</span> ${remove} ${action}</div>`);
    }

    $('.action_submit_key').click(Ui.event.prevent('double', async self => {
      Xss.sanitizeRender(self, Ui.spinner('white'));
      const [primaryKi] = await Store.keysGet(acctEmail, ['primary']);
      Assert.abortAndRenderErrorIfKeyinfoEmpty(primaryKi);
      try {
        await Attester.initialLegacySubmit(String($(self).attr('email')), primaryKi.public);
      } catch (e) {
        if (Api.err.isSignificant(e)) {
          Catch.reportErr(e);
        }
        await Ui.modal.error(Api.err.eli5(e));
      } finally {
        window.location.reload();
      }
    }));

    $('.action_replace_pubkey').click(Ui.event.prevent('double', async self => {
      Xss.sanitizeRender(self, Ui.spinner('white'));
      const [primaryKi] = await Store.keysGet(acctEmail, ['primary']);
      Assert.abortAndRenderErrorIfKeyinfoEmpty(primaryKi);
      try {
        const responseText = await Attester.replacePubkey(String($(self).attr('email')), primaryKi.public);
        await Ui.modal.info(responseText);
        BrowserMsg.send.closePage(parentTabId);
      } catch (e) {
        if (Api.err.isSignificant(e)) {
          Catch.reportErr(e);
        }
        await Ui.modal.error(Api.err.eli5(e));
        window.location.reload();
      }
    }));

    $('.action_remove_alias').click(Ui.event.prevent('double', async self => {
      const { addresses } = await Store.getAcct(acctEmail, ['addresses']);
      await Store.setAcct(acctEmail, { 'addresses': Value.arr.withoutVal(addresses || [], $(self).attr('email')!) });
      window.location.reload();
    }));

    const contentEl = Xss.sanitizeAppend('#content', '<div class="line"><a href="#" class="action_fetch_aliases">Missing email address? Refresh list</a></div>');
    contentEl.find('.action_fetch_aliases').click(Ui.event.prevent('parallel', async (self, done) => {
      Xss.sanitizeRender(self, Ui.spinner('green'));
      try {
        const addresses = await Settings.fetchAcctAliasesFromGmail(acctEmail);
        await Store.setAcct(acctEmail, { addresses: Value.arr.unique(addresses.concat(acctEmail)) });
      } catch (e) {
        if (Api.err.isNetErr(e)) {
          await Ui.modal.warning('Need internet connection to finish. Please click the button again to retry.');
        } else if (parentTabId && Api.err.isAuthPopupNeeded(e)) {
          BrowserMsg.send.notificationShowAuthPopupNeeded(parentTabId, { acctEmail });
          await Ui.modal.warning('Account needs to be re-connected first. Please try later.');
        } else {
          Catch.reportErr(e);
          await Ui.modal.error(`Error happened: ${String(e)}`);
        }
      }
      window.location.reload();
      done();
    }));
  };

  try {
    const diagnosis = await diagnoseKeyserverPubkeys(acctEmail);
    $('.summary').text('');
    renderDiagnosis(diagnosis);
  } catch (e) {
    if (!Api.err.isSignificant(e)) {
      Xss.sanitizeRender('.summary', `Failed to load due to internet connection. ${Ui.retryLink()}`);
    } else {
      Xss.sanitizeRender('.summary', `Failed to load. ${Ui.retryLink()}`);
      Catch.reportErr(e);
    }
  }

})();
