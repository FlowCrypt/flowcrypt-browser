/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch } from '../common/platform/catch.js';
import { Store } from '../common/platform/store.js';
import { Value, Str, Dict } from '../common/core/common.js';
import { Api, R } from '../common/api/api.js';
import { Pgp, PgpMsg } from '../common/core/pgp.js';
import { Bm } from '../common/extension.js';
import { Google, GoogleAuth, GoogleAcctNotConnected } from '../common/api/google.js';
import { Buf } from '../common/core/buf.js';

declare const openpgp: typeof OpenPGP;

type AttestResult = { message: string, acctEmail: string, attestPacketText: string | undefined };

class AttestError extends Error implements AttestResult {
  attestPacketText: undefined | string;
  acctEmail: string;
  success: false = false;
  constructor(msg: string, attestPacketText: string | undefined, acctEmail: string) {
    super(msg);
    this.attestPacketText = attestPacketText;
    this.acctEmail = acctEmail;
  }
}

export class BgAttests {

  private static CHECK_TIMEOUT = 5 * 1000; // first check in 5 seconds
  private static CHECK_INTERVAL = 5 * 60 * 1000; // subsequent checks every five minutes. Progressive increments would be better
  private static ATTESTERS = { CRYPTUP: { email: 'attest@cryptup.org' } };
  private static currentlyWatching: Dict<number> = {};
  private static attestTsCanReadEmails: Dict<boolean> = {};
  private static packetHeaders = Pgp.armor.headers('attestPacket');

  static watchForAttestEmailIfAppropriate = async () => {
    for (const pending of await BgAttests.getPendingAttestRequests()) {
      if (pending.email && pending.attests_requested && pending.attests_requested.length && BgAttests.attestTsCanReadEmails[pending.email]) {
        BgAttests.watchForAttestEmail(pending.email);
      }
    }
  }

  static attestRequestedHandler: Bm.AsyncResponselessHandler = async ({ acctEmail }: Bm.AttestRequested) => {
    await BgAttests.getPendingAttestRequests();
    BgAttests.watchForAttestEmail(acctEmail);
  }

  static attestPacketReceivedHandler = async ({ acctEmail, packet, passphrase }: Bm.AttestPacketReceived): Promise<Bm.Res.AttestPacketReceived> => {
    try { // todo - could be refactored to pass AttestResult directly
      const { message } = await BgAttests.processAttestAndLogResult(acctEmail, packet, passphrase);
      return { success: true, result: message };
    } catch (e) {
      return { success: false, result: String(e) };
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
    const storage = await Store.getAcct(acctEmail, ['attests_requested']);
    const [primaryKi] = await Store.keysGet(acctEmail, ['primary']);
    if (primaryKi) {
      const passphrase = await Store.passphraseGet(acctEmail, primaryKi.longid);
      if (typeof passphrase !== 'undefined') {
        if (storage.attests_requested && storage.attests_requested.length && BgAttests.attestTsCanReadEmails[acctEmail]) {
          let msgs: R.GmailMsg[];
          try {
            msgs = await BgAttests.fetchAttestEmails(acctEmail);
          } catch (e) {
            if (Api.err.isNetErr(e)) {
              console.info('cannot fetch attest emails - network error - ' + acctEmail);
              return;
            } else if (Api.err.isAuthPopupNeeded(e) || Api.err.isAuthErr(e)) {
              console.info('cannot fetch attest emails - Google auth or token error in bg page - ' + acctEmail);
              return;
            } else if (Api.err.isServerErr(e)) {
              console.info('cannot fetch attest emails - Google server error ' + acctEmail);
              return;
            } else if (Api.err.isMailOrAcctDisabled(e)) {
              await BgAttests.addAttestLog(false, new AttestError('cannot fetch attest emails - Account or Gmail disabled: ' + acctEmail, undefined, acctEmail));
              BgAttests.stopWatching(acctEmail);
              return;
            } else if (e instanceof GoogleAcctNotConnected) {
              await BgAttests.addAttestLog(false, new AttestError('cannot fetch attest emails - Account not connected: ' + acctEmail, undefined, acctEmail));
              BgAttests.stopWatching(acctEmail);
              return;
            } else {
              throw e;
            }
          }
          for (const msg of msgs) {
            if (msg.payload.mimeType === 'text/plain' && msg.payload.body && msg.payload.body.size > 0 && msg.payload.body.data) {
              await BgAttests.processAttestAndLogResult(acctEmail, Buf.fromBase64UrlStr(msg.payload.body.data).toUtfStr(), passphrase);
            }
          }
        } else {
          await BgAttests.addAttestLog(false, new AttestError('cannot fetch attest emails for ' + acctEmail, undefined, acctEmail));
          BgAttests.stopWatching(acctEmail);
        }
      } else {
        console.info('cannot get pass phrase for signing - skip fetching attest emails for ' + acctEmail);
      }
    } else {
      console.info('no primary key set yet - skip fetching attest emails for ' + acctEmail);
    }
  }

  private static processAttestPacketText = async (acctEmail: string, attestPacketText: string, passphrase: string | undefined): Promise<AttestResult> => {
    const attest = Api.attester.packet.parse(attestPacketText);
    const [primaryKi] = await Store.keysGet(acctEmail, ['primary']);
    if (!primaryKi) {
      BgAttests.stopWatching(acctEmail);
      return { attestPacketText, message: `No primary_ki for ${acctEmail}`, acctEmail };
    }
    const { keys: [prv] } = await openpgp.key.readArmored(primaryKi.private);
    const { attests_processed } = await Store.getAcct(acctEmail, ['attests_processed']);
    if (Value.is(attest.content.attester).in(attests_processed || [])) {
      BgAttests.stopWatching(acctEmail);
      return { attestPacketText, message: `Already attested ${acctEmail}`, acctEmail };
    }
    const storedPassphrase = await Store.passphraseGet(acctEmail, primaryKi.longid);
    if (prv.isDecrypted()) {
      throw new AttestError('Will not attest unprotected key', attestPacketText, acctEmail);
    }
    try {
      if (await Pgp.key.decrypt(prv, [passphrase || storedPassphrase || '']) !== true) {
        throw new AttestError('Missing pass phrase to process this attest message.\n\nIt will be processed automatically later.', attestPacketText, acctEmail);
      }
    } catch (e) {
      throw new AttestError(`Error decrypting key: ${String(e)}`, attestPacketText, acctEmail);
    }
    const expectedFingerprint = prv.primaryKey.getFingerprint().toUpperCase();
    const expectedEmailHash = await Pgp.hash.doubleSha1Upper(Str.parseEmail(acctEmail).email);
    if (!attest || !attest.success || !attest.text) {
      throw new AttestError('Could not parse this attest message.', attestPacketText, acctEmail);
    }
    const isKnownAttester = attest.content.attester && attest.content.attester in BgAttests.ATTESTERS;
    if (!isKnownAttester || attest.content.fingerprint !== expectedFingerprint || attest.content.email_hash !== expectedEmailHash) {
      throw new AttestError('This attest message is ignored as it does not match your settings.\n\nEmail human@flowcrypt.com to help.', attestPacketText, acctEmail);
    }
    let signed;
    try {
      signed = await PgpMsg.sign(prv, attest.text);
    } catch (e) {
      throw new AttestError(`Error signing the attest. Email human@flowcrypt.com to find out why: ${String(e)}`, attestPacketText, acctEmail);
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
      if (Api.err.isNetErr(e)) {
        throw new AttestError('Attester API not available (network error)', attestPacketText, acctEmail);
      }
      throw new AttestError(`Error while calling Attester API. Email human@flowcrypt.com to find out why.\n\n${String(e)}`, attestPacketText, acctEmail);
    }
    await BgAttests.acctStorageMarkAsAttested(acctEmail, attest.content.attester!);
    return { attestPacketText, message: `Successfully attested ${acctEmail}`, acctEmail };
  }

  private static processAttestAndLogResult = async (acctEmail: string, attestPacketText: string, passphrase: string | undefined): Promise<AttestResult | AttestError> => {
    try {
      return await BgAttests.addAttestLog(true, await BgAttests.processAttestPacketText(acctEmail, attestPacketText, passphrase));
    } catch (e) {
      if (e instanceof AttestError) {
        return e;
      }
      Catch.reportErr(e);
      return new AttestError(String(e), attestPacketText, acctEmail);
    }
  }

  private static fetchAttestEmails = async (acctEmail: string): Promise<R.GmailMsg[]> => {
    const q = [
      '(from:"' + BgAttests.getAttesterEmails().join('" OR from: "') + '")',
      'to:' + acctEmail, // for now limited to account email only. Alternative addresses won't work.
      'in:anywhere',
      '"' + BgAttests.packetHeaders.begin + '"',
      '"' + BgAttests.packetHeaders.end + '"',
    ];
    const listRes = await Google.gmail.msgList(acctEmail, q.join(' '), true);
    return Google.gmail.msgsGet(acctEmail, (listRes.messages || []).map(m => m.id), 'full');
  }

  private static getPendingAttestRequests = async () => {
    const acctEmails = await Store.acctEmailsGet();
    const storages = await Store.getAccounts(acctEmails, ['attests_requested', 'google_token_scopes']);
    const pending = [];
    for (const email of Object.keys(storages)) {
      BgAttests.attestTsCanReadEmails[email] = GoogleAuth.hasReadScope(storages[email].google_token_scopes || []);
      pending.push({ email, attests_requested: storages[email].attests_requested || [] });
    }
    return pending;
  }

  private static getAttesterEmails = () => {
    const emails: string[] = [];
    for (const attester of Object.values(BgAttests.ATTESTERS)) {
      emails.push(attester.email);
    }
    return emails;
  }

  private static acctStorageMarkAsAttested = async (acctEmail: string, attester: string) => {
    BgAttests.stopWatching(acctEmail);
    const storage = await Store.getAcct(acctEmail, ['attests_requested', 'attests_processed']);
    if (storage.attests_requested && Value.is(attester).in(storage.attests_requested)) {
      storage.attests_requested.splice(storage.attests_requested.indexOf(attester), 1); // remove attester from requested
      if (typeof storage.attests_processed === 'undefined') {
        storage.attests_processed = [];
      }
      if (!Value.is(attester).in(storage.attests_processed)) {
        storage.attests_processed.push(attester); // add attester as processed if not already there
      }
      await Store.setAcct(acctEmail, storage);
    }
  }

  private static addAttestLog = async (success: boolean, ar: AttestResult) => {
    console.info('attest result ' + success + ': ' + ar.message);
    const storage = await Store.getAcct(ar.acctEmail, ['attest_log']);
    if (!storage.attest_log) {
      storage.attest_log = [];
    } else if (storage.attest_log.length > 100) { // todo - should do a rolling delete to always keep last X
      storage.attest_log = [{ attempt: 100, success: false, result: 'DELETED 100 LOGS' }];
    }
    storage.attest_log.push({ attempt: storage.attest_log.length + 1, packet: String(ar.attestPacketText), success, result: ar.message });
    await Store.setAcct(ar.acctEmail, storage);
    return ar;
  }

}
