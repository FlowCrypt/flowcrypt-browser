/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Bm, BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { Contact, KeyInfo } from '../../../js/common/core/pgp-key.js';
import { PubkeySearchResult } from '../../../js/common/api/keyserver.js';
import { ApiErr } from '../../../js/common/api/error/api-error.js';
import { Assert } from '../../../js/common/assert.js';
import { Catch } from '../../../js/common/platform/catch.js';
import { CollectPubkeysResult } from './compose-types.js';
import { PUBKEY_LOOKUP_RESULT_FAIL } from './compose-err-module.js';
import { PgpKey } from '../../../js/common/core/pgp-key.js';
import { opgp } from '../../../js/common/core/pgp.js';
import { ViewModule } from '../../../js/common/view-module.js';
import { ComposeView } from '../compose.js';
import { KeyStore } from '../../../js/common/platform/store/key-store.js';
import { AcctStore } from '../../../js/common/platform/store/acct-store.js';
import { GlobalStore } from '../../../js/common/platform/store/global-store.js';
import { ContactStore } from '../../../js/common/platform/store/contact-store.js';
import { PassphraseStore } from '../../../js/common/platform/store/passphrase-store.js';

export class ComposeStorageModule extends ViewModule<ComposeView> {

  private passphraseInterval: number | undefined;
  private ksLookupsByEmail: { [key: string]: PubkeySearchResult | Contact } = {};

  public setHandlers = () => {
    BrowserMsg.addListener('passphrase_entry', async ({ entered }: Bm.PassphraseEntry) => {
      if (!entered) {
        clearInterval(this.passphraseInterval);
        this.view.sendBtnModule.resetSendBtn();
      }
    });
  }

  public getKey = async (senderEmail: string): Promise<KeyInfo> => {
    const keys = await KeyStore.keysGet(this.view.acctEmail);
    let result = await this.view.myPubkeyModule.chooseMyPublicKeyBySenderEmail(keys, senderEmail);
    if (!result) {
      this.view.errModule.debug(`ComposerStorage.getKey: could not find key based on senderEmail: ${senderEmail}, using primary instead`);
      result = keys.find(ki => ki.primary);
      Assert.abortAndRenderErrorIfKeyinfoEmpty(result);
    } else {
      this.view.errModule.debug(`ComposerStorage.getKey: found key based on senderEmail: ${senderEmail}`);
    }
    this.view.errModule.debug(`ComposerStorage.getKey: returning key longid: ${result!.longid}`);
    return result!;
  }

  public draftMetaSet = async (draftId: string, threadId: string, recipients: string[], subject: string) => {
    const draftStorage = await AcctStore.get(this.view.acctEmail, ['drafts_reply', 'drafts_compose']);
    if (threadId) { // it's a reply
      const drafts = draftStorage.drafts_reply || {};
      drafts[threadId] = draftId;
      await AcctStore.set(this.view.acctEmail, { drafts_reply: drafts });
    } else { // it's a new message
      const drafts = draftStorage.drafts_compose || {};
      drafts[draftId] = { recipients, subject, date: new Date().getTime() };
      await AcctStore.set(this.view.acctEmail, { drafts_compose: drafts });
    }
  }

  public draftMetaDelete = async (draftId: string, threadId: string) => {
    const draftStorage = await AcctStore.get(this.view.acctEmail, ['drafts_reply', 'drafts_compose']);
    if (threadId) { // it's a reply
      const drafts = draftStorage.drafts_reply || {};
      delete drafts[threadId];
      await AcctStore.set(this.view.acctEmail, { drafts_reply: drafts });
    } else { // it's a new message
      const drafts = draftStorage.drafts_compose || {};
      delete drafts[draftId];
      await AcctStore.set(this.view.acctEmail, { drafts_compose: drafts });
    }
  }

  public addAdminCodes = async (shortId: string, codes: string[]) => {
    const adminCodeStorage = await GlobalStore.getGlobal(['admin_codes']);
    adminCodeStorage.admin_codes = adminCodeStorage.admin_codes || {};
    adminCodeStorage.admin_codes[shortId] = { date: Date.now(), codes };
    await GlobalStore.setGlobal(adminCodeStorage);
  }

  public collectAllAvailablePublicKeys = async (senderEmail: string, senderKi: KeyInfo, recipients: string[]): Promise<CollectPubkeysResult> => {
    const contacts = await ContactStore.dbContactGet(undefined, recipients);
    const armoredPubkeys = [{ pubkey: senderKi.public, email: senderEmail, isMine: true }];
    const emailsWithoutPubkeys = [];
    for (const i of contacts.keys()) {
      const contact = contacts[i];
      if (contact && contact.has_pgp && contact.pubkey) {
        armoredPubkeys.push({ pubkey: contact.pubkey, email: contact.email, isMine: false });
      } else if (contact && this.ksLookupsByEmail[contact.email] && this.ksLookupsByEmail[contact.email].pubkey) {
        armoredPubkeys.push({ pubkey: this.ksLookupsByEmail[contact.email].pubkey!, email: contact.email, isMine: false }); // checked !null right above. Null evaluates to false.
      } else {
        emailsWithoutPubkeys.push(recipients[i]);
      }
    }
    return { armoredPubkeys, emailsWithoutPubkeys };
  }

  public passphraseGet = async (senderKi?: KeyInfo) => {
    if (!senderKi) {
      [senderKi] = await KeyStore.keysGet(this.view.acctEmail, ['primary']);
      Assert.abortAndRenderErrorIfKeyinfoEmpty(senderKi);
    }
    return await PassphraseStore.passphraseGet(this.view.acctEmail, senderKi.longid);
  }

  public lookupPubkeyFromDbOrKeyserverAndUpdateDbIfneeded = async (email: string, name: string | undefined): Promise<Contact | "fail"> => {
    const [storedContact] = await ContactStore.dbContactGet(undefined, [email]);
    if (storedContact && storedContact.has_pgp && storedContact.pubkey) {
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
      const lookupResult = await this.view.keyserver.lookupEmail(email);
      if (lookupResult && email) {
        if (lookupResult.pubkey) {
          const parsed = await opgp.key.readArmored(lookupResult.pubkey);
          const key = parsed.keys[0];
          if (!key) {
            console.info('Dropping found but incompatible public key', { for: email, err: parsed.err ? ' * ' + parsed.err.join('\n * ') : undefined });
            lookupResult.pubkey = null; // tslint:disable-line:no-null-keyword
          } else if (! await PgpKey.usableForEncryption(lookupResult.pubkey) && ! await PgpKey.expired(key)) { // Not to skip expired keys
            console.info('Dropping found+parsed key because getEncryptionKeyPacket===null', { for: email, longid: await PgpKey.longid(parsed.keys[0]) });
            lookupResult.pubkey = null; // tslint:disable-line:no-null-keyword
          }
        }
        const client = lookupResult.pgpClient === 'flowcrypt' ? 'cryptup' : 'pgp'; // todo - clean up as "flowcrypt|pgp-other'. Already in storage, fixing involves migration
        const ksContact = await ContactStore.dbContactObj({
          email,
          name,
          pubkey: lookupResult.pubkey,
          client: lookupResult.pubkey ? client : undefined,
          lastUse: Date.now(),
          lastCheck: Date.now(),
        });
        this.ksLookupsByEmail[email] = ksContact;
        await ContactStore.dbContactSave(undefined, ksContact);
        return ksContact;
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
      if (!contact.pubkey || !contact.longid) {
        return;
      }
      if (!contact.pubkey_last_sig) {
        const lastSig = await PgpKey.lastSig(await PgpKey.read(contact.pubkey));
        contact.pubkey_last_sig = lastSig;
        await ContactStore.dbContactUpdate(undefined, contact.email, { pubkey_last_sig: lastSig });
      }
      if (!contact.pubkey_last_check || new Date(contact.pubkey_last_check).getTime() < Date.now() - (1000 * 60 * 60 * 24 * 7)) { // last update > 7 days ago, or never
        const { pubkey: fetchedPubkey } = await this.view.keyserver.lookupLongid(contact.longid);
        if (fetchedPubkey) {
          const fetchedLastSig = await PgpKey.lastSig(await PgpKey.read(fetchedPubkey));
          if (fetchedLastSig > contact.pubkey_last_sig) { // fetched pubkey has newer signature, update
            console.info(`Updating key ${contact.longid} for ${contact.email}: newer signature found: ${new Date(fetchedLastSig)} (old ${new Date(contact.pubkey_last_sig)})`);
            await ContactStore.dbContactUpdate(undefined, contact.email, { pubkey: fetchedPubkey, pubkey_last_sig: fetchedLastSig, pubkey_last_check: Date.now() });
            return;
          }
        }
        // we checked for newer key and it did not result in updating the key, don't check again for another week
        await ContactStore.dbContactUpdate(undefined, contact.email, { pubkey_last_check: Date.now() });
      }
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

}
