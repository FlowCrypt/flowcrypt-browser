/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypcom */

'use strict';

import { Composer } from "../composer.js";
import { EncryptedMsgMailFormatter } from './encrypted-mail-msg-formatter.js';
import { KeyInfo } from "../../../../js/common/core/pgp-key.js";
import { NewMsgData } from "../composer-types.js";
import { PlainMsgMailFormatter } from './plain-mail-msg-formatter.js';
import { SendableMsg } from '../../../../js/common/api/email_provider/email_provider_api.js';
import { SignedMsgMailFormatter } from './signed-msg-mail-formatter.js';

export class GeneralMailFormatter {

  static processNewMsg = async (composer: Composer, newMsgData: NewMsgData, senderKi: KeyInfo, signingPrv?: OpenPGP.key.Key): Promise<SendableMsg> => {
    const choices = composer.sendBtn.popover.choices;
    const recipientsEmails = Array.prototype.concat.apply([], Object.values(newMsgData.recipients).filter(arr => !!arr)) as string[];
    if (!choices.encrypt && !choices.sign) { // plain
      return await new PlainMsgMailFormatter(composer).sendableMsg(newMsgData);
    }
    if (!choices.encrypt && choices.sign) { // sign only
      composer.S.now('send_btn_text').text('Signing...');
      return await new SignedMsgMailFormatter(composer).sendableMsg(newMsgData, signingPrv!);
    }
    // encrypt (optionally sign)
    const { armoredPubkeys, emailsWithoutPubkeys } = await composer.storage.collectAllAvailablePublicKeys(newMsgData.sender, senderKi, recipientsEmails);
    if (emailsWithoutPubkeys.length) {
      await composer.errs.throwIfEncryptionPasswordInvalid(senderKi, newMsgData);
    }
    composer.S.now('send_btn_text').text('Encrypting...');
    return await new EncryptedMsgMailFormatter(composer, armoredPubkeys).sendableMsg(newMsgData, signingPrv);
  }

}
