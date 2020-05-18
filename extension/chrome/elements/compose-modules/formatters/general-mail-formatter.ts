/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { EncryptedMsgMailFormatter } from './encrypted-mail-msg-formatter.js';
import { KeyInfo, Pubkey } from "../../../../js/common/core/pgp-key.js";
import { NewMsgData } from "../compose-types.js";
import { PlainMsgMailFormatter } from './plain-mail-msg-formatter.js';
import { SendableMsg } from '../../../../js/common/api/email-provider/sendable-msg.js';
import { SignedMsgMailFormatter } from './signed-msg-mail-formatter.js';
import { ComposeView } from '../../compose.js';

export class GeneralMailFormatter {

  public static processNewMsg = async (view: ComposeView, newMsgData: NewMsgData, senderKi: KeyInfo, signingPrv?: Pubkey): Promise<SendableMsg> => {
    const choices = view.sendBtnModule.popover.choices;
    const recipientsEmails = Array.prototype.concat.apply([], Object.values(newMsgData.recipients).filter(arr => !!arr)) as string[];
    if (!choices.encrypt && !choices.sign) { // plain
      return await new PlainMsgMailFormatter(view).sendableMsg(newMsgData);
    }
    if (!choices.encrypt && choices.sign) { // sign only
      view.S.now('send_btn_text').text('Signing...');
      return await new SignedMsgMailFormatter(view).sendableMsg(newMsgData, signingPrv!);
    }
    // encrypt (optionally sign)
    const { armoredPubkeys, emailsWithoutPubkeys } = await view.storageModule.collectAllAvailablePublicKeys(newMsgData.from, senderKi, recipientsEmails);
    if (emailsWithoutPubkeys.length) {
      await view.errModule.throwIfEncryptionPasswordInvalid(senderKi, newMsgData);
    }
    view.S.now('send_btn_text').text('Encrypting...');
    return await new EncryptedMsgMailFormatter(view).sendableMsg(newMsgData, armoredPubkeys, signingPrv);
  }

}
