/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Bm, BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { KeyInfo, KeyUtil, Key } from '../../../js/common/core/crypto/key.js';
import { ApiErr } from '../../../js/common/api/shared/api-error.js';
import { Assert } from '../../../js/common/assert.js';
import { Catch } from '../../../js/common/platform/catch.js';
import { CollectPubkeysResult } from './compose-types.js';
import { PUBKEY_LOOKUP_RESULT_FAIL } from './compose-err-module.js';
import { ViewModule } from '../../../js/common/view-module.js';
import { ComposeView } from '../compose.js';
import { KeyStore } from '../../../js/common/platform/store/key-store.js';
import { AcctStore } from '../../../js/common/platform/store/acct-store.js';
import { ContactStore, ContactUpdate, PubKeyInfo } from '../../../js/common/platform/store/contact-store.js';
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

  public getKey = async (senderEmail: string): Promise<KeyInfo> => {
    const keys = await KeyStore.get(this.view.acctEmail);
    let result = await this.view.myPubkeyModule.chooseMyPublicKeyBySenderEmail(keys, senderEmail);
    if (!result) {
      this.view.errModule.debug(`ComposerStorage.getKey: could not find key based on senderEmail: ${senderEmail}, using primary instead`);
      result = keys[0];
      Assert.abortAndRenderErrorIfKeyinfoEmpty(result);
    } else {
      this.view.errModule.debug(`ComposerStorage.getKey: found key based on senderEmail: ${senderEmail}`);
    }
    this.view.errModule.debug(`ComposerStorage.getKey: returning key longid: ${result!.longid}`);
    return result!;
  }

  public collectAllAvailablePublicKeys = async (senderEmail: string, senderKi: KeyInfo, recipients: string[]): Promise<CollectPubkeysResult> => {
    const contacts = await ContactStore.getEncryptionKeys(undefined, recipients);
    const pubkeys = [{ pubkey: await KeyUtil.parse(senderKi.public), email: senderEmail, isMine: true }];
    const emailsWithoutPubkeys = [];
    for (const contact of contacts) {
      let keysPerEmail = contact.keys;
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
  }

  public passphraseGet = async (senderKi?: KeyInfo) => {
    if (!senderKi) {
      senderKi = await KeyStore.getFirstRequired(this.view.acctEmail);
    }
    return await PassphraseStore.get(this.view.acctEmail, senderKi.fingerprints[0]);
  }

  public lookupPubkeyFromKeyserversThenOptionallyFetchExpiredByFingerprintAndUpsertDb = async (
    email: string, name: string | undefined
  ): Promise<PubKeyInfo[] | "fail"> => {
    // note by Tom 2021-08-10: We are only getting one public key from storage, but should
    //    work with arrays instead, like with `ContactStore.getOneWithAllPubkeys`.
    //    However, this whole fingerprint-base section seems unnecessary, we could likely
    //    remove it and the keys will be updated below using
    //    `lookupPubkeyFromKeyserversAndUpsertDb` anyway.
    //    discussion: https://github.com/FlowCrypt/flowcrypt-browser/pull/3898#discussion_r686229818
    const storedContact = await ContactStore.getOneWithAllPubkeys(undefined, email);
    console.log(">>> LPKFKSTOFEBFAUDB: " + storedContact ? JSON.stringify(storedContact) : 'NOT_FOUND');
    if (storedContact && storedContact.sortedPubkeys.length) {
      const results: PubKeyInfo[] = [];
      for (const pubkey of storedContact.sortedPubkeys) {
        if (!pubkey.revoked) {
          // checks if pubkey was updated, asynchronously. By the time user finishes composing,
          //    newer version would have been updated in db.
          // This implementation is imperfect in that, if sender didn't pull a particular pubkey
          //    for a long time and the local pubkey has since expired, and there actually is a
          //    newer version available on external key server, this may unnecessarily show "bad pubkey",
          //    until next time user tries to enter recipient in the field again, which will at that point
          //    get the updated key from db. This could be fixed by:
          //      - either life fixing the UI after this call finishes, or
          //      - making this call below synchronous and using the result directly
          this.checkKeyserverForNewerVersionOfKnownPubkeyIfNeeded(storedContact.info.email, pubkey)
            .catch(Catch.reportErr);
          results.push(pubkey);
        } else {
          const res = await this.lookupPubkeyFromKeyserversAndUpsertDb(email, name, pubkey);
          if (res === 'fail') return res;
          results.push(res);
        }
      }
      return ContactStore.sortPubInfos(results);
    }
    const res = await this.lookupPubkeyFromKeyserversAndUpsertDb(email, name, undefined);
    if (res === 'fail') return res;
    return [res];
  }

  /**
   * We are searching recipient public key by email every time we enter the recipient.
   * This is regardless if we already have the public key stored locally or not.
   * We process the response and if there are new public keys, we save them. If there are
   *    newer versions of public keys we already have (compared by fingerprint), then we
   *    update the public keys we already have.
   * Finally, we return the updated public key back.
   *
   * Note by Tom 2021-08-10: We should consider a signature like
   *    `Promise<{email: string, contacts: Contact[]}>` instead. And the `fail` situations
   *    should probably be throwing some sort of `PubkeyLookupFailedError` or similar.
   *    `existingContact` should also change to `Contact[]` instead of `Contact | undefined`
   *    discussion: https://github.com/FlowCrypt/flowcrypt-browser/pull/3898#discussion_r686244628
   */
  public lookupPubkeyFromKeyserversAndUpsertDb = async (
    email: string, name: string | undefined, existingPubKey: PubKeyInfo | undefined
  ): Promise<PubKeyInfo | "fail"> => {
    try {
      const lookupResult = await this.view.pubLookup.lookupEmail(email);
      if (lookupResult && email) {
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
            if (existingPubKey) return existingPubKey;
            await ContactStore.obj({ email });
          }
        }
        for (const pubkey of pubkeys) {
          updates.push({ name, pubkey, pubkeyLastCheck: Date.now() });
        }
        if (updates.length) {
          await Promise.all(updates.map(async (update) => await ContactStore.update(undefined, email, update)));
        }
        const emailWithKeys = await ContactStore.getOneWithAllPubkeys(undefined, email);
        if (emailWithKeys && emailWithKeys.sortedPubkeys.length) {
          return emailWithKeys.sortedPubkeys[0];
        }
      }
    } catch (e) {
      if (!ApiErr.isNetErr(e) && !ApiErr.isServerErr(e)) {
        Catch.reportErr(e);
      }
    }
    return PUBKEY_LOOKUP_RESULT_FAIL;
  }

  public checkKeyserverForNewerVersionOfKnownPubkeyIfNeeded = async (
    email: string, pubKeyInfo: PubKeyInfo) => {
    try {
      const lastCheckOverWeekAgoOrNever = !pubKeyInfo.lastCheck ||
        new Date(pubKeyInfo.lastCheck).getTime() < Date.now() - (1000 * 60 * 60 * 24 * 7);
      if (lastCheckOverWeekAgoOrNever || KeyUtil.expired(pubKeyInfo.pubkey)) {
        const { pubkey: fetchedPubkeyArmored } = await this.view.pubLookup.lookupFingerprint(pubKeyInfo.pubkey.id);
        if (fetchedPubkeyArmored) {
          const fetchedPubkey = await KeyUtil.parse(fetchedPubkeyArmored);
          if (fetchedPubkey.lastModified && (!pubKeyInfo.pubkey.lastModified || fetchedPubkey.lastModified >= pubKeyInfo.pubkey.lastModified)) {
            // the fetched pubkey has at least the same or newer signature
            // the "same or newer" was due to a bug we encountered earlier where keys were badly recorded in db
            // sometime in Oct 2020 we could turn the ">=" back to ">" above
            await ContactStore.update(undefined, email, { pubkey: fetchedPubkey, lastUse: Date.now(), pubkeyLastCheck: Date.now() });
            const updatedPubkeys = await ContactStore.getOneWithAllPubkeys(undefined, email);
            if (!updatedPubkeys) {
              throw new Error("Cannot retrieve Contact right after updating it");
            }
            await this.view.recipientsModule.reRenderRecipientFor(email, updatedPubkeys.sortedPubkeys);
            return;
          }
        }
      }
      await ContactStore.update(undefined, email, { pubkey: pubKeyInfo.pubkey, pubkeyLastCheck: Date.now() });
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

}
