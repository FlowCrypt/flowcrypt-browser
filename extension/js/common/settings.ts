/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch } from './platform/catch.js';
import { Store, SendAsAlias } from './platform/store.js';
import { Str, Dict, UrlParams, Url } from './core/common.js';
import { Lang } from './lang.js';
import { Rules } from './rules.js';
import { Api } from './api/api.js';
import { GoogleAuth } from './api/google-auth.js';
import { Attester } from './api/attester.js';
import { Xss } from './platform/xss.js';
import { Backend } from './api/backend.js';
import { storageLocalGetAll } from './api/chrome.js';
import { Gmail } from './api/email_provider/gmail/gmail.js';
import { Ui, JQS } from './browser/ui.js';
import { Env } from './browser/env.js';
import { ApiErr } from './api/error/api-error.js';
import { ApiErrResponse } from './api/error/api-error-types.js';
import { PgpPwd } from './core/pgp-password.js';
import { PgpKey } from './core/pgp-key.js';
import { openpgp } from './core/pgp.js';

declare const zxcvbn: Function; // tslint:disable-line:ban-types

export class Settings {

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

  public static fetchAcctAliasesFromGmail = async (acctEmail: string): Promise<Dict<SendAsAlias>> => {
    const response = await new Gmail(acctEmail).fetchAcctAliases();
    const validAliases = response.sendAs.filter(alias => alias.isPrimary || alias.verificationStatus === 'accepted');
    const result: Dict<SendAsAlias> = {};
    for (const alias of validAliases) {
      result[alias.sendAsEmail] = { name: alias.displayName, isPrimary: !!alias.isPrimary, isDefault: alias.isDefault, footer: alias.signature };
    }
    return result;
  }

  public static evalPasswordStrength = (passphrase: string, type: 'passphrase' | 'pwd' = 'passphrase') => {
    return PgpPwd.estimateStrength(zxcvbn(passphrase, PgpPwd.weakWords()).guesses, type); // tslint:disable-line:no-unsafe-any
  }

  public static submitPubkeys = async (acctEmail: string, addresses: string[], pubkey: string) => {
    await Attester.initialLegacySubmit(acctEmail, pubkey);
    const aliases = addresses.filter(a => a !== acctEmail);
    if (aliases.length) {
      await Promise.all(aliases.map(a => Attester.initialLegacySubmit(a, pubkey)));
    }
  }

  public static renderSubPage = (acctEmail: string | undefined, tabId: string, page: string, addUrlTextOrParams?: string | UrlParams) => {
    ($ as JQS).featherlight({
      beforeClose: () => {
        const urlWithoutPageParam = Url.removeParamsFromUrl(window.location.href, ['page']);
        window.history.pushState('', '', urlWithoutPageParam);
      },
      closeOnClick: 'background',
      iframe: Settings.prepareNewSettingsLocationUrl(acctEmail, tabId, page, addUrlTextOrParams),
      iframeWidth: Math.min(800, $('body').width()! - 200),
      iframeHeight: $('body').height()! - ($('body').height()! > 800 ? 150 : 75),
    });
  }

  public static redirectSubPage = (acctEmail: string, parentTabId: string, page: string, addUrlTextOrParams?: string | UrlParams) => {
    window.location.href = Settings.prepareNewSettingsLocationUrl(acctEmail, parentTabId, page, addUrlTextOrParams);
  }

  public static refreshAcctAliases = async (acctEmail: string) => {
    const fetchedSendAs = await Settings.fetchAcctAliasesFromGmail(acctEmail);
    const result = { isDefaultEmailChanged: false, isAliasesChanged: false, isFooterChanged: false, sendAs: fetchedSendAs };
    const { sendAs: storedAliases, addresses: oldStoredAddresses } = (await Store.getAcct(acctEmail, ['sendAs', 'addresses']));
    await Store.setAcct(acctEmail, { sendAs: fetchedSendAs });
    if (!storedAliases) { // Aliases changed (it was previously undefined)
      if (oldStoredAddresses) { // Temporary solution
        result.isAliasesChanged = true;
      }
      return result;
    }
    if (Settings.getDefaultEmailAlias(fetchedSendAs) !== Settings.getDefaultEmailAlias(storedAliases)) { // Changed (default email alias was changed)
      result.isDefaultEmailChanged = true;
    }
    if (Object.keys(fetchedSendAs).sort().join(',') !== Object.keys(storedAliases).sort().join(',')) { // Changed (added/removed email alias)
      result.isAliasesChanged = true;
    }
    if (Object.keys(fetchedSendAs).filter(email => fetchedSendAs[email].footer).map(email => fetchedSendAs[email].footer).join(',') !==
      Object.keys(storedAliases).filter(email => storedAliases[email].footer).map(email => storedAliases[email].footer).join(',')) {
      result.isFooterChanged = true;
    }
    return result.isAliasesChanged || result.isDefaultEmailChanged || result.isFooterChanged ? { ...result } : undefined;
  }

  public static acctStorageReset = async (acctEmail: string) => {
    if (!acctEmail) {
      throw new Error('Missing account_email to reset');
    }
    const acctEmails = await Store.acctEmailsGet();
    if (!acctEmails.includes(acctEmail)) {
      throw new Error(`"${acctEmail}" is not a known account_email in "${JSON.stringify(acctEmails)}"`);
    }
    const storageIndexesToRemove: string[] = [];
    const filter = Store.singleScopeRawIndex(acctEmail, '');
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
    });
  }

  public static acctStorageChangeEmail = async (oldAcctEmail: string, newAcctEmail: string) => {
    if (!oldAcctEmail || !newAcctEmail || !Str.isEmailValid(newAcctEmail)) {
      throw new Error('Missing or wrong account_email to reset');
    }
    const acctEmails = await Store.acctEmailsGet();
    if (!acctEmails.includes(oldAcctEmail)) {
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
    const storage = await storageLocalGetAll();
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
  }

  public static renderPrvCompatFixUiAndWaitTilSubmittedByUser = async (
    acctEmail: string, containerStr: string | JQuery<HTMLElement>, origPrv: OpenPGP.key.Key, passphrase: string, backUrl: string
  ): Promise<OpenPGP.key.Key> => {
    const uids = origPrv.users.map(u => u.userId).filter(u => !!u && u.userid && Str.parseEmail(u.userid).email).map(u => u!.userid).filter(Boolean) as string[];
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
          const expireSeconds = (expireYears === 'never') ? 0 : Math.floor((Date.now() - origPrv.primaryKey.created.getTime()) / 1000) + (60 * 60 * 24 * 365 * Number(expireYears));
          await PgpKey.decrypt(origPrv, passphrase);
          let reformatted;
          const userIds = uids.map(uid => Str.parseEmail(uid)).map(u => ({ email: u.email, name: u.name || '' }));
          try {
            reformatted = await openpgp.reformatKey({ privateKey: origPrv, passphrase, userIds, keyExpirationTime: expireSeconds }) as { key: OpenPGP.key.Key };
          } catch (e) {
            reject(e);
            return;
          }
          if (!reformatted.key.isFullyEncrypted()) { // this is a security precaution, in case OpenPGP.js library changes in the future
            Catch.report(`Key update: Key not fully encrypted after update`, { isFullyEncrypted: reformatted.key.isFullyEncrypted(), isFullyDecrypted: reformatted.key.isFullyDecrypted() });
            await Ui.modal.error('Key update:Key not fully encrypted after update. Please contact human@flowcrypt.com');
            Xss.sanitizeReplace(target, Ui.e('a', { href: backUrl, text: 'Go back and try something else' }));
            return;
          }
          if (await reformatted.key.getEncryptionKey()) {
            resolve(reformatted.key);
          } else {
            await Ui.modal.error('Key update: Key still cannot be used for encryption. This looks like a compatibility issue.\n\nPlease write us at human@flowcrypt.com.');
            Xss.sanitizeReplace(target, Ui.e('a', { href: backUrl, text: 'Go back and try something else' }));
          }
        }
      }));
    });
  }

  public static promptToRetry = async (type: 'REQUIRED', lastErr: any, userMsg: string, retryCb: () => Promise<void>): Promise<void> => {
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

  public static forbidAndRefreshPageIfCannot = async (action: 'CREATE_KEYS' | 'BACKUP_KEYS', rules: Rules) => {
    if (action === 'CREATE_KEYS' && !rules.canCreateKeys()) {
      await Ui.modal.error(Lang.setup.creatingKeysNotAllowedPleaseImport);
      window.location.reload();
      throw new Error('creating_keys_not_allowed_please_import');
    } else if (action === 'BACKUP_KEYS' && !rules.canBackupKeys()) {
      await Ui.modal.error(Lang.setup.keyBackupsNotAllowed);
      window.location.reload();
      throw new Error('key_backups_not_allowed');
    }
  }

  public static newGoogleAcctAuthPromptThenAlertOrForward = async (settingsTabId: string | undefined, acctEmail?: string, scopes?: string[]) => {
    try {
      const response = await GoogleAuth.newAuthPopup({ acctEmail, scopes });
      if (response.result === 'Success' && response.acctEmail) {
        await Store.acctEmailsAdd(response.acctEmail);
        const storage = await Store.getAcct(response.acctEmail, ['setup_done']);
        if (storage.setup_done) { // this was just an additional permission
          await Ui.modal.info('You\'re all set.');
          window.location.href = Url.create('/chrome/settings/index.htm', { acctEmail: response.acctEmail });
        } else {
          await Store.setAcct(response.acctEmail, { email_provider: 'gmail' });
          window.location.href = Url.create('/chrome/settings/setup.htm', { acctEmail: response.acctEmail });
        }
      } else if (response.result === 'Denied' || response.result === 'Closed') {
        if (settingsTabId) {
          Settings.renderSubPage(acctEmail, settingsTabId, '/chrome/settings/modules/auth_denied.htm');
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
    const acctEmails = await Store.acctEmailsGet();
    const acctStorages = await Store.getAccounts(acctEmails, ['picture', 'setup_done']);
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

}
