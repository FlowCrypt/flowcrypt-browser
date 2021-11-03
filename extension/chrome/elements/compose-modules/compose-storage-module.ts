/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Bm, BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { KeyInfo, KeyUtil, Key, PubkeyResult } from '../../../js/common/core/crypto/key.js';
import { ApiErr } from '../../../js/common/api/shared/api-error.js';
import { Assert } from '../../../js/common/assert.js';
import { Catch, UnreportableError } from '../../../js/common/platform/catch.js';
import { CollectKeysResult } from './compose-types.js';
import { PUBKEY_LOOKUP_RESULT_FAIL } from './compose-err-module.js';
import { ViewModule } from '../../../js/common/view-module.js';
import { ComposeView } from '../compose.js';
import { KeyStore } from '../../../js/common/platform/store/key-store.js';
import { AcctStore } from '../../../js/common/platform/store/acct-store.js';
import { ContactStore, ContactUpdate, PubkeyInfo } from '../../../js/common/platform/store/contact-store.js';
import { PassphraseStore } from '../../../js/common/platform/store/passphrase-store.js';
import { Settings } from '../../../js/common/settings.js';
import { Ui } from '../../../js/common/browser/ui.js';

export class ComposeStorageModule extends ViewModule<ComposeView> {

  private passphraseInterval: number | undefined;

  public setHandlers = () => {
    BrowserMsg.addListener('passphrase_entry', async ({ entered }: Bm.PassphraseEntry) => {
      if (!entered) {
        clearInterval(this.passphraseInterval);
        this.view.sendBtnModule.resetSendBtn();
      }
    });
  }

  // returns undefined if not found
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
  }

  public getKey = async (senderEmail: string | undefined, type?: 'openpgp' | 'x509' | undefined): Promise<KeyInfo> => {
    const result = await this.getKeyOptional(senderEmail, type);
    Assert.abortAndRenderErrorIfKeyinfoEmpty(result);
    this.view.errModule.debug(`ComposerStorage.getKey: returning key longid: ${result!.longid}`);
    return result!;
  }

  // used when encryption is needed
  // returns a set of keys of a single family ('openpgp' or 'x509')
  public collectAllKeys = async (recipients: string[], senderEmail: string, needSigning: boolean): Promise<CollectKeysResult> => {
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
        // todo: check if already added with recipients?
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
  }

  public passphraseGet = async (senderKi?: { longid: string }) => {
    if (!senderKi) {
      senderKi = await KeyStore.getFirstRequired(this.view.acctEmail);
    }
    return await PassphraseStore.get(this.view.acctEmail, senderKi);
  }

  public decryptSenderKey = async (senderKi: KeyInfo): Promise<Key | undefined> => {
    const prv = await KeyUtil.parse(senderKi.private);
    const passphrase = await this.passphraseGet(senderKi);
    if (typeof passphrase === 'undefined' && !prv.fullyDecrypted) {
      BrowserMsg.send.passphraseDialog(this.view.parentTabId, { type: 'sign', longids: [senderKi.longid] });
      if ((typeof await this.whenMasterPassphraseEntered(60)) !== 'undefined') { // pass phrase entered
        return await this.decryptSenderKey(senderKi);
      } else { // timeout - reset - no passphrase entered
        this.view.sendBtnModule.resetSendBtn();
        return undefined;
      }
    } else {
      if (!prv.fullyDecrypted) {
        await KeyUtil.decrypt(prv, passphrase!); // checked !== undefined above
      }
      return prv;
    }
  }

  public lookupPubkeyFromKeyserversThenOptionallyFetchExpiredByFingerprintAndUpsertDb = async (
    email: string, name: string | undefined
  ): Promise<PubkeyInfo[] | "fail"> => {
    // console.log(`>>>> Looking up in DB: ${email}`);
    const storedContact = await ContactStore.getOneWithAllPubkeys(undefined, email);
    // console.log(">>>> " + (storedContact ? JSON.stringify(storedContact) : 'NOT_FOUND'));
    const bestKey = storedContact?.sortedPubkeys?.length ? storedContact.sortedPubkeys[0] : undefined;
    if (storedContact && bestKey && KeyUtil.usableAllowingExpired(bestKey)) {
      // checks if pubkey was updated, asynchronously. By the time user finishes composing,
      //    newer version would have been updated in db.
      // This implementation is imperfect in that, if sender didn't pull a particular pubkey
      //    for a long time and the local pubkey has since expired, and there actually is a
      //    newer version available on external key server, this may unnecessarily show "bad pubkey",
      //    until next time user tries to enter recipient in the field again, which will at that point
      //    get the updated key from db. This could be fixed by:
      //      - either life fixing the UI after this call finishes, or
      //      - making this call below synchronous and using the result directly
      for (const pubinfo of storedContact.sortedPubkeys.filter(p => !p.revoked)) {
        this.checkKeyserverForNewerVersionOfKnownPubkeyIfNeeded(storedContact.info.email, pubinfo)
          .catch(Catch.reportErr);
      }
      // return the current set rightaway
      return storedContact.sortedPubkeys;
    }
    // no valid keys found, query synchronously
    try {
      await this.lookupPubkeyFromKeyserversAndUpsertDb(email, name);
    } catch (e) {
      return PUBKEY_LOOKUP_RESULT_FAIL;
    }
    // re-query the storage
    return (await ContactStore.getOneWithAllPubkeys(undefined, email))?.sortedPubkeys ?? [];
  }

  /**
   * We are searching recipient public key by email every time we enter the recipient.
   * This is regardless if we already have the public key stored locally or not.
   * We process the response and if there are new public keys, we save them. If there are
   *    newer versions of public keys we already have (compared by fingerprint), then we
   *    update the public keys we already have.
   */
  public lookupPubkeyFromKeyserversAndUpsertDb = async (email: string, name: string | undefined): Promise<void> => {
    if (!email) throw Error("Empty email");
    try {
      const lookupResult = await this.view.pubLookup.lookupEmail(email);
      const pubkeys: Key[] = [];
      for (const pubkey of lookupResult.pubkeys) {
        const key = await KeyUtil.parse(pubkey);
        if (!key.usableForEncryption && !key.revoked && !KeyUtil.expired(key)) { // Not to skip expired and revoked keys
          console.info('Dropping found+parsed key because getEncryptionKeyPacket===null', { for: email, fingerprint: key.id });
          Ui.toast(`Public Key retrieved for email ${email} with id ${key.id} was ignored because it's not usable for encryption.`, false, 5);
        } else {
          pubkeys.push(key);
        }
      }
      // save multiple pubkeys as separate operations
      // todo: add a convenient method to storage?
      const updates: ContactUpdate[] = [];
      if (!pubkeys.length) {
        if (name) {
          // update just name
          updates.push({ name } as ContactUpdate);
        } else {
          // No public key found. Returning early, nothing to update in local store below.
          return; // no error
        }
      }
      for (const pubkey of pubkeys) {
        updates.push({ name, pubkey, pubkeyLastCheck: Date.now() });
      }
      if (updates.length) {
        await Promise.all(updates.map(async (update) =>
          await ContactStore.update(undefined, email, update)));
      }
    } catch (e) {
      if (!ApiErr.isNetErr(e) && !ApiErr.isServerErr(e)) {
        Catch.reportErr(e);
      }
      throw e;
    }
  }

  public checkKeyserverForNewerVersionOfKnownPubkeyIfNeeded = async (
    email: string, pubkeyInfo: PubkeyInfo) => {
    try {
      const lastCheckOverWeekAgoOrNever = !pubkeyInfo.lastCheck ||
        new Date(pubkeyInfo.lastCheck).getTime() < Date.now() - (1000 * 60 * 60 * 24 * 7);
      if (lastCheckOverWeekAgoOrNever || KeyUtil.expired(pubkeyInfo.pubkey)) {
        const { pubkey: fetchedPubkeyArmored } = await this.view.pubLookup.lookupFingerprint(pubkeyInfo.pubkey.id);
        if (fetchedPubkeyArmored) {
          const fetchedPubkey = await KeyUtil.parse(fetchedPubkeyArmored);
          if (fetchedPubkey.lastModified && (!pubkeyInfo.pubkey.lastModified || fetchedPubkey.lastModified >= pubkeyInfo.pubkey.lastModified)) {
            // the fetched pubkey has at least the same or newer signature
            // the "same or newer" was due to a bug we encountered earlier where keys were badly recorded in db
            // sometime in Oct 2020 we could turn the ">=" back to ">" above
            await ContactStore.update(undefined, email, { pubkey: fetchedPubkey, lastUse: Date.now(), pubkeyLastCheck: Date.now() });
            await this.view.recipientsModule.reRenderRecipientFor(email);
            return;
          }
        }
      }
      await ContactStore.update(undefined, email, { pubkey: pubkeyInfo.pubkey, pubkeyLastCheck: Date.now() });
      // we checked for newer key and it did not result in updating the key, don't check again for another week
    } catch (e) {
      ApiErr.reportIfSignificant(e);
    }
  }

  public whenMasterPassphraseEntered = async (secondsTimeout?: number): Promise<string | undefined> => {
    clearInterval(this.passphraseInterval);
    const timeoutAt = secondsTimeout ? Date.now() + secondsTimeout * 1000 : undefined;
    return await new Promise(resolve => {
      this.passphraseInterval = Catch.setHandledInterval(async () => {
        const passphrase = await this.passphraseGet();
        if (typeof passphrase !== 'undefined') {
          clearInterval(this.passphraseInterval);
          resolve(passphrase);
        } else if (timeoutAt && Date.now() > timeoutAt) {
          clearInterval(this.passphraseInterval);
          resolve(undefined);
        }
      }, 1000);
    });
  }

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
  }

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
          pubkeys.push({ pubkey, email: contact.email, isMine: false }); // todo: I can also be a recipient
        }
      } else {
        emailsWithoutPubkeys.push(contact.email);
      }
    }
    return { pubkeys, emailsWithoutPubkeys };
  }
}
