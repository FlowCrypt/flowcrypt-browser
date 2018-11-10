/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store } from '../../../js/common/store.js';
import { Value } from '../../../js/common/common.js';
import { Xss, Ui, Env } from '../../../js/common/browser.js';
import { BrowserMsg } from '../../../js/common/extension.js';
import { Settings } from '../../../js/common/settings.js';
import { Api, R } from '../../../js/common/api.js';
import { Catch } from '../../../js/common/catch.js';

Catch.try(async () => {

  const urlParams = Env.urlParams(['acctEmail', 'parentTabId']);
  const acctEmail = Env.urlParamRequire.string(urlParams, 'acctEmail');
  const parentTabId = Env.urlParamRequire.string(urlParams, 'parentTabId');

  $('.email-address').text(acctEmail);

  Xss.sanitizeRender('.summary', '<br><br><br><br>Loading from keyserver<br><br>' + Ui.spinner('green'));

  const renderDiagnosis = (diagnosis: R.AttKeyserverDiagnosis, attestsRequested: string[]) => {
    for (const email of Object.keys(diagnosis.results)) {
      const result = diagnosis.results[email];
      let note, action, remove, color;
      if (result.pubkey === null) {
        note = 'Missing record. Your contacts will not know you have encryption set up.';
        action = `<div class="button gray2 small action_request_attestation" email="${Xss.escape(email)}">Submit public key</div>`;
        remove = ` &nbsp; <b class="bad action_remove_alias" email="${Xss.escape(email)}" title="Remove address from list of send-from addresses.">[x]</b> &nbsp; `;
        color = 'orange';
      } else if (result.match) {
        if (email === acctEmail && !result.attested) {
          if (attestsRequested && attestsRequested.length) {
            note = `Submitted. Attestation was requested from ${Xss.escape(attestsRequested.join(', '))} and should process shortly.`;
            action = `<div class="button gray2 small refresh_after_attest_request" email="${Xss.escape(email)}">Refresh</div>`;
            remove = '';
            color = 'orange';
          } else {
            note = 'Found but not attested.';
            action = `<div class="button gray2 small action_request_attestation" email="${Xss.escape(email)}">Request Attestation</div>`;
            remove = '';
            color = 'orange';
          }
        } else if (email === acctEmail && result.attested) {
          note = 'Submitted, can receive encrypted email. Attested by CRYPTUP.';
          action = '';
          remove = '';
          color = 'green';
        } else {
          note = 'Submitted, can receive encrypted email.';
          action = '';
          remove = '';
          color = 'green';
        }
      } else {
        if (email === acctEmail && !result.attested) {
          note = 'Wrong public key recorded. Your incoming email may be unreadable when encrypted.';
          action = `<div class="button gray2 small action_request_attestation" email="${Xss.escape(email)}">Request Attestation</div>`;
          remove = '';
          color = 'red';
        } else if (email === acctEmail && result.attested && attestsRequested && attestsRequested.length) {
          note = 'Re-Attestation requested. This should process shortly.';
          action = `<div class="button gray2 small refresh_after_attest_request" email="${Xss.escape(email)}">Refresh</div>`;
          remove = '';
          color = 'orange';
        } else if (email === acctEmail && result.attested) {
          note = 'Wrong public key recorded. Your incoming email may be unreadable when encrypted.';
          action = `<div class="button gray2 small request_replacement" email="${Xss.escape(email)}">Request Replacement Attestation</div>`;
          remove = '';
          color = 'red';
        } else {
          note = 'Wrong public key recorded. Your incoming email may be unreadable when encrypted.';
          action = '';
          remove = '';
          color = 'red';
        }
      }
      Xss.sanitizeAppend('#content', `<div class="line left">${Xss.escape(email)}: <span class="${color}">${note}</span> ${remove} ${action}</div>`);
    }

    $('.action_request_attestation').click(Ui.event.prevent('double', async self => {
      Xss.sanitizeRender(self, Ui.spinner('white'));
      await actionSubmitOrReqAttestation($(self).attr('email')!);
    }));
    $('.action_remove_alias').click(Ui.event.prevent('double', async self => {
      const { addresses } = await Store.getAcct(acctEmail, ['addresses']);
      await Store.setAcct(acctEmail, { 'addresses': Value.arr.withoutVal(addresses || [], $(self).attr('email')!) });
      window.location.reload();
    }));
    $('.request_replacement').click(Ui.event.prevent('double', self => {
      Xss.sanitizeRender(self, Ui.spinner('white'));
      Settings.redirectSubPage(acctEmail, parentTabId, '/chrome/settings/modules/request_replacement.htm');
    }));
    $('.refresh_after_attest_request').click(Ui.event.prevent('double', async self => {
      Xss.sanitizeRender(self, 'Updating..' + Ui.spinner('white'));
      BrowserMsg.send.bg.attestRequested({ acctEmail });
      await Ui.time.sleep(30000);
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
          alert('Need internet connection to finish. Please click the button again to retry.');
        } else if (parentTabId && Api.err.isAuthPopupNeeded(e)) {
          BrowserMsg.send.notificationShowAuthPopupNeeded(parentTabId, { acctEmail });
          alert('Account needs to be re-connected first. Please try later.');
        } else {
          Catch.handleErr(e);
          alert(`Error happened: ${String(e)}`);
        }
      }
      window.location.reload();
      done();
    }));
  };

  const actionSubmitOrReqAttestation = async (email: string) => {
    const [primaryKi] = await Store.keysGet(acctEmail, ['primary']);
    Settings.abortAndRenderErrorIfKeyinfoEmpty(primaryKi);
    try {
      if (email === acctEmail) { // request attestation
        await Settings.saveAttestReq(acctEmail, 'CRYPTUP');
        await Api.attester.initialLegacySubmit(email, primaryKi.public, true);
      } else { // submit only
        await Api.attester.initialLegacySubmit(email, primaryKi.public, false);
      }
    } catch (e) {
      Catch.handleErr(e);
    } finally {
      window.location.reload();
    }
  };

  const storage = await Store.getAcct(acctEmail, ['attests_requested', 'addresses']);
  try {
    const diagnosis = await Api.attester.diagnoseKeyserverPubkeys(acctEmail);
    $('.summary').text('');
    renderDiagnosis(diagnosis, storage.attests_requested || []);
  } catch (e) {
    if (Api.err.isNetErr(e)) {
      Xss.sanitizeRender('.summary', `Failed to load due to internet connection. ${Ui.retryLink()}`);
    } else {
      Xss.sanitizeRender('.summary', `Failed to load. ${Ui.retryLink()}`);
      Catch.handleErr(e);
    }
  }

})();
