/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypcom */

'use strict';

import { NewMsgData } from '../interfaces/composer-types.js';
import { SendableMsg } from '../../api/email_provider_api.js';
import { MailFormatterInterface, BaseMailFormatter } from './base-mail-formatter.js';
import { Composer } from '../composer.js';
import { PgpMsg } from '../../core/pgp.js';
import { BrowserWidnow } from '../../extension.js';
import { Google } from '../../api/google.js';
import { Catch } from '../../platform/catch.js';

export class SignedMsgMailFormatter extends BaseMailFormatter implements MailFormatterInterface {

  private signingPrv: OpenPGP.key.Key;

  constructor(composer: Composer, newMsgData: NewMsgData, signingPrv: OpenPGP.key.Key) {
    super(composer, newMsgData);
    this.signingPrv = signingPrv;
  }

  async createMsgObject(): Promise<SendableMsg> {
    // Folding the lines or GMAIL WILL RAPE THE TEXT, regardless of what encoding is used
    // https://mathiasbynens.be/notes/gmail-plain-text applies to API as well
    // resulting in.. wait for it.. signatures that don't match
    // if you are reading this and have ideas about better solutions which:
    //  - don't involve text/html ( Enigmail refuses to fix: https://sourceforge.net/p/enigmail/bugs/218/ - Patrick Brunschwig - 2017-02-12 )
    //  - don't require text to be sent as an attachment
    //  - don't require all other clients to support PGP/MIME
    // then please const me know. Eagerly waiting! In the meanwhile..
    this.newMsgData.plaintext = (window as unknown as BrowserWidnow)['emailjs-mime-codec'].foldLines(this.newMsgData.plaintext, 76, true); // tslint:disable-line:no-unsafe-any
    // Gmail will also remove trailing spaces on the end of each line in transit, causing signatures that don't match
    // Removing them here will prevent Gmail from screwing up the signature
    this.newMsgData.plaintext = this.newMsgData.plaintext.split('\n').map(l => l.replace(/\s+$/g, '')).join('\n').trim();
    const signedData = await PgpMsg.sign(this.signingPrv, this.newMsgData.plaintext);
    const atts = await this.composer.composerAtts.attach.collectAtts(); // todo - not signing attachments
    const allContacts = [...this.newMsgData.recipients.to || [], ...this.newMsgData.recipients.cc || [], ...this.newMsgData.recipients.bcc || []];
    this.composer.app.storageContactUpdate(allContacts, { last_use: Date.now() }).catch(Catch.reportErr);
    const body = { 'text/plain': signedData };
    return await Google.createMsgObj(this.urlParams.acctEmail, this.newMsgData.sender, this.newMsgData.recipients, this.newMsgData.subject, body, atts, this.urlParams.threadId);
  }
}
