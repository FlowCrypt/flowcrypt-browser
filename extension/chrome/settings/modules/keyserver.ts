/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Dict, Url } from '../../../js/common/core/common.js';

import { ApiErr } from '../../../js/common/api/error/api-error.js';
import { Assert } from '../../../js/common/assert.js';
import { BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { Lang } from '../../../js/common/lang.js';
import { PgpKey } from '../../../js/common/core/crypto/pubkey.js';
import { Settings } from '../../../js/common/settings.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { View } from '../../../js/common/view.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { PubLookup } from '../../../js/common/api/pub-lookup.js';
import { OrgRules } from '../../../js/common/org-rules.js';
import { KeyStore } from '../../../js/common/platform/store/key-store.js';
import { AcctStore } from '../../../js/common/platform/store/acct-store.js';

type AttesterKeyserverDiagnosis = { hasPubkeyMissing: boolean, hasPubkeyMismatch: boolean, results: Dict<{ pubkey?: string, match: boolean }> };

View.run(class KeyserverView extends View {

  private acctEmail: string;
  private parentTabId: string;
  private pubLookup!: PubLookup;
  private orgRules!: OrgRules;

  constructor() {
    super();
    const uncheckedUrlParams = Url.parse(['acctEmail', 'parentTabId']);
    this.acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
    this.parentTabId = Assert.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');
  }

  public render = async () => {
    this.orgRules = await OrgRules.newInstance(this.acctEmail);
    this.pubLookup = new PubLookup(this.orgRules);
    $('.email-address').text(this.acctEmail);
    Xss.sanitizeRender('.summary', '<br><br><br><br>Loading from keyserver<br><br>' + Ui.spinner('green'));
    (async () => {
      const isRefreshed = await Settings.refreshSendAs(this.acctEmail);
      if (isRefreshed && await Ui.modal.confirm(Lang.general.emailAliasChangedAskForReload)) {
        window.location.reload();
      }
    })().catch(ApiErr.reportIfSignificant);
    const diagnosis = await this.diagnoseKeyserverPubkeys();
    $('.summary').text('');
    for (const email of Object.keys(diagnosis.results)) {
      const result = diagnosis.results[email];
      let note, action, color;
      if (!result.pubkey) {
        note = 'Missing record. Your contacts will not know you have encryption set up.';
        action = `<button class="button gray2 small action_submit_key" data-test="action-submit-pub" email="${Xss.escape(email)}">Submit public key</button>`;
        color = 'orange';
      } else if (result.match) {
        note = 'Submitted correctly, can receive encrypted email.';
        action = '';
        color = 'green';
      } else {
        note = 'Wrong public key recorded. Your incoming email may be unreadable when encrypted.';
        // todo - pass public key and email in
        action = `<button class="button gray2 small action_replace_pubkey" email="${Xss.escape(email)}">Correct public records</button>`;
        color = 'red';
      }
      Xss.sanitizeAppend('#content', `<div class="line left">${Xss.escape(email)}: <span class="${color}">${note}</span> ${action}</div>`);
    }
  }

  public setHandlers = () => {
    $('.action_submit_key').click(this.setHandlerPrevent('double', this.submitPublicKeyHandler));
    $('.action_replace_pubkey').click(this.setHandlerPrevent('double', this.replacePublicKeyHandler));
  }

  // -- PRIVATE

  private submitPublicKeyHandler = async (target: HTMLElement) => {
    if (!this.orgRules.canSubmitPubToAttester()) {
      return await Ui.modal.error('Disallowed by your organisation rules');
    }
    Xss.sanitizeRender(target, Ui.spinner('white'));
    const [primaryKi] = await KeyStore.get(this.acctEmail, ['primary']);
    Assert.abortAndRenderErrorIfKeyinfoEmpty(primaryKi);
    try {
      await this.pubLookup.attester.initialLegacySubmit(String($(target).attr('email')), primaryKi.public);
    } catch (e) {
      ApiErr.reportIfSignificant(e);
      await Ui.modal.error(ApiErr.eli5(e));
    } finally {
      window.location.reload();
    }
  }

  private replacePublicKeyHandler = async (target: HTMLElement) => {
    if (!this.orgRules.canSubmitPubToAttester()) {
      return await Ui.modal.error('Disallowed by your organisation rules');
    }
    Xss.sanitizeRender(target, Ui.spinner('white'));
    const [primaryKi] = await KeyStore.get(this.acctEmail, ['primary']);
    Assert.abortAndRenderErrorIfKeyinfoEmpty(primaryKi);
    try {
      const responseText = await this.pubLookup.attester.replacePubkey(String($(target).attr('email')), primaryKi.public);
      await Ui.modal.info(responseText);
      BrowserMsg.send.closePage(this.parentTabId);
    } catch (e) {
      ApiErr.reportIfSignificant(e);
      await Ui.modal.error(ApiErr.eli5(e));
      window.location.reload();
    }
  }

  private diagnoseKeyserverPubkeys = async (): Promise<AttesterKeyserverDiagnosis> => {
    const diagnosis: AttesterKeyserverDiagnosis = { hasPubkeyMissing: false, hasPubkeyMismatch: false, results: {} };
    const { sendAs } = await AcctStore.get(this.acctEmail, ['sendAs']);
    const storedKeys = await KeyStore.get(this.acctEmail);
    const storedKeysLongids = storedKeys.map(ki => ki.longid);
    const results = await this.pubLookup.attester.lookupEmails(sendAs ? Object.keys(sendAs) : [this.acctEmail]);
    for (const email of Object.keys(results)) {
      const pubkeySearchResult = results[email];
      if (!pubkeySearchResult.pubkey) {
        diagnosis.hasPubkeyMissing = true;
        diagnosis.results[email] = { pubkey: undefined, match: false };
      } else {
        let match = true;
        if (!storedKeysLongids.includes(String(await PgpKey.longid(pubkeySearchResult.pubkey)))) {
          diagnosis.hasPubkeyMismatch = true;
          match = false;
        }
        diagnosis.results[email] = { pubkey: pubkeySearchResult.pubkey, match };
      }
    }
    return diagnosis;
  }

});
