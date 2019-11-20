/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypcom */

'use strict';

import { NewMsgData } from "../interfaces/composer-types.js";
import { KeyInfo } from "../../core/pgp.js";
import { Composer } from "../composer.js";
import { PlainMsgMailFormatter } from './plain-mail-msg-formatter.js';
import { SignedMsgMailFormatter } from './signed-msg-mail-formatter.js';
import { EncryptedMsgMailFormatter } from './encrypted-mail-msg-formatter.js';
import { SendableMsg } from '../../api/email_provider_api.js';

export class GeneralMailFormatter {

  static async processNewMsg(composer: Composer, newMsgData: NewMsgData, senderKi: KeyInfo, signingPrv?: OpenPGP.key.Key): Promise<SendableMsg> {
    const choices = composer.sendBtn.popover.choices;
    const recipientsEmails = Array.prototype.concat.apply([], Object.values(newMsgData.recipients).filter(arr => !!arr)) as string[];
    if (!choices.encrypt && !choices.sign) { // plain
      return await new PlainMsgMailFormatter(composer).sendableMsg(newMsgData);
    }
    if (!choices.encrypt && choices.sign) { // sign only
      composer.S.now('send_btn_text').text('Signing');
      return await new SignedMsgMailFormatter(composer).sendableMsg(newMsgData, signingPrv!);
    }
    // encrypt (optionally sign)
    const { armoredPubkeys, emailsWithoutPubkeys } = await composer.app.collectAllAvailablePublicKeys(newMsgData.sender, senderKi, recipientsEmails);
    if (emailsWithoutPubkeys.length) {
      await composer.errs.throwIfEncryptionPasswordInvalid(senderKi, newMsgData);
    }
    composer.S.now('send_btn_text').text('Encrypting');
    return await new EncryptedMsgMailFormatter(composer, armoredPubkeys).sendableMsg(newMsgData, signingPrv);
  }

}
