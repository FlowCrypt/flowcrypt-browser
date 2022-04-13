/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { KeyUtil, Key, PubkeyInfo, PubkeyResult, ContactInfoWithSortedPubkeys, KeyInfoWithIdentity } from '../../../js/common/core/crypto/key.js';
import { ApiErr } from '../../../js/common/api/shared/api-error.js';
import { Assert } from '../../../js/common/assert.js';
import { Catch, UnreportableError } from '../../../js/common/platform/catch.js';
import { CollectKeysResult } from './compose-types.js';
import { ComposerResetBtnTrigger, PUBKEY_LOOKUP_RESULT_FAIL } from './compose-err-module.js';
import { ViewModule } from '../../../js/common/view-module.js';
import { ComposeView } from '../compose.js';
import { KeyStore } from '../../../js/common/platform/store/key-store.js';
import { ContactStore } from '../../../js/common/platform/store/contact-store.js';
import { PassphraseStore } from '../../../js/common/platform/store/passphrase-store.js';
import { compareAndSavePubkeysToStorage } from '../../../js/common/shared.js';
import { KeyFamily } from '../../../js/common/core/crypto/key.js';
import { ParsedKeyInfo } from '../../../js/common/core/crypto/key-store-util.js';

export class ComposeStorageModule extends ViewModule<ComposeView> {

  public getAccountKeys = async (senderEmail: string | undefined, family?: 'openpgp' | 'x509' | undefined): Promise<KeyInfoWithIdentity[]> => {
    const unfilteredKeys = await KeyStore.get(this.view.acctEmail);
    Assert.abortAndRenderErrorIfKeyinfoEmpty(unfilteredKeys);
    const matchingFamily = unfilteredKeys.filter(ki => !family || ki.family === family);
    if (!senderEmail) {
      return matchingFamily;
    }
    const matchingFamilyAndSenderEmail = matchingFamily.filter(ki => ki.emails?.includes(senderEmail));
    if (!matchingFamilyAndSenderEmail.length) {
      // if couldn't find any key that matches email, use all from this family
      // x509 keys may not have email on them, and sometimes OpenPGP users use keys with other email
      return matchingFamily;
    }
    return matchingFamilyAndSenderEmail;
  };

  // used when encryption is needed
  // returns a set of keys of a single family ('openpgp' or 'x509')
  public collectSingleFamilyKeys = async (
    recipients: string[],
    senderEmail: string,
    needSigning: boolean
  ): Promise<CollectKeysResult> => {
    const resultsPerFamily: { [type: string]: CollectKeysResult } = {};
    const OPENPGP = 'openpgp';
    const X509 = 'x509';
    const contacts = recipients.length
      ? await ContactStore.getEncryptionKeys(undefined, recipients)
      : []; // in case collecting only our own keys for draft
    for (const family of [OPENPGP, X509]) {
      const collected = await this.collectSingleFamilyKeysInternal(
        family as KeyFamily,
        senderEmail,
        contacts
      );
      if (!collected.emailsWithoutPubkeys.length && (collected.senderKis.length || !needSigning)) {
        return collected; // return right away - we have all we needed in single family
      }
      resultsPerFamily[family] = collected;
    }
    // per discussion https://github.com/FlowCrypt/flowcrypt-browser/issues/4069#issuecomment-957313631
    // if one emailsWithoutPubkeys isn't subset of the other, throw an error
    if (!resultsPerFamily[OPENPGP].emailsWithoutPubkeys.every(email => resultsPerFamily[X509].emailsWithoutPubkeys.includes(email)) &&
      !resultsPerFamily[X509].emailsWithoutPubkeys.every(email => resultsPerFamily[OPENPGP].emailsWithoutPubkeys.includes(email))) {
      let err = `Cannot use mixed OpenPGP (${resultsPerFamily[OPENPGP].pubkeys.filter(p => !p.isMine).map(p => p.email).join(', ')}) and `
        + `S/MIME (${resultsPerFamily[X509].pubkeys.filter(p => !p.isMine).map(p => p.email).join(', ')}) public keys yet.`;
      err += 'If you need to email S/MIME recipient, do not add any OpenPGP recipient at the same time.';
      throw new UnreportableError(err);
    }
    const rank = (x: [string, CollectKeysResult]) => {
      return x[1].emailsWithoutPubkeys.length * 100 + (x[1].senderKis.length ? 0 : 10) + (x[0] === 'openpgp' ? 0 : 1);
    };
    return Object.entries(resultsPerFamily).sort((a, b) => rank(a) - rank(b))[0][1];
  };

  public passphraseGet = async (senderKi: { longid: string }) => {
    return await PassphraseStore.get(this.view.acctEmail, senderKi);
  };

  /**
   * returns decrypted key (potentially using user-entered pass phrase)
   * otherwise throws ComposerResetBtnTrigger when pass phrase not entered
   */
  public decryptSenderKey = async (parsedKey: ParsedKeyInfo): Promise<ParsedKeyInfo> => {
    const passphrase = await this.passphraseGet(parsedKey.keyInfo);
    if (typeof passphrase === 'undefined' && !parsedKey.key.fullyDecrypted) {
      const longids = [parsedKey.keyInfo.longid];
      BrowserMsg.send.passphraseDialog(this.view.parentTabId, { type: 'sign', longids });
      if (await PassphraseStore.waitUntilPassphraseChanged(this.view.acctEmail, longids, 1000, this.view.ppChangedPromiseCancellation)) {
        return await this.decryptSenderKey(parsedKey);
      } else {// reset - no passphrase entered
        throw new ComposerResetBtnTrigger('no pass phrase entered');
      }
    } else {
      if (!parsedKey.key.fullyDecrypted) {
        await KeyUtil.decrypt(parsedKey.key, passphrase!); // checked !== undefined above
      }
      return parsedKey;
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
  ): Promise<ContactInfoWithSortedPubkeys | "fail" | undefined> => {
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
      return storedContact;
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
    return updatedContact;
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
      if (await compareAndSavePubkeysToStorage({ email, name }, lookupResult.pubkeys, storedPubkeys)) {
        await this.view.recipientsModule.reRenderRecipientFor(email);
      }
    } catch (e) {
      if (!ApiErr.isNetErr(e) && !ApiErr.isServerErr(e)) {
        Catch.reportErr(e);
      }
      throw e;
    }
  };

  private collectSingleFamilyKeysInternal = async (
    family: KeyFamily,
    senderEmail: string,
    contacts: { email: string, keys: Key[] }[]
  ): Promise<CollectKeysResult> => {
    const senderKisUnfiltered = await this.getAccountKeys(senderEmail, family); // for draft encryption!
    const senderPubsUnfiltered = await Promise.all(senderKisUnfiltered.map(ki => KeyUtil.parse(ki.public)));
    const senderPubs = senderPubsUnfiltered.some(k => k.usableForEncryption)
      // if non-expired present, return non-expired only
      // that way, there will be no error if some keys are valid
      // but if all are invalid, downstream code can inform the user what happened
      ? senderPubsUnfiltered.filter(k => k.usableForEncryption)
      : senderPubsUnfiltered;
    const { pubkeys, emailsWithoutPubkeys } = this.collectPubkeysByFamily(family, contacts);
    for (const senderPub of senderPubs) { // add own key for encryption
      pubkeys.push({ pubkey: senderPub, email: senderEmail, isMine: true });
    }
    const senderKis = [];
    const isAnySenderKeyUsableForSigning = senderPubsUnfiltered.some(k => k.usableForSigning);
    for (const senderKi of senderKisUnfiltered) {
      if (!isAnySenderKeyUsableForSigning) {
        // if none is usable, add all
        // then downstream code can diagnose and show the issue to user
        senderKis.push(senderKi);
      } else {
        const relatedPub = senderPubsUnfiltered.find(pub => pub.id === senderKi.fingerprints[0]);
        // want to avoid parsing the prvs when pubs were already parsed
        //  therefore checking parameters of already parsed related pub, which are equal
        //  but actually pushing prv since it's meant for signing
        if (relatedPub?.usableForSigning) {
          senderKis.push(senderKi);
        }
      }
    }
    return { senderKis, pubkeys, emailsWithoutPubkeys, family };
  };

  private collectPubkeysByFamily = (family: KeyFamily, contacts: { email: string, keys: Key[] }[]): { pubkeys: PubkeyResult[], emailsWithoutPubkeys: string[] } => {
    const pubkeys: PubkeyResult[] = [];
    const emailsWithoutPubkeys: string[] = [];
    for (const contact of contacts) {
      let keysPerEmail = contact.keys.filter(k => k.family === family);
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
