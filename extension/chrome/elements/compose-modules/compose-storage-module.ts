/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Bm, BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { Contact, KeyInfo, KeyUtil, Key } from '../../../js/common/core/crypto/key.js';
import { ApiErr } from '../../../js/common/api/shared/api-error.js';
import { Assert } from '../../../js/common/assert.js';
import { Catch } from '../../../js/common/platform/catch.js';
import { CollectPubkeysResult } from './compose-types.js';
import { PUBKEY_LOOKUP_RESULT_FAIL } from './compose-err-module.js';
import { ViewModule } from '../../../js/common/view-module.js';
import { ComposeView } from '../compose.js';
import { KeyStore } from '../../../js/common/platform/store/key-store.js';
import { AcctStore } from '../../../js/common/platform/store/acct-store.js';
import { GlobalStore } from '../../../js/common/platform/store/global-store.js';
import { ContactStore, ContactUpdate } from '../../../js/common/platform/store/contact-store.js';
import { PassphraseStore } from '../../../js/common/platform/store/passphrase-store.js';
import { Settings } from '../../../js/common/settings.js';
import { Ui } from '../../../js/common/browser/ui.js';

export class ComposeStorageModule extends ViewModule<ComposeView> {

  private passphraseInterval: number | undefined;
  private ksLookupsByEmail: { [key: string]: Key } = {};

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

  // TODO: remove in #3329
  public draftMetaDelete = async (threadId: string) => {
    const draftStorage = await AcctStore.get(this.view.acctEmail, ['drafts_reply']);
    const drafts = draftStorage.drafts_reply || {};
    delete drafts[threadId];
    await AcctStore.set(this.view.acctEmail, { drafts_reply: drafts });
  }

  public addAdminCodes = async (shortId: string, codes: string[]) => {
    const adminCodeStorage = await GlobalStore.get(['admin_codes']);
    adminCodeStorage.admin_codes = adminCodeStorage.admin_codes || {};
    adminCodeStorage.admin_codes[shortId] = { date: Date.now(), codes };
    await GlobalStore.set(adminCodeStorage);
  }

  public collectAllAvailablePublicKeys = async (senderEmail: string, senderKi: KeyInfo, recipients: string[]): Promise<CollectPubkeysResult> => {
    const contacts = await ContactStore.get(undefined, recipients);
    const armoredPubkeys = [{ pubkey: await KeyUtil.parse(senderKi.public), email: senderEmail, isMine: true }];
    const emailsWithoutPubkeys = [];
    for (const i of contacts.keys()) {
      const contact = contacts[i];
      if (contact && contact.hasPgp && contact.pubkey) {
        armoredPubkeys.push({ pubkey: contact.pubkey, email: contact.email, isMine: false });
      } else if (contact && this.ksLookupsByEmail[contact.email]) {
        armoredPubkeys.push({ pubkey: this.ksLookupsByEmail[contact.email], email: contact.email, isMine: false });
      } else {
        emailsWithoutPubkeys.push(recipients[i]);
      }
    }
    return { armoredPubkeys, emailsWithoutPubkeys };
  }

  public passphraseGet = async (senderKi?: KeyInfo) => {
    if (!senderKi) {
      senderKi = await KeyStore.getFirstRequired(this.view.acctEmail);
    }
    return await PassphraseStore.get(this.view.acctEmail, senderKi.fingerprints[0]);
  }

  public lookupPubkeyFromDbOrKeyserverAndUpdateDbIfneeded = async (email: string, name: string | undefined): Promise<Contact | "fail"> => {
    const [storedContact] = await ContactStore.get(undefined, [email]);
    if (storedContact && storedContact.hasPgp && storedContact.pubkey) {
      // Potentially check if pubkey was updated - async. By the time user finishes composing, newer version would have been updated in db.
      // If sender didn't pull a particular pubkey for a long time and it has since expired, but there actually is a newer version on attester, this may unnecessarily show "bad pubkey",
      //      -> until next time user tries to pull it. This could be fixed by attempting to fix up the rendered recipient inside the async function below.
      this.checkKeyserverForNewerVersionOfKnownPubkeyIfNeeded(storedContact).catch(Catch.reportErr);
      return storedContact;
    }
    return await this.ksLookupUnknownContactPubAndSaveToDb(email, name);
  }

  public ksLookupUnknownContactPubAndSaveToDb = async (email: string, name: string | undefined): Promise<Contact | "fail"> => {
    try {
      const lookupResult = await this.view.pubLookup.lookupEmail(email);
      if (lookupResult && email) {
        const pubkeys: Key[] = [];
        for (const pubkey of lookupResult.pubkeys) {
          const key = await KeyUtil.parse(pubkey);
          if (!key.usableForEncryption && !key.revoked && !KeyUtil.expired(key)) { // Not to skip expired and revoked keys
            console.info('Dropping found+parsed key because getEncryptionKeyPacket===null', { for: email, fingerprint: key.id });
            Ui.toast(`Public Key retrieved for email ${email} with id ${key.id} was ignored because it's not usable for encryption.`, 5);
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
            return await ContactStore.obj({ email });
          }
        }
        for (const pubkey of pubkeys) {
          updates.push({ name, pubkey, pubkeyLastCheck: Date.now() });
        }
        if (updates.length) {
          await Promise.all(updates.map(async (update) => await ContactStore.update(undefined, email, update)));
        }
        const [preferred] = await ContactStore.get(undefined, [email]);
        return preferred ?? PUBKEY_LOOKUP_RESULT_FAIL;
      } else {
        return PUBKEY_LOOKUP_RESULT_FAIL;
      }
    } catch (e) {
      if (!ApiErr.isNetErr(e) && !ApiErr.isServerErr(e)) {
        Catch.reportErr(e);
      }
      return PUBKEY_LOOKUP_RESULT_FAIL;
    }
  }

  public checkKeyserverForNewerVersionOfKnownPubkeyIfNeeded = async (contact: Contact) => {
    try {
      if (!contact.pubkey || !contact.fingerprint) {
        return;
      }
      const lastCheckOverWeekAgoOrNever = !contact.pubkeyLastCheck || new Date(contact.pubkeyLastCheck).getTime() < Date.now() - (1000 * 60 * 60 * 24 * 7);
      const isExpired = contact.expiresOn && contact.expiresOn < Date.now();
      if (lastCheckOverWeekAgoOrNever || isExpired) {
        const { pubkey: fetchedPubkeyArmored } = await this.view.pubLookup.lookupFingerprint(contact.fingerprint);
        if (fetchedPubkeyArmored) {
          const fetchedPubkey = await KeyUtil.parse(fetchedPubkeyArmored);
          if (fetchedPubkey.lastModified && (!contact.pubkey.lastModified || fetchedPubkey.lastModified >= contact.pubkey.lastModified)) {
            // the fetched pubkey has at least the same or newer signature
            // the "same or newer" was due to a bug we encountered earlier where keys were badly recorded in db
            // sometime in Oct 2020 we could turn the ">=" back to ">" above
            await ContactStore.update(undefined, contact.email, { pubkey: fetchedPubkey, lastUse: Date.now(), pubkeyLastCheck: Date.now() });
            const [updatedPubkey] = await ContactStore.get(undefined, [contact.email]);
            if (!updatedPubkey) {
              throw new Error("Cannot retrieve Contact right after updating it");
            }
            await this.view.recipientsModule.reRenderRecipientFor(updatedPubkey);
            return;
          }
        }
      }
      await ContactStore.update(undefined, contact.email, { pubkey: contact.pubkey, pubkeyLastCheck: Date.now() });
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
