/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { EncryptedMsgMailFormatter } from './encrypted-mail-msg-formatter.js';
import { KeyInfoWithIdentity } from '../../../../js/common/core/crypto/key.js';
import { getUniqueRecipientEmails, NewMsgData } from '../compose-types.js';
import { PlainMsgMailFormatter } from './plain-mail-msg-formatter.js';
import { SendableMsg } from '../../../../js/common/api/email-provider/sendable-msg.js';
import { SignedMsgMailFormatter } from './signed-msg-mail-formatter.js';
import { ComposeView } from '../../compose.js';
import { KeyStoreUtil, ParsedKeyInfo } from '../../../../js/common/core/crypto/key-store-util.js';
import { UnreportableError } from '../../../../js/common/platform/catch.js';
import { ParsedRecipients } from '../../../../js/common/api/email-provider/email-provider-api.js';
import { Attachment } from '../../../../js/common/core/attachment.js';

export type MultipleMessages = {
  msgs: SendableMsg[];
  senderKi: KeyInfoWithIdentity | undefined;
  renderSentMessage: { recipients: ParsedRecipients; attachments: Attachment[] };
};

export class GeneralMailFormatter {
  // returns undefined in case user cancelled decryption of the signing key
  public static async processNewMsg(view: ComposeView, newMsgData: NewMsgData): Promise<MultipleMessages> {
    const choices = view.sendBtnModule.popover.choices;
    const recipientsEmails = getUniqueRecipientEmails(newMsgData.recipients);
    if (!choices.encrypt && !choices.sign) {
      // plain
      view.S.now('send_btn_text').text('Formatting...');
      const msg = await new PlainMsgMailFormatter(view).sendableMsg(newMsgData);
      return {
        senderKi: undefined,
        msgs: [msg],
        renderSentMessage: { recipients: msg.recipients, attachments: msg.attachments },
      };
    }
    if (!choices.encrypt && choices.sign) {
      // sign only
      view.S.now('send_btn_text').text('Signing...');
      const senderKis = await view.storageModule.getAccountKeys(newMsgData.from.email);
      const signingKey = await GeneralMailFormatter.chooseSigningKeyAndDecryptIt(view, senderKis);
      if (!signingKey) {
        throw new UnreportableError("Could not find account's key usable for signing this plain text message");
      }
      /* eslint-disable @typescript-eslint/no-non-null-assertion */
      const msg = await new SignedMsgMailFormatter(view).sendableMsg(newMsgData, signingKey!.key);
      return {
        senderKi: signingKey!.keyInfo,
        msgs: [msg],
        renderSentMessage: { recipients: msg.recipients, attachments: msg.attachments },
      };
    }
    // encrypt (optionally sign)
    const singleFamilyKeys = await view.storageModule.collectSingleFamilyKeys(recipientsEmails, newMsgData.from.email, choices.sign);
    if (singleFamilyKeys.emailsWithoutPubkeys.length) {
      await view.errModule.throwIfEncryptionPasswordInvalidOrDisabled(newMsgData);
    }
    let signingKey: ParsedKeyInfo | undefined;
    if (choices.sign) {
      signingKey = await GeneralMailFormatter.chooseSigningKeyAndDecryptIt(view, singleFamilyKeys.senderKis);
      if (!signingKey && singleFamilyKeys.family === 'openpgp') {
        // we are ignoring missing signing keys for x509 family for now. We skip signing when missing
        //   see https://github.com/FlowCrypt/flowcrypt-browser/pull/4372/files#r845012403
        throw new UnreportableError(`Could not find account's ${singleFamilyKeys.family} key usable for signing this encrypted message`);
      }
    }
    view.S.now('send_btn_text').text('Encrypting...');
    return await new EncryptedMsgMailFormatter(view).sendableMsgs(newMsgData, singleFamilyKeys.pubkeys, signingKey);
  }

  private static async chooseSigningKeyAndDecryptIt(view: ComposeView, senderKis: KeyInfoWithIdentity[]): Promise<ParsedKeyInfo | undefined> {
    const parsedSenderPrvs = await KeyStoreUtil.parse(senderKis);
    // to consider - currently we choose first valid key for signing. Should we sign with all?
    //   alternatively we could use most recenlty modified valid key
    const parsedSenderPrv = parsedSenderPrvs.find(k => k.key.usableForSigning);
    if (!parsedSenderPrv) {
      return undefined;
    }
    // throws ComposerResetBtnTrigger when user closes pass phrase dialog without entering
    return await view.storageModule.decryptSenderKey(parsedSenderPrv);
  }
}
