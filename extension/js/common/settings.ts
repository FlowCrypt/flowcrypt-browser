/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store, KeyInfo } from './store.js';
import { Value, Str, Dict } from './common.js';
import { Xss, Ui, Env, UrlParams, JQS } from './browser.js';
import { BrowserMsg } from './extension.js';
import { Lang } from './lang.js';
import { Rules } from './rules.js';
import { Api } from './api/api.js';
import { Pgp } from './pgp.js';
import { Catch, UnreportableError } from './catch.js';
import { Google, GoogleAuth } from './api/google.js';

declare const openpgp: typeof OpenPGP;
declare const zxcvbn: Function; // tslint:disable-line:ban-types

export class Settings {

  private static ignoreEmailAliases = ['nobody@google.com'];

  static fetchAcctAliasesFromGmail = async (acctEmail: string) => {
    let query = 'newer_than:1y in:sent -from:"calendar-notification@google.com" -from:"drive-shares-noreply@google.com"';
    const results = [];
    while (true) {
      const headers = await Google.gmail.fetchMsgsBasedOnQueryAndExtractFirstAvailableHeader(acctEmail, query, ['from']);
      if (!headers.from) {
        return results.filter(email => !Value.is(email).in(Settings.ignoreEmailAliases));
      }
      results.push(Str.parseEmail(headers.from).email);
      query += ' -from:"' + Str.parseEmail(headers.from).email + '"';
    }
  }

  static evalPasswordStrength = (passphrase: string) => {
    return Pgp.password.estimateStrength(zxcvbn(passphrase, Pgp.password.weakWords()).guesses); // tslint:disable-line:no-unsafe-any
  }

  static renderPasswordStrength = (parentSel: string, inputSel: string, buttonSel: string) => {
    parentSel += ' ';
    const password = $(parentSel + inputSel).val();
    if (typeof password !== 'string') {
      Catch.report('render_password_strength: Selected password is not a string', typeof password);
      return;
    }
    const result = Settings.evalPasswordStrength(password);
    $(parentSel + '.password_feedback').css('display', 'block');
    $(parentSel + '.password_bar > div').css('width', result.word.bar + '%');
    $(parentSel + '.password_bar > div').css('background-color', result.word.color);
    $(parentSel + '.password_result, .password_time').css('color', result.word.color);
    $(parentSel + '.password_result').text(result.word.word);
    $(parentSel + '.password_time').text(result.time);
    if (result.word.pass) {
      $(parentSel + buttonSel).removeClass('gray');
      $(parentSel + buttonSel).addClass('green');
    } else {
      $(parentSel + buttonSel).removeClass('green');
      $(parentSel + buttonSel).addClass('gray');
    }
  }

  static saveAttestReq = async (acctEmail: string, attester: string) => {
    const storage = await Store.getAcct(acctEmail, ['attests_requested', 'attests_processed']);
    if (typeof storage.attests_requested === 'undefined') {
      storage.attests_requested = [attester];
    } else if (!Value.is(attester).in(storage.attests_requested)) {
      storage.attests_requested.push(attester); // insert into requests if not already there
    }
    if (typeof storage.attests_processed === 'undefined') {
      storage.attests_processed = [];
    }
    await Store.setAcct(acctEmail, storage);
    BrowserMsg.send.bg.attestRequested({ acctEmail });
  }

  static markAsAttested = async (acctEmail: string, attester: string) => {
    const storage = await Store.getAcct(acctEmail, ['attests_requested', 'attests_processed']);
    if (typeof storage.attests_requested === 'undefined') {
      storage.attests_requested = [];
    } else if (Value.is(attester).in(storage.attests_requested)) {
      storage.attests_requested.splice(storage.attests_requested.indexOf(attester), 1); // remove attester from requested
    }
    if (typeof storage.attests_processed === 'undefined') {
      storage.attests_processed = [attester];
    } else if (!Value.is(attester).in(storage.attests_processed)) {
      storage.attests_processed.push(attester); // add attester as processed if not already there
    }
    await Store.setAcct(acctEmail, storage);
  }

  static submitPubkeys = async (acctEmail: string, addresses: string[], pubkey: string) => {
    const attestResp = await Api.attester.initialLegacySubmit(acctEmail, pubkey, true);
    if (!attestResp.attested) {
      await Settings.saveAttestReq(acctEmail, 'CRYPTUP');
    } else { // Attester claims it was previously successfully attested
      await Settings.markAsAttested(acctEmail, 'CRYPTUP');
    }
    const aliases = addresses.filter(a => a !== acctEmail);
    if (aliases.length) {
      await Promise.all(aliases.map(a => Api.attester.initialLegacySubmit(a, pubkey, false)));
    }
  }

  static openpgpKeyEncrypt = async (key: OpenPGP.key.Key, passphrase: string) => {
    if (!passphrase) {
      throw new Error("Encryption passphrase should not be empty");
    }
    await key.encrypt(passphrase);
  }

  private static prepareNewSettingsLocationUrl = (acctEmail: string | null, parentTabId: string, page: string, addUrlTextOrParams: string | UrlParams | null = null): string => {
    const pageParams: UrlParams = { placement: 'settings', parentTabId };
    if (acctEmail) {
      pageParams.acctEmail = acctEmail;
    }
    if (typeof addUrlTextOrParams === 'object' && addUrlTextOrParams) { // it's a list of params - add them. It could also be a text - then it will be added the end of url below
      for (const k of Object.keys(addUrlTextOrParams)) {
        pageParams[k] = addUrlTextOrParams[k];
      }
      addUrlTextOrParams = null;
    }
    return Env.urlCreate(page, pageParams) + (addUrlTextOrParams || '');
  }

  static renderSubPage = (acctEmail: string | null, tabId: string, page: string, addUrlTextOrParams: string | UrlParams | null = null) => {
    let newLocation = Settings.prepareNewSettingsLocationUrl(acctEmail, tabId, page, addUrlTextOrParams);
    let iframeWidth, iframeHeight, variant, closeOnClick;
    if (page !== '/chrome/elements/compose.htm') {
      iframeWidth = Math.min(800, $('body').width()! - 200);
      iframeHeight = $('body').height()! - ($('body').height()! > 800 ? 150 : 75);
      variant = null;
      closeOnClick = 'background';
    } else { // todo - deprecate this
      iframeWidth = 542;
      iframeHeight = Math.min(600, $('body').height()! - 150);
      variant = 'new_message_featherlight';
      closeOnClick = false;
      newLocation += `&frameId=${Str.sloppyRandom(5)}`; // does not get added to <iframe>
    }
    ($ as JQS).featherlight({ closeOnClick, iframe: newLocation, iframeWidth, iframeHeight, variant });
    // todo - deprecate this
    Xss.sanitizePrepend('.new_message_featherlight .featherlight-content', '<div class="line">You can also send encrypted messages directly from Gmail.<br/><br/></div>');

  }

  static redirectSubPage = (acctEmail: string, parentTabId: string, page: string, addUrlTextOrParams?: string | UrlParams) => {
    const newLocation = Settings.prepareNewSettingsLocationUrl(acctEmail, parentTabId, page, addUrlTextOrParams);
    if (Boolean(Env.urlParams(['embedded']).embedded)) { // embedded on the main page
      BrowserMsg.send.openPage(parentTabId, { page, addUrlText: addUrlTextOrParams });
    } else { // on a sub page/module page, inside a lightbox. Just change location.
      window.location.href = newLocation;
    }
  }

  static refreshAcctAliases = async (acctEmail: string) => {
    const addresses = await Settings.fetchAcctAliasesFromGmail(acctEmail);
    const all = Value.arr.unique(addresses.concat(acctEmail));
    await Store.setAcct(acctEmail, { addresses: all });
    return all;
  }

  static acctStorageReset = (acctEmail: string) => new Promise(async (resolve, reject) => {
    if (!acctEmail) {
      throw new Error('Missing account_email to reset');
    }
    const acctEmails = await Store.acctEmailsGet();
    if (!Value.is(acctEmail).in(acctEmails)) {
      throw new Error(`"${acctEmail}" is not a known account_email in "${JSON.stringify(acctEmails)}"`);
    }
    const storageIndexesToRemove: string[] = [];
    const filter = Store.singleScopeRawIndex(acctEmail, '');
    if (!filter) {
      throw new Error('Filter is empty for account_email"' + acctEmail + '"');
    }
    chrome.storage.local.get(async storage => {
      try {
        for (const storageIndex of Object.keys(storage)) {
          if (storageIndex.indexOf(filter) === 0) {
            storageIndexesToRemove.push(storageIndex.replace(filter, ''));
          }
        }
        await Store.remove(acctEmail, storageIndexesToRemove);
        for (const sessionStorageIndex of Object.keys(sessionStorage)) {
          if (sessionStorageIndex.indexOf(filter) === 0) {
            sessionStorage.removeItem(sessionStorageIndex);
          }
        }
        resolve();
      } catch (e) {
        reject(e);
      }
    });
  })

  static acctStorageChangeEmail = (oldAcctEmail: string, newAcctEmail: string) => new Promise(async (resolve, reject) => {
    if (!oldAcctEmail || !newAcctEmail || !Str.isEmailValid(newAcctEmail)) {
      throw new Error('Missing or wrong account_email to reset');
    }
    const acctEmails = await Store.acctEmailsGet();
    if (!Value.is(oldAcctEmail).in(acctEmails)) {
      throw new Error(`"${oldAcctEmail}" is not a known account_email in "${JSON.stringify(acctEmails)}"`);
    }
    const storageIndexesToChange: string[] = [];
    const oldAcctEmailIndexPrefix = Store.singleScopeRawIndex(oldAcctEmail, '');
    const newAcctEmailIndexPrefix = Store.singleScopeRawIndex(newAcctEmail, '');
    // in case the destination email address was already set up with an account, recover keys and pass phrases before it's overwritten
    const destAccountPrivateKeys = await Store.keysGet(newAcctEmail);
    const destAcctPassPhrases: Dict<string> = {};
    for (const ki of destAccountPrivateKeys) {
      const pp = await Store.passphraseGet(newAcctEmail, ki.longid, true);
      if (pp) {
        destAcctPassPhrases[ki.longid] = pp;
      }
    }
    if (!oldAcctEmailIndexPrefix) {
      throw new Error(`Filter is empty for account_email "${oldAcctEmail}"`);
    }
    await Store.acctEmailsAdd(newAcctEmail);
    chrome.storage.local.get(async storage => {
      try {
        for (const key of Object.keys(storage)) {
          if (key.indexOf(oldAcctEmailIndexPrefix) === 0) {
            storageIndexesToChange.push(key.replace(oldAcctEmailIndexPrefix, ''));
          }
        }
        const oldAcctStorage = await Store.getAcct(oldAcctEmail, storageIndexesToChange as any);
        await Store.setAcct(newAcctEmail, oldAcctStorage);
        for (const sessionStorageIndex of Object.keys(sessionStorage)) {
          if (sessionStorageIndex.indexOf(oldAcctEmailIndexPrefix) === 0) {
            const v = sessionStorage.getItem(sessionStorageIndex);
            sessionStorage.setItem(sessionStorageIndex.replace(oldAcctEmailIndexPrefix, newAcctEmailIndexPrefix), v!);
            sessionStorage.removeItem(sessionStorageIndex);
          }
        }
        for (const ki of destAccountPrivateKeys) {
          await Store.keysAdd(newAcctEmail, ki.private);
        }
        for (const longid of Object.keys(destAcctPassPhrases)) {
          await Store.passphraseSave('local', newAcctEmail, longid, destAcctPassPhrases[longid]);
        }
        await Settings.acctStorageReset(oldAcctEmail);
        await Store.acctEmailsRemove(oldAcctEmail);
        resolve();
      } catch (e) {
        reject(e);
      }
    });
  })

  static renderPrvCompatFixUiAndWaitTilSubmittedByUser = (
    acctEmail: string, container: string | JQuery<HTMLElement>, origPrv: OpenPGP.key.Key, passphrase: string, backUrl: string
  ): Promise<OpenPGP.key.Key> => {
    return new Promise((resolve, reject) => {
      const uids = origPrv.users.map(u => u.userId).filter(u => u !== null && u.userid && Str.isEmailValid(Str.parseEmail(u.userid).email)).map(u => u!.userid) as string[];
      if (!uids.length) {
        uids.push(acctEmail);
      }
      container = $(container as JQuery<HTMLElement>); // due to JQuery TS quirk
      Xss.sanitizeRender(container, [
        `<div class="line">${Lang.setup.prvHasFixableCompatIssue}</div>`,
        '<div class="line compatibility_fix_user_ids">' + uids.map(uid => '<div>' + Xss.escape(uid) + '</div>').join('') + '</div>',
        '<div class="line">',
        '  Choose expiration of updated key',
        '  <select class="input_fix_expire_years" data-test="input-compatibility-fix-expire-years">',
        '    <option  value="" disabled selected>please choose expiration</option>',
        '    <option value="never">no expiration</option>',
        '    <option value="1">1 year</option>',
        '    <option value="2">2 years</option>',
        '    <option value="3">3 years</option>',
        '    <option value="5">5 years</option>',
        '  </select>',
        '</div>',
        '<div class="line">FlowCrypt will attempt to update the key before importing.</div>',
        '<div class="line">',
        '  <div class="button long gray action_fix_compatibility" data-test="action-fix-and-import-key">UPDATE AND IMPORT KEY</div>',
        '</div>',
      ].join('\n'));
      container.find('select.input_fix_expire_years').change(Ui.event.handle(target => {
        if ($(target).val()) {
          (container as JQuery<HTMLElement>).find('.action_fix_compatibility').removeClass('gray').addClass('green');
        } else {
          (container as JQuery<HTMLElement>).find('.action_fix_compatibility').removeClass('green').addClass('gray');
        }
      }));
      container.find('.action_fix_compatibility').click(Ui.event.handle(async target => {
        const expireYears = $(target).parents(container as string).find('select.input_fix_expire_years').val() as string; // JQuery quirk
        if (!expireYears) {
          alert('Please select key expiration');
        } else {
          $(target).off();
          Xss.sanitizeRender(target, Ui.spinner('white'));
          const expireSeconds = (expireYears === 'never') ? 0 : Math.floor((Date.now() - origPrv.primaryKey.created.getTime()) / 1000) + (60 * 60 * 24 * 365 * Number(expireYears));
          await Pgp.key.decrypt(origPrv, [passphrase]);
          let reformatted;
          const userIds = uids.map(uid => Str.parseEmail(uid)).map(u => ({ email: u.email, name: u.name || '' }));
          try {
            reformatted = await openpgp.reformatKey({ privateKey: origPrv, passphrase, userIds, keyExpirationTime: expireSeconds }) as { key: OpenPGP.key.Key };
          } catch (e) {
            reject(e);
            return;
          }
          if (reformatted.key.isDecrypted()) {
            await reformatted.key.encrypt(passphrase); // this is a security precaution, in case OpenPGP.js library changes in the future
          }
          if (await reformatted.key.getEncryptionKey()) {
            resolve(reformatted.key);
          } else {
            alert('Key update: Key still cannot be used for encryption. This looks like a compatibility issue.\n\nPlease write us at human@flowcrypt.com. We are VERY prompt to respond.');
            Xss.sanitizeReplace(target, Ui.e('a', { href: backUrl, text: 'Go back and try something else' }));
          }
        }
      }));
    });
  }

  static abortAndRenderErrorIfKeyinfoEmpty = (ki: KeyInfo | undefined, doThrow: boolean = true) => {
    if (!ki) {
      const msg = 'Cannot find primary key. Is FlowCrypt not set up yet?';
      Xss.sanitizeRender('#content', `${msg} ${Ui.retryLink()}`);
      if (doThrow) {
        throw new UnreportableError(msg);
      }
    }
  }

  static promptToRetry = async (type: 'REQUIRED', e: any, userMsg: string, retryCb: () => Promise<void>): Promise<void> => {
    // todo - his needs to be refactored, hard to follow, hard to use
    // |'OPTIONAL' - needs to be tested again
    if (!Api.err.isNetErr(e)) {
      Catch.handleErr(e);
    }
    while (await Ui.renderOverlayPromptAwaitUserChoice({ retry: {} }, userMsg) === 'retry') {
      try {
        return await retryCb();
      } catch (e2) {
        if (!Api.err.isNetErr(e2)) {
          Catch.handleErr(e2);
        }
      }
    }
    // pressing retry button causes to get stuck in while loop until success, at which point it returns, or until user closes tab
    // if it got down here, user has chosen 'skip'. This option is only available on 'OPTIONAL' type
    // if the error happens again, op will be skipped
    return await retryCb();
  }

  static forbidAndRefreshPageIfCannot = (action: 'CREATE_KEYS' | 'BACKUP_KEYS', rules: Rules) => {
    if (action === 'CREATE_KEYS' && !rules.canCreateKeys()) {
      alert(Lang.setup.creatingKeysNotAllowedPleaseImport);
      window.location.reload();
      throw Error('creating_keys_not_allowed_please_import');
    } else if (action === 'BACKUP_KEYS' && !rules.canBackupKeys()) {
      alert(Lang.setup.keyBackupsNotAllowed);
      window.location.reload();
      throw Error('key_backups_not_allowed');
    }
  }

  static newGoogleAcctAuthPrompt = async (tabId: string, acctEmail?: string, omitReadScope = false) => {
    const response = await GoogleAuth.newAuthPopup({ acctEmail: acctEmail || null, omitReadScope });
    if (response && response.result === 'Success' && response.acctEmail) {
      await Store.acctEmailsAdd(response.acctEmail);
      const storage = await Store.getAcct(response.acctEmail, ['setup_done']);
      if (storage.setup_done) { // this was just an additional permission
        alert('You\'re all set.');
        window.location.href = Env.urlCreate('/chrome/settings/index.htm', { acctEmail: response.acctEmail });
      } else {
        await Store.setAcct(response.acctEmail, { email_provider: 'gmail' });
        window.location.href = Env.urlCreate('/chrome/settings/setup.htm', { acctEmail: response.acctEmail });
      }
    } else if (response && ((response.result === 'Denied' && response.error === 'access_denied') || response.result === 'Closed')) {
      Settings.renderSubPage(acctEmail || null, tabId, '/chrome/settings/modules/auth_denied.htm');
    } else {
      Catch.log('failed to log into google', response);
      alert('Failed to connect to Gmail. Please try again. If this happens repeatedly, please write us at human@flowcrypt.com to fix it.');
      window.location.reload();
    }
  }

  static updateProfilePicIfMissing = async (acctEmail: string) => {
    const storage = await Store.getAcct(acctEmail, ['setup_done', 'picture']);
    if (storage.setup_done && !storage.picture) {
      try {
        const { image } = await Google.google.plus.peopleMe(acctEmail);
        await Store.setAcct(acctEmail, { picture: image.url });
      } catch (e) {
        if (!Api.err.isAuthPopupNeeded(e) && !Api.err.isAuthErr(e) && !Api.err.isNetErr(e)) {
          Catch.handleErr(e);
        }
      }
    }
  }

}
