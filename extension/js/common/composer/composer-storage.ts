/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypcom */

'use strict';

import { ComposerComponent } from './interfaces/composer-component.js';
import { Store, SendAsAlias } from '../platform/store.js';
import { Assert } from '../assert.js';
import { KeyInfo, Pgp, Contact, openpgp } from '../core/pgp.js';
import { Dict } from '../core/common.js';
import { Catch } from '../platform/catch.js';
import { CollectPubkeysResult } from './interfaces/composer-types.js';
import { PubkeySearchResult, Keyserver } from '../api/keyserver.js';
import { Api } from '../api/api.js';
import { PUBKEY_LOOKUP_RESULT_FAIL } from './composer-errs.js';
import { BrowserMsg, Bm } from '../extension.js';

export class ComposerStorage extends ComposerComponent {

  private passphraseInterval: number | undefined;
  private ksLookupsByEmail: { [key: string]: PubkeySearchResult | Contact } = {};

  initActions() {
    BrowserMsg.addListener('passphrase_entry', async ({ entered }: Bm.PassphraseEntry) => {
      if (!entered) {
        clearInterval(this.passphraseInterval);
        this.composer.sendBtn.resetSendBtn();
      }
    });
  }

  async getKey(acctEmail: string, senderEmail: string): Promise<KeyInfo> {
    const keys = await Store.keysGet(acctEmail);
    let result = await this.composer.myPubkey.chooseMyPublicKeyBySenderEmail(keys, senderEmail);
    if (!result) {
      result = keys.find(ki => ki.primary);
      Assert.abortAndRenderErrorIfKeyinfoEmpty(result);
    }
    return result!;
  }

  async draftMetaSet(draftId: string, threadId: string, recipients: string[], subject: string) {
    const draftStorage = await Store.getAcct(this.view.acctEmail, ['drafts_reply', 'drafts_compose']);
    if (threadId) { // it's a reply
      const drafts = draftStorage.drafts_reply || {};
      drafts[threadId] = draftId;
      await Store.setAcct(this.view.acctEmail, { drafts_reply: drafts });
    } else { // it's a new message
      const drafts = draftStorage.drafts_compose || {};
      drafts[draftId] = { recipients, subject, date: new Date().getTime() };
      await Store.setAcct(this.view.acctEmail, { drafts_compose: drafts });
    }
  }

  async draftMetaDelete(draftId: string, threadId: string) {
    const draftStorage = await Store.getAcct(this.view.acctEmail, ['drafts_reply', 'drafts_compose']);
    if (threadId) { // it's a reply
      const drafts = draftStorage.drafts_reply || {};
      delete drafts[threadId];
      await Store.setAcct(this.view.acctEmail, { drafts_reply: drafts });
    } else { // it's a new message
      const drafts = draftStorage.drafts_compose || {};
      delete drafts[draftId];
      await Store.setAcct(this.view.acctEmail, { drafts_compose: drafts });
    }
  }

  async addAdminCodes(shortId: string, codes: string[]) {
    const adminCodeStorage = await Store.getGlobal(['admin_codes']);
    adminCodeStorage.admin_codes = adminCodeStorage.admin_codes || {};
    adminCodeStorage.admin_codes[shortId] = { date: Date.now(), codes };
    await Store.setGlobal(adminCodeStorage);
  }

  async collectAllAvailablePublicKeys(senderEmail: string, senderKi: KeyInfo, recipients: string[]): Promise<CollectPubkeysResult> {
    const contacts = await Store.dbContactGet(undefined, recipients);
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

  async passphraseGet(senderKi?: KeyInfo) {
    if (!senderKi) {
      [senderKi] = await Store.keysGet(this.view.acctEmail, ['primary']);
      Assert.abortAndRenderErrorIfKeyinfoEmpty(senderKi);
    }
    return await Store.passphraseGet(this.view.acctEmail, senderKi.longid);
  }

  async getAddresses(): Promise<Dict<SendAsAlias>> {
    const arrayToSendAs = (arr: string[]): Dict<SendAsAlias> => {
      const result: Dict<SendAsAlias> = {}; // Temporary Solution
      for (let i = 0; i < arr.length; i++) {
        const alias: SendAsAlias = { isDefault: i === 0, isPrimary: arr[i] === this.view.acctEmail }; // before first element was default
        result[arr[i]] = alias;
      }
      if (arr.length) {
        Store.setAcct(this.view.acctEmail, { sendAs: result }).catch(Catch.reportErr);
      }
      return result;
    };
    const storage = await Store.getAcct(this.view.acctEmail, ['sendAs', 'addresses']);
    return storage.sendAs || arrayToSendAs(storage.addresses || [this.view.acctEmail]);
  }

  async lookupPubkeyFromDbOrKeyserverAndUpdateDbIfneeded(email: string): Promise<Contact | "fail"> {
    const [dbContact] = await Store.dbContactGet(undefined, [email]);
    if (dbContact && dbContact.has_pgp && dbContact.pubkey) {
      // Potentially check if pubkey was updated - async. By the time user finishes composing, newer version would have been updated in db.
      // If sender didn't pull a particular pubkey for a long time and it has since expired, but there actually is a newer version on attester, this may unnecessarily show "bad pubkey",
      //      -> until next time user tries to pull it. This could be fixed by attempting to fix up the rendered recipient inside the async function below.
      this.checkKeyserverForNewerVersionOfKnownPubkeyIfNeeded(dbContact).catch(Catch.reportErr);
      return dbContact;
    } else {
      try {
        const lookupResult = await Keyserver.lookupEmail(this.view.acctEmail, email);
        if (lookupResult && email) {
          if (lookupResult.pubkey) {
            const parsed = await openpgp.key.readArmored(lookupResult.pubkey);
            const key = parsed.keys[0];
            if (!key) {
              Catch.log('Dropping found but incompatible public key', { for: email, err: parsed.err ? ' * ' + parsed.err.join('\n * ') : undefined });
              lookupResult.pubkey = null; // tslint:disable-line:no-null-keyword
            } else if (! await Pgp.key.usable(lookupResult.pubkey) && ! await Pgp.key.expired(key)) { // Not to skip expired keys
              Catch.log('Dropping found+parsed key because getEncryptionKeyPacket===null', { for: email, fingerprint: await Pgp.key.fingerprint(parsed.keys[0]) });
              lookupResult.pubkey = null; // tslint:disable-line:no-null-keyword
            }
          }
          const ksContact = await Store.dbContactObj({
            email,
            name: dbContact && dbContact.name ? dbContact.name : undefined,
            client: lookupResult.pgpClient === 'flowcrypt' ? 'cryptup' : 'pgp', // todo - clean up as "flowcrypt|pgp-other'. Already in storage, fixing involves migration
            pubkey: lookupResult.pubkey,
            lastUse: Date.now(),
            lastCheck: Date.now(),
          });
          this.ksLookupsByEmail[email] = ksContact;
          await Store.dbContactSave(undefined, ksContact);
          return ksContact;
        } else {
          return PUBKEY_LOOKUP_RESULT_FAIL;
        }
      } catch (e) {
        if (!Api.err.isNetErr(e) && !Api.err.isServerErr(e)) {
          Catch.reportErr(e);
        }
        return PUBKEY_LOOKUP_RESULT_FAIL;
      }
    }
  }

  async checkKeyserverForNewerVersionOfKnownPubkeyIfNeeded(contact: Contact) {
    try {
      if (!contact.pubkey || !contact.longid) {
        return;
      }
      if (!contact.pubkey_last_sig) {
        const lastSig = await Pgp.key.lastSig(await Pgp.key.read(contact.pubkey));
        contact.pubkey_last_sig = lastSig;
        await Store.dbContactUpdate(undefined, contact.email, { pubkey_last_sig: lastSig });
      }
      if (!contact.pubkey_last_check || new Date(contact.pubkey_last_check).getTime() < Date.now() - (1000 * 60 * 60 * 24 * 7)) { // last update > 7 days ago, or never
        const { pubkey: fetchedPubkey } = await Keyserver.lookupLongid(this.view.acctEmail, contact.longid);
        if (fetchedPubkey) {
          const fetchedLastSig = await Pgp.key.lastSig(await Pgp.key.read(fetchedPubkey));
          if (fetchedLastSig > contact.pubkey_last_sig) { // fetched pubkey has newer signature, update
            console.info(`Updating key ${contact.longid} for ${contact.email}: newer signature found: ${new Date(fetchedLastSig)} (old ${new Date(contact.pubkey_last_sig)})`);
            await Store.dbContactUpdate(undefined, contact.email, { pubkey: fetchedPubkey, pubkey_last_sig: fetchedLastSig, pubkey_last_check: Date.now() });
            return;
          }
        }
        // we checked for newer key and it did not result in updating the key, don't check again for another week
        await Store.dbContactUpdate(undefined, contact.email, { pubkey_last_check: Date.now() });
      }
    } catch (e) {
      if (Api.err.isSignificant(e)) {
        throw e; // insignificant (temporary) errors ignored
      }
    }
  }

  whenMasterPassphraseEntered(secondsTimeout?: number): Promise<string | undefined> {
    return new Promise(resolve => {
      clearInterval(this.passphraseInterval);
      const timeoutAt = secondsTimeout ? Date.now() + secondsTimeout * 1000 : undefined;
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
