/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { BaseMailFormatter } from './base-mail-formatter.js';
import { BrowserWindow } from '../../../../js/common/browser/browser-window.js';
import { Catch } from '../../../../js/common/platform/catch.js';
import { NewMsgData } from '../compose-types.js';
import { Key } from '../../../../js/common/core/crypto/key.js';
import { PgpUtil } from '../../../../js/common/core/crypto/pgp/pgp-msg.js';
import { SendableMsg } from '../../../../js/common/api/email-provider/sendable-msg.js';
import { SendableMsgBody } from '../../../../js/common/core/mime.js';
import { ContactStore } from '../../../../js/common/platform/store/contact-store.js';

export class SignedMsgMailFormatter extends BaseMailFormatter {

  public sendableMsg = async (newMsg: NewMsgData, signingPrv: Key): Promise<SendableMsg> => {
    this.view.errModule.debug(`SignedMsgMailFormatter.sendableMsg signing with key: ${signingPrv.id}`);
    const atts = this.isDraft ? [] : await this.view.attsModule.attach.collectAtts();
    if (!this.richtext) {
      // Folding the lines or GMAIL WILL RAPE THE TEXT, regardless of what encoding is used
      // https://mathiasbynens.be/notes/gmail-plain-text applies to API as well
      // resulting in.. wait for it.. signatures that don't match
      // if you are reading this and have ideas about better solutions which:
      //  - don't involve text/html ( Enigmail refuses to fix: https://sourceforge.net/p/enigmail/bugs/218/ - Patrick Brunschwig - 2017-02-12 )
      //  - don't require text to be sent as an attachment
      //  - don't require all other clients to support PGP/MIME
      // then please const me know. Eagerly waiting! In the meanwhile..
      newMsg.plaintext = (window as unknown as BrowserWindow)['emailjs-mime-codec'].foldLines(newMsg.plaintext, 76, true); // tslint:disable-line:no-unsafe-any
      // Gmail will also remove trailing spaces on the end of each line in transit, causing signatures that don't match
      // Removing them here will prevent Gmail from screwing up the signature
      newMsg.plaintext = newMsg.plaintext.split('\n').map(l => l.replace(/\s+$/g, '')).join('\n').trim();
      const signedData = await PgpUtil.sign(signingPrv, newMsg.plaintext);
      const allContacts = [...newMsg.recipients.to || [], ...newMsg.recipients.cc || [], ...newMsg.recipients.bcc || []];
      ContactStore.update(undefined, allContacts, { last_use: Date.now() }).catch(Catch.reportErr);
      const body = { 'text/plain': signedData };
      return await SendableMsg.create(this.acctEmail, { ...this.headers(newMsg), body, atts });
    }
    // pgp/mime detached signature - it must be signed later, while being mime-encoded
    // prepare a sign function first, which will be used by Mime.encodePgpMimeSigned later
    const body: SendableMsgBody = { 'text/plain': newMsg.plaintext, 'text/html': newMsg.plainhtml };
    const sendable = await SendableMsg.create(this.acctEmail, { ...this.headers(newMsg), body, atts, type: 'pgpMimeSigned' });
    sendable.setSignMethod((signable: string) => PgpUtil.sign(signingPrv, signable, true));
    return sendable;
  }

}
