/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { EncryptedMsgMailFormatter } from './encrypted-mail-msg-formatter.js';
import { KeyInfoWithIdentity } from "../../../../js/common/core/crypto/key.js";
import { getUniqueRecipientEmails, NewMsgData } from "../compose-types.js";
import { PlainMsgMailFormatter } from './plain-mail-msg-formatter.js';
import { SendableMsg } from '../../../../js/common/api/email-provider/sendable-msg.js';
import { SignedMsgMailFormatter } from './signed-msg-mail-formatter.js';
import { ComposeView } from '../../compose.js';
import { KeyStoreUtil, ParsedKeyInfo } from '../../../../js/common/platform/store/key-store.js';
import { UnreportableError } from '../../../../js/common/platform/catch.js';

export class GeneralMailFormatter {

  // returns undefined in case user cancelled decryption of the signing key
  public static processNewMsg = async (view: ComposeView, newMsgData: NewMsgData): Promise<{ msg: SendableMsg, senderKi: KeyInfoWithIdentity | undefined }> => {
    const choices = view.sendBtnModule.popover.choices;
    const recipientsEmails = getUniqueRecipientEmails(newMsgData.recipients);
    if (!choices.encrypt && !choices.sign) { // plain
      view.S.now('send_btn_text').text('Formatting...');
      return { senderKi: undefined, msg: await new PlainMsgMailFormatter(view).sendableMsg(newMsgData) };
    }
    if (!choices.encrypt && choices.sign) { // sign only
      view.S.now('send_btn_text').text('Signing...');
      const senderKis = await view.storageModule.getAccountKeys(newMsgData.from);
      const signingKey = await GeneralMailFormatter.chooseSigningKeyAndDecryptIt(view, senderKis);
      if (!signingKey) {
        throw new UnreportableError('Could not find account key usable for signing this plain text message');
      }
      return { senderKi: signingKey!.keyInfo, msg: await new SignedMsgMailFormatter(view).sendableMsg(newMsgData, signingKey!.key) };
    }
    // encrypt (optionally sign)
    const singleFamilyKeys = await view.storageModule.collectSingleFamilyKeys(recipientsEmails, newMsgData.from, choices.sign);
    if (singleFamilyKeys.emailsWithoutPubkeys.length) {
      await view.errModule.throwIfEncryptionPasswordInvalid(newMsgData);
    }
    let signingKey: ParsedKeyInfo | undefined;
    console.log(`choices.sign=${choices.sign}`);
    if (choices.sign) {
      console.log('should sign');
      signingKey = await GeneralMailFormatter.chooseSigningKeyAndDecryptIt(view, singleFamilyKeys.senderKis);
      if (!signingKey && singleFamilyKeys.family === 'openpgp') {
        // we are ignoring missing signing keys for x509 family for now. We skip signing when missing
        //   see https://github.com/FlowCrypt/flowcrypt-browser/pull/4372/files#r845012403
        throw new UnreportableError(`Could not find account ${singleFamilyKeys.family} key usable for signing this encrypted message`);
      }
    }
    view.S.now('send_btn_text').text('Encrypting...');
    return { senderKi: signingKey?.keyInfo, msg: await new EncryptedMsgMailFormatter(view).sendableMsg(newMsgData, singleFamilyKeys.pubkeys, signingKey?.key) };
  };

  private static chooseSigningKeyAndDecryptIt = async (
    view: ComposeView,
    senderKis: KeyInfoWithIdentity[]
  ): Promise<ParsedKeyInfo | undefined> => {
    console.log('choosing signing key from', senderKis);
    const parsedSenderPrvs = await KeyStoreUtil.parse(senderKis);
    console.log('choosing from parsed', parsedSenderPrvs);
    // to consider - currently we choose first valid key for signing. Should we sign with all?
    //   alternatively we could use most recenlty modified valid key
    const parsedSenderPrv = parsedSenderPrvs.find(k => k.key.usableForSigning);
    console.log(`parsedSenderPrv`, parsedSenderPrv);
    if (!parsedSenderPrv) {
      return undefined;
    }
    const signingPrv = await view.storageModule.decryptSenderKey(parsedSenderPrv);
    console.log(`signingPrv`, signingPrv);
    if (!signingPrv) {
      return undefined;
    }
    return signingPrv;
  };

}
