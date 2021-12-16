/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { KeyInfo, KeyUtil, Key, PubkeyInfo, PubkeyResult } from '../../../js/common/core/crypto/key.js';
import { ApiErr } from '../../../js/common/api/shared/api-error.js';
import { Assert } from '../../../js/common/assert.js';
import { Catch, UnreportableError } from '../../../js/common/platform/catch.js';
import { CollectKeysResult } from './compose-types.js';
import { PUBKEY_LOOKUP_RESULT_FAIL } from './compose-err-module.js';
import { ViewModule } from '../../../js/common/view-module.js';
import { ComposeView } from '../compose.js';
import { KeyStore } from '../../../js/common/platform/store/key-store.js';
import { AcctStore } from '../../../js/common/platform/store/acct-store.js';
import { ContactStore } from '../../../js/common/platform/store/contact-store.js';
import { PassphraseStore } from '../../../js/common/platform/store/passphrase-store.js';
import { Settings } from '../../../js/common/settings.js';
import { compareAndSavePubkeysToStorage } from '../../../js/common/shared.js';

export class ComposeStorageModule extends ViewModule<ComposeView> {
  // if `type` is supplied, returns undefined if no keys of this type are found
  public getKeyOptional = async (senderEmail: string | undefined, type?: 'openpgp' | 'x509' | undefined) => {
    const keys = await KeyStore.getTypedKeyInfos(this.view.acctEmail);
    let result: KeyInfo | undefined;
    if (senderEmail !== undefined) {
      const filteredKeys = KeyUtil.filterKeysByTypeAndSenderEmail(keys, senderEmail, type);
      if (type === undefined) {
        // prioritize openpgp
        result = filteredKeys.find(key => key.type === 'openpgp');
      }
      if (result === undefined) {
        result = filteredKeys[0];
      }
    }
    if (result === undefined) {
      this.view.errModule.debug(`ComposerStorage.getKeyOptional: could not find key based on senderEmail: ${senderEmail}, using primary instead`);
      result = keys.find(k => type === undefined || type === k.type);
    } else {
      this.view.errModule.debug(`ComposerStorage.getKeyOptional: found key based on senderEmail: ${senderEmail}`);
    }
    return result;
  };

  public getKey = async (senderEmail: string | undefined, type?: 'openpgp' | 'x509' | undefined): Promise<KeyInfo> => {
    const result = await this.getKeyOptional(senderEmail, type);
    Assert.abortAndRenderErrorIfKeyinfoEmpty(result);
    this.view.errModule.debug(`ComposerStorage.getKey: returning key longid: ${result!.longid}`);
    return result!;
  };

  // used when encryption is needed
  // returns a set of keys of a single family ('openpgp' or 'x509')
  public collectSingleFamilyKeys = async (recipients: string[], senderEmail: string, needSigning: boolean): Promise<CollectKeysResult> => {
    const contacts = await ContactStore.getEncryptionKeys(undefined, recipients);
    const resultsPerType: { [type: string]: CollectKeysResult } = {};
    const OPENPGP = 'openpgp';
    const X509 = 'x509';
    for (const i of [OPENPGP, X509]) {
      const type = i as ('openpgp' | 'x509');
      // senderKi for draft encryption!
      const senderKi = await this.getKeyOptional(senderEmail, type);
      const { pubkeys, emailsWithoutPubkeys } = this.collectPubkeysByType(type, contacts);
      if (senderKi !== undefined) {
        // add own key for encryption
        pubkeys.push({ pubkey: await KeyUtil.parse(senderKi.public), email: senderEmail, isMine: true });
      }
      const result = { senderKi, pubkeys, emailsWithoutPubkeys };
      if (!emailsWithoutPubkeys.length && (senderKi !== undefined || !needSigning)) {
        return result; // return right away
      }
      resultsPerType[type] = result;
    }
    // per discussion https://github.com/FlowCrypt/flowcrypt-browser/issues/4069#issuecomment-957313631
    // if one emailsWithoutPubkeys isn't subset of the other, throw an error
    if (!resultsPerType[OPENPGP].emailsWithoutPubkeys.every(email => resultsPerType[X509].emailsWithoutPubkeys.includes(email)) &&
      !resultsPerType[X509].emailsWithoutPubkeys.every(email => resultsPerType[OPENPGP].emailsWithoutPubkeys.includes(email))) {
      let err = `Cannot use mixed OpenPGP (${resultsPerType[OPENPGP].pubkeys.filter(p => !p.isMine).map(p => p.email).join(', ')}) and `
        + `S/MIME (${resultsPerType[X509].pubkeys.filter(p => !p.isMine).map(p => p.email).join(', ')}) public keys yet.`;
      err += 'If you need to email S/MIME recipient, do not add any OpenPGP recipient at the same time.';
      throw new UnreportableError(err);
    }
    const rank = (x: [string, CollectKeysResult]) => {
      return x[1].emailsWithoutPubkeys.length * 100 + (x[1].senderKi ? 0 : 10) + (x[0] === 'openpgp' ? 0 : 1);
    };
    return Object.entries(resultsPerType).sort((a, b) => rank(a) - rank(b))[0][1];
  };

  public passphraseGet = async (senderKi: { longid: string }) => {
    if (!senderKi) {
      senderKi = await KeyStore.getFirstRequired(this.view.acctEmail);
    }
    return await PassphraseStore.get(this.view.acctEmail, senderKi);
  };

  public decryptSenderKey = async (senderKi: KeyInfo): Promise<Key | undefined> => {
    const prv = await KeyUtil.parse(senderKi.private);
    const passphrase = await this.passphraseGet(senderKi);
    if (typeof passphrase === 'undefined' && !prv.fullyDecrypted) {
      const longids = [senderKi.longid];
      BrowserMsg.send.passphraseDialog(this.view.parentTabId, { type: 'sign', longids });
      if (await PassphraseStore.waitUntilPassphraseChanged(this.view.acctEmail, longids, 1000, this.view.ppChangedPromiseCancellation)) {
        return await this.decryptSenderKey(senderKi);
      } else { // reset - no passphrase entered
        this.view.sendBtnModule.resetSendBtn();
        return undefined;
      }
    } else {
      if (!prv.fullyDecrypted) {
        await KeyUtil.decrypt(prv, passphrase!); // checked !== undefined above
      }
      return prv;
    }
  };

  public isPwdMatchingPassphrase = async (pwd: string): Promise<boolean> => {
    const kis = await KeyStore.get(this.view.acctEmail);
    for (const ki of kis) {
      const pp = await PassphraseStore.get(this.view.acctEmail, ki, true);
      if (pp && pwd.toLowerCase() === pp.toLowerCase()) {
        return true;
      }
      // check whether this pwd unlocks the ki
      const parsed = await KeyUtil.parse(ki.private);
      if (!parsed.fullyDecrypted && await KeyUtil.decrypt(parsed, pwd)) {
        return true;
      }
    }
    return false;
  };

  /**
   * Updates them asynchronously if there is at least one usable key for recipient
   * Updates synchronously if there are no usable keys
   */
  public getUpToDatePubkeys = async (
    email: string
  ): Promise<PubkeyInfo[] | "fail"> => {
    this.view.errModule.debug(`getUpToDatePubkeys.email(${email})`);
    const storedContact = await ContactStore.getOneWithAllPubkeys(undefined, email);
    this.view.errModule.debug(`getUpToDatePubkeys.storedContact.sortedPubkeys.length(${storedContact?.sortedPubkeys.length})`);
    const bestKey = storedContact?.sortedPubkeys[0]?.pubkey;
    this.view.errModule.debug(`getUpToDatePubkeys.bestKey(${JSON.stringify(bestKey)})`);
    if (storedContact && bestKey?.usableForEncryption) {
      this.view.errModule.debug(`getUpToDatePubkeys.bestKey is usable, refreshing async`);
      // have at least one valid key. Return keys as they are but fire off
      //  an async method to update them
      this.updateLocalPubkeysFromRemote(storedContact.sortedPubkeys, email)
        .catch(ApiErr.reportIfSignificant);
      return storedContact.sortedPubkeys;
    }
    this.view.errModule.debug(`getUpToDatePubkeys.bestKey not usable, refreshing sync`);
    try { // no valid keys found, query synchronously, then return result
      await this.updateLocalPubkeysFromRemote(storedContact?.sortedPubkeys || [], email);
    } catch (e) {
      return PUBKEY_LOOKUP_RESULT_FAIL;
    }
    // re-query the storage, which is now updated
    const updatedContact = await ContactStore.getOneWithAllPubkeys(undefined, email);
    this.view.errModule.debug(`getUpToDatePubkeys.updatedContact.sortedPubkeys.length(${updatedContact?.sortedPubkeys.length})`);
    this.view.errModule.debug(`getUpToDatePubkeys.updatedContact(${updatedContact})`);
    return updatedContact?.sortedPubkeys ?? [];
  };

  /**
   * We are searching recipient public key by email every time we enter the recipient.
   * This is regardless if we already have the public key stored locally or not.
   * We process the response and if there are new public keys, we save them. If there are
   *    newer versions of public keys we already have (compared by fingerprint), then we
   *    update the public keys we already have.
   */
  public updateLocalPubkeysFromRemote = async (
    storedPubkeys: PubkeyInfo[], email: string, name?: string
  ): Promise<void> => {
    if (!email) {
      throw Error("Empty email");
    }
    try {
      const lookupResult = await this.view.pubLookup.lookupEmail(email);
      if (await compareAndSavePubkeysToStorage(email, lookupResult.pubkeys, storedPubkeys)) {
        await this.view.recipientsModule.reRenderRecipientFor(email);
      }
      if (name) { // update name
        await ContactStore.update(undefined, email, { name });
      }
    } catch (e) {
      if (!ApiErr.isNetErr(e) && !ApiErr.isServerErr(e)) {
        Catch.reportErr(e);
      }
      throw e;
    }
  };

  public refreshAccountAndSubscriptionIfLoggedIn = async () => {
    const auth = await AcctStore.authInfo(this.view.acctEmail);
    if (auth.uuid) {
      try {
        await this.view.acctServer.accountGetAndUpdateLocalStore(auth); // updates storage
      } catch (e) {
        if (ApiErr.isAuthErr(e)) {
          Settings.offerToLoginWithPopupShowModalOnErr(
            this.view.acctEmail,
            () => this.refreshAccountAndSubscriptionIfLoggedIn().catch(ApiErr.reportIfSignificant), // retry this after re-auth
            `Could not get account information from backend.\n`
          );
          return;
        }
        throw e;
      }
    }
  };

  private collectPubkeysByType = (type: 'openpgp' | 'x509', contacts: { email: string, keys: Key[] }[]): { pubkeys: PubkeyResult[], emailsWithoutPubkeys: string[] } => {
    const pubkeys: PubkeyResult[] = [];
    const emailsWithoutPubkeys: string[] = [];
    for (const contact of contacts) {
      let keysPerEmail = contact.keys.filter(k => k.type === type);
      // if non-expired present, return non-expired only
      if (keysPerEmail.some(k => k.usableForEncryption)) {
        keysPerEmail = keysPerEmail.filter(k => k.usableForEncryption);
      }
      if (keysPerEmail.length) {
        for (const pubkey of keysPerEmail) {
          pubkeys.push({ pubkey, email: contact.email, isMine: false });
        }
      } else {
        emailsWithoutPubkeys.push(contact.email);
      }
    }
    return { pubkeys, emailsWithoutPubkeys };
  };
}
