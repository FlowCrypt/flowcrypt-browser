/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypcom */

'use strict';

import { NewMsgData } from '../interfaces/composer-types.js';
import { SendableMsg } from '../../api/email_provider_api.js';
import { PgpMsg } from '../../core/pgp.js';
import { BrowserWidnow } from '../../extension.js';
import { Google } from '../../api/google.js';
import { Catch } from '../../platform/catch.js';
import { ComposerUserError } from '../composer-errs.js';
import { BaseMailFormatter, MailFormatterInterface } from './base-mail-formatter.js';

export class SignedMsgMailFormatter extends BaseMailFormatter implements MailFormatterInterface {

  async sendableMsg(newMsgData: NewMsgData, signingPrv: OpenPGP.key.Key): Promise<SendableMsg> {
    if (this.richText) {
      this.composer.sendBtn.popover.toggleItemTick($('.action-toggle-richText-sending-option'), 'richText', false); // do not use rich text
      throw new ComposerUserError('Rich text is not yet supported for signed messages, please retry (formatting will be removed).');
    }
    // Folding the lines or GMAIL WILL RAPE THE TEXT, regardless of what encoding is used
    // https://mathiasbynens.be/notes/gmail-plain-text applies to API as well
    // resulting in.. wait for it.. signatures that don't match
    // if you are reading this and have ideas about better solutions which:
    //  - don't involve text/html ( Enigmail refuses to fix: https://sourceforge.net/p/enigmail/bugs/218/ - Patrick Brunschwig - 2017-02-12 )
    //  - don't require text to be sent as an attachment
    //  - don't require all other clients to support PGP/MIME
    // then please const me know. Eagerly waiting! In the meanwhile..
    newMsgData.plaintext = (window as unknown as BrowserWidnow)['emailjs-mime-codec'].foldLines(newMsgData.plaintext, 76, true); // tslint:disable-line:no-unsafe-any
    // Gmail will also remove trailing spaces on the end of each line in transit, causing signatures that don't match
    // Removing them here will prevent Gmail from screwing up the signature
    newMsgData.plaintext = newMsgData.plaintext.split('\n').map(l => l.replace(/\s+$/g, '')).join('\n').trim();
    const signedData = await PgpMsg.sign(signingPrv, newMsgData.plaintext);
    const atts = await this.composer.atts.attach.collectAtts(); // todo - not signing attachments
    const allContacts = [...newMsgData.recipients.to || [], ...newMsgData.recipients.cc || [], ...newMsgData.recipients.bcc || []];
    this.composer.app.storageContactUpdate(allContacts, { last_use: Date.now() }).catch(Catch.reportErr);
    const body = { 'text/plain': signedData };
    return await Google.createMsgObj(this.composer.urlParams.acctEmail, newMsgData.sender, newMsgData.recipients, newMsgData.subject, body, atts, this.composer.urlParams.threadId);
  }

}
