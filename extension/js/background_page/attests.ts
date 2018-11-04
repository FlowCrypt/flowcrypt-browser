/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store } from '../common/store.js';
import { Catch, Value, Str, Dict } from '../common/common.js';
import { Api, R } from '../common/api.js';
import { Pgp } from '../common/pgp.js';
import { BrowserMsgHandler } from '../common/extension.js';

declare let openpgp: typeof OpenPGP;

type AttestResult = {message: string, acctEmail: string, attestPacketText: string|null};

class AttestError extends Error implements AttestResult {
  attestPacketText: null|string;
  acctEmail: string;
  success: false;
  constructor(msg: string, attestPacketText: string|null, acctEmail: string) {
    super(msg);
    this.attestPacketText = attestPacketText;
    this.acctEmail = acctEmail;
  }
}

export class BgAttests {

  private static CHECK_TIMEOUT = 5 * 1000; // first check in 5 seconds
  private static CHECK_INTERVAL = 5 * 60 * 1000; // subsequent checks every five minutes. Progressive increments would be better
  private static ATTESTERS = {
    CRYPTUP: { email: 'attest@cryptup.org', api: undefined as string|undefined, pubkey: undefined as string|undefined }
  };
  private static currentlyWatching: Dict<number> = {};
  private static attestTsCanReadEmails: Dict<boolean> = {};
  private static packetHeaders = Pgp.armor.headers('attestPacket');

  static watchForAttestEmailIfAppropriate = async () => {
    for (let pending of await BgAttests.getPendingAttestRequests()) {
      if (pending.email && pending.attests_requested && pending.attests_requested.length && BgAttests.attestTsCanReadEmails[pending.email]) {
        BgAttests.watchForAttestEmail(pending.email);
      }
    }
  }

  static attestRequestedHandler: BrowserMsgHandler = async (request: {acctEmail: string}, sender, respond) => {
    respond();
    await BgAttests.getPendingAttestRequests();
    BgAttests.watchForAttestEmail(request.acctEmail);
  }

  static attestPacketreceivedHandler = async (request: {acctEmail: string, packet: string, passphrase: string}, sender: chrome.runtime.MessageSender|'background', respond: (r: {success: boolean, result: string}) => void) => {
    try { // todo - could be refactored to pass AttestResult directly
      let r = await BgAttests.processAttestAndLogResult(request.acctEmail, request.packet, request.passphrase);
      respond({success: true, result: r.message});
    } catch (e) {
      respond({success: false, result: e.message});
    }
  }

  private static watchForAttestEmail = (acctEmail: string) => {
    clearInterval(BgAttests.currentlyWatching[acctEmail]);
    Catch.setHandledTimeout(() => BgAttests.checkEmailForAttestsAndRespond(acctEmail), BgAttests.CHECK_TIMEOUT);
    BgAttests.currentlyWatching[acctEmail] = Catch.setHandledInterval(() => BgAttests.checkEmailForAttestsAndRespond(acctEmail), BgAttests.CHECK_INTERVAL);
  }

  private static stopWatching = (acctEmail: string) => {
    clearInterval(BgAttests.currentlyWatching[acctEmail]);
    delete BgAttests.currentlyWatching[acctEmail];
  }

  private static checkEmailForAttestsAndRespond = async (acctEmail: string) => {
    let storage = await Store.getAcct(acctEmail, ['attests_requested']);
    let [primaryKi] = await Store.keysGet(acctEmail, ['primary']);
    if (primaryKi) {
      let passphrase = await Store.passphraseGet(acctEmail, primaryKi.longid);
      if (passphrase !== null) {
        if (storage.attests_requested && storage.attests_requested.length && BgAttests.attestTsCanReadEmails[acctEmail]) {
          let msgs: R.GmailMsg[];
          try {
            msgs = await BgAttests.fetchAttestEmails(acctEmail);
          } catch(e) {
            if(Api.err.isNetErr(e)) {
              console.info('cannot fetch attest emails - network error - ' + acctEmail);
              return;
            } else if(Api.err.isAuthPopupNeeded(e) || Api.err.isAuthErr(e)) {
              console.info('cannot fetch attest emails - Google auth or token error in bg page - ' + acctEmail);
              return;
            } else if(Api.err.isServerErr(e)) {
              console.info('cannot fetch attest emails - Google server error ' + acctEmail);
              return;
            } else {
              throw e;
            }
          }
          for (let msg of msgs) {
            if (msg.payload.mimeType === 'text/plain' && msg.payload.body && msg.payload.body.size > 0 && msg.payload.body.data) {
              await BgAttests.processAttestAndLogResult(acctEmail, Str.base64urlDecode(msg.payload.body.data), passphrase);
            }
          }
        } else {
          await BgAttests.addAttestLog(false, new AttestError('cannot fetch attest emails for ' + acctEmail, null, acctEmail));
          BgAttests.stopWatching(acctEmail);
        }
      } else {
        console.info('cannot get pass phrase for signing - skip fetching attest emails for ' + acctEmail);
      }
    } else {
      console.info('no primary key set yet - skip fetching attest emails for ' + acctEmail);
    }
  }

  private static processAttestPacketText = async (acctEmail: string, attestPacketText: string, passphrase: string|null): Promise<AttestResult> => {
    let attest = Api.attester.packet.parse(attestPacketText);
    let [primaryKi] = await Store.keysGet(acctEmail, ['primary']);
    if (!primaryKi) {
      BgAttests.stopWatching(acctEmail);
      return {attestPacketText, message: `No primary_ki for ${acctEmail}`, acctEmail};
    }
    let key = openpgp.key.readArmored(primaryKi.private).keys[0];
    let {attests_processed} = await Store.getAcct(acctEmail, ['attests_processed']);
    if (!Value.is(attest.content.attester).in(attests_processed || [])) {
      let storedPassphrase = await Store.passphraseGet(acctEmail, primaryKi.longid);
      if (await Pgp.key.decrypt(key, [passphrase || storedPassphrase || '']) === true) {
        let expectedFingerprint = key.primaryKey.getFingerprint().toUpperCase();
        let expectedEmailHash = Pgp.hash.doubleSha1Upper(Str.parseEmail(acctEmail).email);
        if (attest && attest.success && attest.text) {
          if(attest.content.attester && attest.content.attester in BgAttests.ATTESTERS && attest.content.fingerprint === expectedFingerprint && attest.content.email_hash === expectedEmailHash) {
            let signed;
            try {
              signed = await Pgp.msg.sign(key, attest.text);
            } catch (e) {
              throw new AttestError(`Error signing the attest. Email human@flowcrypt.com to find out why: ${e.message}`, attestPacketText, acctEmail);
            }
            try {
              let apiRes;
              if (attest.content.action !== 'CONFIRM_REPLACEMENT') {
                apiRes = await Api.attester.initialConfirm(signed);
              } else {
                apiRes = await Api.attester.replaceConfirm(signed);
              }
              if (!apiRes.attested) {
                throw new AttestError(`Refused by Attester. Email human@flowcrypt.com to find out why.\n\n${JSON.stringify(apiRes)}`, attestPacketText, acctEmail);
              }
            } catch (e) {
              if(Api.err.isNetErr(e)) {
                throw new AttestError('Attester API not available (network error)', attestPacketText, acctEmail);
              }
              throw new AttestError(`Error while calling Attester API. Email human@flowcrypt.com to find out why.\n\n${e.message}`, attestPacketText, acctEmail);
            }
            await BgAttests.acctStorageMarkAsAttested(acctEmail, attest.content.attester);
            return {attestPacketText, message: `Successfully attested ${acctEmail}`, acctEmail};
          } else {
            throw new AttestError('This attest message is ignored as it does not match your settings.\n\nEmail human@flowcrypt.com to help.', attestPacketText, acctEmail);
          }
        } else {
          throw new AttestError('Could not parse this attest message.', attestPacketText, acctEmail);
        }
      } else {
        throw new AttestError('Missing pass phrase to process this attest message.\n\nIt will be processed automatically later.', attestPacketText, acctEmail);
      }
    } else {
      BgAttests.stopWatching(acctEmail);
      return {attestPacketText, message: `Already attested ${acctEmail}`, acctEmail};
    }
  }

  private static processAttestAndLogResult = async (acctEmail: string, attestPacketText: string, passphrase: string|null) => {
    try {
      return await BgAttests.addAttestLog(true, await BgAttests.processAttestPacketText(acctEmail, attestPacketText, passphrase));
    } catch (e) {
      e.acctEmail = acctEmail;
      e.attestPacketText = attestPacketText;
      return await BgAttests.addAttestLog(false, e);
    }
  }

  private static fetchAttestEmails = async (acctEmail: string): Promise<R.GmailMsg[]> => {
    let q = [
      '(from:"' + BgAttests.getAttesterEmails().join('" OR from: "') + '")',
      'to:' + acctEmail, // for now limited to account email only. Alternative addresses won't work.
      'in:anywhere',
      '"' + BgAttests.packetHeaders.begin + '"',
      '"' + BgAttests.packetHeaders.end + '"',
    ];
    let listRes = await Api.gmail.msgList(acctEmail, q.join(' '), true);
    return Api.gmail.msgsGet(acctEmail, (listRes.messages || []).map(m => m.id), 'full');
  }

  private static getPendingAttestRequests = async () => {
    let acctEmails = await Store.acctEmailsGet();
    let storages = await Store.getAccounts(acctEmails, ['attests_requested', 'google_token_scopes']);
    let pending = [];
    for (let email of Object.keys(storages)) {
      BgAttests.attestTsCanReadEmails[email] = Api.gmail.hasScope(storages[email].google_token_scopes || [], 'read');
      pending.push({email, attests_requested: storages[email].attests_requested || []});
    }
    return pending;
  }

  private static getAttesterEmails = () => {
    let emails: string[] = [];
    for (let attester of Object.values(BgAttests.ATTESTERS)) {
      emails.push(attester.email);
    }
    return emails;
  }

  private static acctStorageMarkAsAttested = async (acctEmail: string, attester: string) => {
    BgAttests.stopWatching(acctEmail);
    let storage = await Store.getAcct(acctEmail, ['attests_requested', 'attests_processed']);
    if (storage.attests_requested && Value.is(attester).in(storage.attests_requested)) {
      storage.attests_requested.splice(storage.attests_requested.indexOf(attester), 1); // remove attester from requested
      if (typeof storage.attests_processed === 'undefined') {
        storage.attests_processed = [];
      }
      if (!Value.is(attester).in(storage.attests_processed)) {
        storage.attests_processed.push(attester); // add attester as processed if not already there
      }
      await Store.set(acctEmail, storage);
    }
  }

  private static addAttestLog = async (success: boolean, ar: AttestResult) => {
    console.log('attest result ' + success + ': ' + ar.message);
    let storage = await Store.getAcct(ar.acctEmail, ['attest_log']);
    if (!storage.attest_log) {
      storage.attest_log = [];
    } else if (storage.attest_log.length > 100) { // todo - should do a rolling delete to always keep last X
      storage.attest_log = [{attempt: 100, success: false, result: 'DELETED 100 LOGS'}];
    }
    storage.attest_log.push({attempt: storage.attest_log.length + 1, packet: String(ar.attestPacketText), success, result: ar.message});
    await Store.set(ar.acctEmail, storage);
    return ar;
  }

}
