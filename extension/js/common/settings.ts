/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Dict, Str, Url, UrlParams } from './core/common.js';
import { Ui } from './browser/ui.js';
import { Api } from './api/api.js';
import { ApiErr } from './api/error/api-error.js';
import { ApiErrResponse } from './api/error/api-error-types.js';
import { Backend } from './api/backend.js';
import { Catch } from './platform/catch.js';
import { Env } from './browser/env.js';
import { Gmail } from './api/email-provider/gmail/gmail.js';
import { GoogleAuth } from './api/google-auth.js';
import { Lang } from './lang.js';
import { PgpKey, Pubkey } from './core/crypto/pubkey.js';
import { PgpPwd } from './core/crypto/pgp/pgp-password.js';
import { OrgRules } from './org-rules.js';
import { Xss } from './platform/xss.js';
import { storageLocalGetAll } from './api/chrome.js';
import { AcctStore, SendAsAlias } from './platform/store/acct-store.js';
import { GlobalStore } from './platform/store/global-store.js';
import { AbstractStore } from './platform/store/abstract-store.js';
import { KeyStore } from './platform/store/key-store.js';
import { PassphraseStore } from './platform/store/passphrase-store.js';

declare const zxcvbn: Function; // tslint:disable-line:ban-types

export class Settings {

  public static evalPasswordStrength = (passphrase: string, type: 'passphrase' | 'pwd' = 'passphrase') => {
    return PgpPwd.estimateStrength(zxcvbn(passphrase, PgpPwd.weakWords()).guesses, type); // tslint:disable-line:no-unsafe-any
  }

  public static renderSubPage = async (acctEmail: string | undefined, tabId: string, page: string, addUrlTextOrParams?: string | UrlParams) => {
    await Ui.modal.iframe(
      Settings.prepareNewSettingsLocationUrl(acctEmail, tabId, page, addUrlTextOrParams),
      Math.min(800, $('body').width()! - 200),
      $('body').height()! - ($('body').height()! > 800 ? 150 : 75)
    );
  }

  public static redirectSubPage = (acctEmail: string, parentTabId: string, page: string, addUrlTextOrParams?: string | UrlParams) => {
    window.location.href = Settings.prepareNewSettingsLocationUrl(acctEmail, parentTabId, page, addUrlTextOrParams);
  }

  public static refreshSendAs = async (acctEmail: string) => {
    const fetchedSendAs = await Settings.fetchAcctAliasesFromGmail(acctEmail);
    const result = { defaultEmailChanged: false, aliasesChanged: false, footerChanged: false, sendAs: fetchedSendAs };
    const { sendAs: storedSendAs } = await AcctStore.get(acctEmail, ['sendAs']);
    await AcctStore.set(acctEmail, { sendAs: fetchedSendAs });
    if (!storedSendAs) { // Aliases changed (it was previously undefined)
      result.aliasesChanged = true;
      return result;
    }
    if (Settings.getDefaultEmailAlias(fetchedSendAs) !== Settings.getDefaultEmailAlias(storedSendAs)) {
      result.defaultEmailChanged = true;
    }
    if (Object.keys(fetchedSendAs).sort().join(',') !== Object.keys(storedSendAs).sort().join(',')) {
      result.aliasesChanged = true;
    }
    const fetchedFooters = Object.keys(fetchedSendAs).sort().map(email => fetchedSendAs[email].footer).join('|');
    const storedFooters = Object.keys(storedSendAs).sort().map(email => storedSendAs[email].footer).join('|');
    if (fetchedFooters !== storedFooters) {
      result.footerChanged = true;
    }
    return result.aliasesChanged || result.defaultEmailChanged || result.footerChanged ? result : undefined;
  }

  public static acctStorageReset = async (acctEmail: string) => {
    if (!acctEmail) {
      throw new Error('Missing account_email to reset');
    }
    const acctEmails = await GlobalStore.acctEmailsGet();
    if (!acctEmails.includes(acctEmail)) {
      throw new Error(`"${acctEmail}" is not a known account_email in "${JSON.stringify(acctEmails)}"`);
    }
    const storageIndexesToRemove: string[] = [];
    const filter = AbstractStore.singleScopeRawIndex(acctEmail, '');
    if (!filter) {
      throw new Error('Filter is empty for account_email"' + acctEmail + '"');
    }
    return await new Promise((resolve, reject) => {
      chrome.storage.local.get(async storage => {
        try {
          for (const storageIndex of Object.keys(storage)) {
            if (storageIndex.indexOf(filter) === 0) {
              storageIndexesToRemove.push(storageIndex.replace(filter, ''));
            }
          }
          await AcctStore.remove(acctEmail, storageIndexesToRemove);
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
    });
  }

  public static acctStorageChangeEmail = async (oldAcctEmail: string, newAcctEmail: string) => {
    if (!oldAcctEmail || !newAcctEmail || !Str.isEmailValid(newAcctEmail)) {
      throw new Error('Missing or wrong account_email to reset');
    }
    const acctEmails = await GlobalStore.acctEmailsGet();
    if (!acctEmails.includes(oldAcctEmail)) {
      throw new Error(`"${oldAcctEmail}" is not a known account_email in "${JSON.stringify(acctEmails)}"`);
    }
    const storageIndexesToChange: string[] = [];
    const oldAcctEmailIndexPrefix = AbstractStore.singleScopeRawIndex(oldAcctEmail, '');
    const newAcctEmailIndexPrefix = AbstractStore.singleScopeRawIndex(newAcctEmail, '');
    // in case the destination email address was already set up with an account, recover keys and pass phrases before it's overwritten
    const destAccountPrivateKeys = await KeyStore.get(newAcctEmail);
    const destAcctPassPhrases: Dict<string> = {};
    for (const ki of destAccountPrivateKeys) {
      const pp = await PassphraseStore.get(newAcctEmail, ki.fingerprint, true);
      if (pp) {
        destAcctPassPhrases[ki.fingerprint] = pp;
      }
    }
    if (!oldAcctEmailIndexPrefix) {
      throw new Error(`Filter is empty for account_email "${oldAcctEmail}"`);
    }
    await GlobalStore.acctEmailsAdd(newAcctEmail);
    const storage = await storageLocalGetAll();
    for (const key of Object.keys(storage)) {
      if (key.indexOf(oldAcctEmailIndexPrefix) === 0) {
        storageIndexesToChange.push(key.replace(oldAcctEmailIndexPrefix, ''));
      }
    }
    const oldAcctStorage = await AcctStore.get(oldAcctEmail, storageIndexesToChange as any);
    await AcctStore.set(newAcctEmail, oldAcctStorage);
    for (const sessionStorageIndex of Object.keys(sessionStorage)) {
      if (sessionStorageIndex.indexOf(oldAcctEmailIndexPrefix) === 0) {
        const v = sessionStorage.getItem(sessionStorageIndex);
        sessionStorage.setItem(sessionStorageIndex.replace(oldAcctEmailIndexPrefix, newAcctEmailIndexPrefix), v!);
        sessionStorage.removeItem(sessionStorageIndex);
      }
    }
    for (const ki of destAccountPrivateKeys) {
      await KeyStore.add(newAcctEmail, ki.private);
    }
    for (const fingerprint of Object.keys(destAcctPassPhrases)) {
      await PassphraseStore.set('local', newAcctEmail, fingerprint, destAcctPassPhrases[fingerprint]);
    }
    await Settings.acctStorageReset(oldAcctEmail);
    await GlobalStore.acctEmailsRemove(oldAcctEmail);
  }

  public static renderPrvCompatFixUiAndWaitTilSubmittedByUser = async (
    acctEmail: string, containerStr: string | JQuery<HTMLElement>, origPrv: Pubkey, passphrase: string, backUrl: string
  ): Promise<Pubkey> => {
    const uids = origPrv.identities;
    if (!uids.length) {
      uids.push(acctEmail);
    }
    const container = $(containerStr as JQuery<HTMLElement>); // due to JQuery TS quirk
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
      '  <button class="button long gray action_fix_compatibility" data-test="action-fix-and-import-key">UPDATE AND IMPORT KEY</button>',
      '</div>',
    ].join('\n'));
    container.find('select.input_fix_expire_years').change(Ui.event.handle(target => {
      if ($(target).val()) {
        (container as JQuery<HTMLElement>).find('.action_fix_compatibility').removeClass('gray').addClass('green');
      } else {
        (container as JQuery<HTMLElement>).find('.action_fix_compatibility').removeClass('green').addClass('gray');
      }
    }));
    return await new Promise((resolve, reject) => {
      container.find('.action_fix_compatibility').click(Ui.event.handle(async target => {
        const expireYears = String($(target).parents(container as any).find('select.input_fix_expire_years').val()); // JQuery quirk
        if (!expireYears) {
          await Ui.modal.warning('Please select key expiration');
        } else {
          $(target).off();
          Xss.sanitizeRender(target, Ui.spinner('white'));
          const expireSeconds = (expireYears === 'never') ? 0 : Math.floor((Date.now() - origPrv.created.getTime()) / 1000) + (60 * 60 * 24 * 365 * Number(expireYears));
          await PgpKey.decrypt(origPrv, passphrase);
          let reformatted;
          const userIds = uids.map(uid => Str.parseEmail(uid)).map(u => ({ email: u.email, name: u.name || '' }));
          try {
            reformatted = await PgpKey.reformatKey(origPrv, passphrase, userIds, expireSeconds);
          } catch (e) {
            reject(e);
            return;
          }
          if (!reformatted.fullyEncrypted) { // this is a security precaution, in case OpenPGP.js library changes in the future
            Catch.report(`Key update: Key not fully encrypted after update`, { isFullyEncrypted: reformatted.fullyEncrypted, isFullyDecrypted: reformatted.fullyDecrypted });
            await Ui.modal.error('Key update:Key not fully encrypted after update. Please contact human@flowcrypt.com');
            Xss.sanitizeReplace(target, Ui.e('a', { href: backUrl, text: 'Go back and try something else' }));
            return;
          }
          if (reformatted.usableForEncryption) {
            resolve(reformatted);
          } else {
            await Ui.modal.error('Key update: Key still cannot be used for encryption. This looks like a compatibility issue.\n\nPlease write us at human@flowcrypt.com.');
            Xss.sanitizeReplace(target, Ui.e('a', { href: backUrl, text: 'Go back and try something else' }));
          }
        }
      }));
    });
  }

  public static retryUntilSuccessful = async (action: () => Promise<void>, errTitle: string) => {
    try {
      await action();
    } catch (e) {
      return await Settings.promptToRetry(e, errTitle, action);
    }
  }

  /**
   * todo - could probably replace most usages of this method with retryPromptUntilSuccessful which is more intuitive
   */
  public static promptToRetry = async (lastErr: any, userMsg: string, retryCb: () => Promise<void>): Promise<void> => {
    let userErrMsg = `${userMsg} ${ApiErr.eli5(lastErr)}`;
    if (lastErr instanceof ApiErrResponse && lastErr.res.error.code === 400) {
      userErrMsg = `${userMsg}, ${lastErr.res.error.message}`; // this will make reason for err 400 obvious to user, very important for our main customer
    }
    while (await Ui.renderOverlayPromptAwaitUserChoice({ retry: {} }, userErrMsg, ApiErr.detailsAsHtmlWithNewlines(lastErr)) === 'retry') {
      try {
        return await retryCb();
      } catch (e2) {
        lastErr = e2;
        if (ApiErr.isSignificant(e2)) {
          Catch.reportErr(e2);
        }
      }
    }
    // pressing retry button causes to get stuck in while loop until success, at which point it returns, or until user closes tab
    // if it got down here, user has chosen 'skip'. This option is only available on 'OPTIONAL' type
    // if the error happens again, op will be skipped
    return await retryCb();
  }

  public static forbidAndRefreshPageIfCannot = async (action: 'CREATE_KEYS' | 'BACKUP_KEYS', orgRules: OrgRules) => {
    if (action === 'CREATE_KEYS' && !orgRules.canCreateKeys()) {
      await Ui.modal.error(Lang.setup.creatingKeysNotAllowedPleaseImport);
      window.location.reload();
      throw new Error('creating_keys_not_allowed_please_import');
    } else if (action === 'BACKUP_KEYS' && !orgRules.canBackupKeys()) {
      await Ui.modal.error(Lang.setup.keyBackupsNotAllowed);
      window.location.reload();
      throw new Error('key_backups_not_allowed');
    }
  }

  public static newGoogleAcctAuthPromptThenAlertOrForward = async (settingsTabId: string | undefined, acctEmail?: string, scopes?: string[]) => {
    try {
      const response = await GoogleAuth.newAuthPopup({ acctEmail, scopes });
      if (response.result === 'Success' && response.acctEmail) {
        await GlobalStore.acctEmailsAdd(response.acctEmail);
        const storage = await AcctStore.get(response.acctEmail, ['setup_done']);
        if (storage.setup_done) { // this was just an additional permission
          await Ui.modal.info('You\'re all set.');
          window.location.href = Url.create('/chrome/settings/index.htm', { acctEmail: response.acctEmail });
        } else {
          await AcctStore.set(response.acctEmail, { email_provider: 'gmail' });
          window.location.href = Url.create('/chrome/settings/setup.htm', { acctEmail: response.acctEmail, idToken: response.id_token });
        }
      } else if (response.result === 'Denied' || response.result === 'Closed') {
        if (settingsTabId) {
          await Settings.renderSubPage(acctEmail, settingsTabId, '/chrome/settings/modules/auth_denied.htm');
        }
      } else {
        Catch.report('failed to log into google in newGoogleAcctAuthPromptThenAlertOrForward', response);
        await Ui.modal.error(`Failed to connect to Gmail(new). If this happens repeatedly, please write us at human@flowcrypt.com to fix it.\n\n[${response.result}] ${response.error}`);
        await Ui.time.sleep(1000);
        window.location.reload();
      }
    } catch (e) {
      if (ApiErr.isNetErr(e)) {
        await Ui.modal.error('Could not complete due to network error. Please try again.');
      } else if (ApiErr.isMailOrAcctDisabledOrPolicy(e)) {
        await Ui.modal.error('Your Google account or Gmail service is disabled. Please check your Google account settings.');
      } else {
        Catch.reportErr(e);
        await Ui.modal.error(`Unknown error happened when connecting to Google: ${String(e)}`);
      }
      await Ui.time.sleep(1000);
      window.location.reload();
    }
  }

  public static populateAccountsMenu = async (page: 'index.htm' | 'inbox.htm') => {
    const menuAcctHtml = (email: string, picture = '/img/svgs/profile-icon.svg', isHeaderRow: boolean) => {
      return [
        `<div ${isHeaderRow && 'id = "header-row"'} class="row alt-accounts action_select_account">`,
        '  <div class="col-sm-10">',
        `    <div class="row contains_email" data-test="action-switch-to-account">${Xss.escape(email)}</div>`,
        '  </div>',
        `  <div><img class="profile-img" src="${Xss.escape(picture)}" alt=""></div>`,
        '</div>',
      ].join('');
    };
    const acctEmails = await GlobalStore.acctEmailsGet();
    const acctStorages = await AcctStore.getAccounts(acctEmails, ['picture', 'setup_done']);
    for (const email of acctEmails) {
      Xss.sanitizePrepend('#alt-accounts', menuAcctHtml(email, acctStorages[email].picture, page === 'inbox.htm'));
    }
    $('#alt-accounts img.profile-img').on('error', Ui.event.handle(self => {
      $(self).off().attr('src', '/img/svgs/profile-icon.svg');
    }));
    $('.action_select_account').click(Ui.event.handle(target => {
      const acctEmail = $(target).find('.contains_email').text();
      const acctStorage = acctStorages[acctEmail];
      window.location.href = acctStorage.setup_done
        ? Url.create(page, { acctEmail })
        : Url.create(Env.getBaseUrl() + '/chrome/settings/index.htm', { acctEmail });
    }));
  }

  public static offerToLoginWithPopupShowModalOnErr = (acctEmail: string, then: (() => void) = () => undefined, prepend = '') => {
    (async () => {
      if (await Ui.modal.confirm(`${prepend}Please log in with FlowCrypt to continue.`)) {
        const authRes = await GoogleAuth.newOpenidAuthPopup({ acctEmail });
        if (authRes.result === 'Success' && authRes.acctEmail && authRes.id_token) {
          const uuid = Api.randomFortyHexChars();
          try {
            await Backend.loginWithOpenid(authRes.acctEmail, uuid, authRes.id_token);
            await Backend.accountGetAndUpdateLocalStore({ account: authRes.acctEmail, uuid });
            then();
          } catch (e) {
            await Ui.modal.error(`Could not log in with FlowCrypt:\n\n${ApiErr.eli5(e)}\n\n${String(e)}`);
          }
        } else {
          await Ui.modal.warning(`Could not log in:\n\n${authRes.error || authRes.result}`);
        }
      }
    })().catch(Catch.reportErr);
  }

  private static prepareNewSettingsLocationUrl = (acctEmail: string | undefined, parentTabId: string, page: string, addUrlTextOrParams?: string | UrlParams): string => {
    const pageParams: UrlParams = { placement: 'settings', parentTabId };
    if (acctEmail) {
      pageParams.acctEmail = acctEmail;
    }
    if (typeof addUrlTextOrParams === 'object' && addUrlTextOrParams) { // it's a list of params - add them. It could also be a text - then it will be added the end of url below
      for (const k of Object.keys(addUrlTextOrParams)) {
        pageParams[k] = addUrlTextOrParams[k];
      }
      addUrlTextOrParams = undefined;
    }
    return Url.create(page, pageParams) + (addUrlTextOrParams || '');
  }

  private static getDefaultEmailAlias = (sendAs: Dict<SendAsAlias>) => {
    for (const key of Object.keys(sendAs)) {
      if (sendAs[key] && sendAs[key].isDefault) {
        return key;
      }
    }
    return undefined;
  }

  private static fetchAcctAliasesFromGmail = async (acctEmail: string): Promise<Dict<SendAsAlias>> => {
    const response = await new Gmail(acctEmail).fetchAcctAliases();
    const validAliases = response.sendAs.filter(alias => alias.isPrimary || alias.verificationStatus === 'accepted');
    const result: Dict<SendAsAlias> = {};
    for (const a of validAliases) {
      result[a.sendAsEmail.toLowerCase()] = { name: a.displayName, isPrimary: !!a.isPrimary, isDefault: a.isDefault, footer: a.signature };
    }
    return result;
  }

}
