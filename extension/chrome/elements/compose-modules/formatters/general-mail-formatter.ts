/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { EncryptedMsgMailFormatter } from './encrypted-mail-msg-formatter.js';
import { Key, KeyInfo } from "../../../../js/common/core/crypto/key.js";
import { getUniqueRecipientEmails, NewMsgData } from "../compose-types.js";
import { PlainMsgMailFormatter } from './plain-mail-msg-formatter.js';
import { SendableMsg } from '../../../../js/common/api/email-provider/sendable-msg.js';
import { SignedMsgMailFormatter } from './signed-msg-mail-formatter.js';
import { ComposeView } from '../../compose.js';

export class GeneralMailFormatter {

  // returns undefined in case user cancelled decryption of the signing key
  public static processNewMsg = async (view: ComposeView, newMsgData: NewMsgData): Promise<{ msg: SendableMsg, senderKi: KeyInfo | undefined } | undefined> => {
    const choices = view.sendBtnModule.popover.choices;
    const recipientsEmails = getUniqueRecipientEmails(newMsgData.recipients);
    if (!choices.encrypt && !choices.sign) { // plain
      return { senderKi: undefined, msg: await new PlainMsgMailFormatter(view).sendableMsg(newMsgData) };
    }
    let signingPrv: Key | undefined;
    if (!choices.encrypt && choices.sign) { // sign only
      view.S.now('send_btn_text').text('Signing...');
      const senderKi = await view.storageModule.getKey(newMsgData.from);
      signingPrv = await view.storageModule.decryptSenderKey(senderKi);
      if (!signingPrv) {
        return undefined;
      }
      return { senderKi, msg: await new SignedMsgMailFormatter(view).sendableMsg(newMsgData, signingPrv) };
    }
    // encrypt (optionally sign)
    const result = await view.storageModule.collectSingleFamilyKeys(recipientsEmails, newMsgData.from, choices.sign);
    if (choices.sign && result.senderKi !== undefined) {
      signingPrv = await view.storageModule.decryptSenderKey(result.senderKi);
      if (!signingPrv) {
        return undefined;
      }
    }
    if (result.emailsWithoutPubkeys.length) {
      await view.errModule.throwIfEncryptionPasswordInvalid(newMsgData);
    }
    view.S.now('send_btn_text').text('Encrypting...');
    return { senderKi: result.senderKi, msg: await new EncryptedMsgMailFormatter(view).sendableMsg(newMsgData, result.pubkeys, signingPrv) };
  };

}
