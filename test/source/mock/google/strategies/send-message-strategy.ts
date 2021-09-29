/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { AddressObject, ParsedMail, StructuredHeader } from 'mailparser';
import { ITestMsgStrategy, UnsuportableStrategyError } from './strategy-base.js';
import { Buf } from '../../../core/buf';
import { Config } from '../../../util';
import { expect } from 'chai';
import { GoogleData } from '../google-data';
import { HttpClientErr } from '../../lib/api';
import { MsgUtil } from '../../../core/crypto/pgp/msg-util';
import { parsedMailAddressObjectAsArray } from '../google-endpoints.js';
import { Str } from '../../../core/common.js';

// TODO: Make a better structure of ITestMsgStrategy. Because this class doesn't test anything, it only saves message in the Mock
class SaveMessageInStorageStrategy implements ITestMsgStrategy {
  public test = async (mimeMsg: ParsedMail, base64Msg: string) => {
    (await GoogleData.withInitializedData(mimeMsg.from!.value[0].address!)).storeSentMessage(mimeMsg, base64Msg);
  }
}

class PwdEncryptedMessageWithFlowCryptComApiTestStrategy implements ITestMsgStrategy {
  public test = async (mimeMsg: ParsedMail) => {
    const senderEmail = Str.parseEmail(mimeMsg.from!.text).email;
    if (!mimeMsg.text?.includes(`${senderEmail} has sent you a password-encrypted email`)) {
      throw new HttpClientErr(`Error checking sent text in:\n\n${mimeMsg.text}`);
    }
    if (!mimeMsg.text?.match(/https:\/\/flowcrypt.com\/[a-z0-9A-Z]{10}/)) {
      throw new HttpClientErr(`Error: cannot find pwd encrypted flowcrypt.com/api link in:\n\n${mimeMsg.text}`);
    }
    if (!mimeMsg.text?.includes('Follow this link to open it')) {
      throw new HttpClientErr(`Error: cannot find pwd encrypted open link prompt in ${mimeMsg.text}`);
    }
  }
}

class PwdEncryptedMessageWithFesAccessTokenTestStrategy implements ITestMsgStrategy {
  public test = async (mimeMsg: ParsedMail) => {
    const senderEmail = Str.parseEmail(mimeMsg.from!.text).email;
    const expectedSenderEmail = 'user@standardsubdomainfes.test:8001';
    if (senderEmail !== expectedSenderEmail) {
      throw new HttpClientErr(`Unexpected sender email ${senderEmail}, expecting ${expectedSenderEmail}`);
    }
    if (!mimeMsg.text?.includes(`${senderEmail} has sent you a password-encrypted email`)) {
      throw new HttpClientErr(`Error checking sent text in:\n\n${mimeMsg.text}`);
    }
    if (!mimeMsg.text?.includes('http://fes.standardsubdomainfes.test:8001/message/FES-MOCK-MESSAGE-ID')) {
      throw new HttpClientErr(`Error: cannot find pwd encrypted FES link in:\n\n${mimeMsg.text}`);
    }
    if (!mimeMsg.text?.includes('Follow this link to open it')) {
      throw new HttpClientErr(`Error: cannot find pwd encrypted open link prompt in ${mimeMsg.text}`);
    }
  }
}

class PwdEncryptedMessageWithFesIdTokenTestStrategy implements ITestMsgStrategy {
  public test = async (mimeMsg: ParsedMail) => {
    const senderEmail = Str.parseEmail(mimeMsg.from!.text).email;
    const expectedSenderEmail = 'user@disablefesaccesstoken.test:8001';
    if (senderEmail !== expectedSenderEmail) {
      throw new HttpClientErr(`Unexpected sender email ${senderEmail}, expecting ${expectedSenderEmail}`);
    }
    if (!mimeMsg.text?.includes(`${senderEmail} has sent you a password-encrypted email`)) {
      throw new HttpClientErr(`Error checking sent text in:\n\n${mimeMsg.text}`);
    }
    if (!mimeMsg.text?.includes('http://fes.disablefesaccesstoken.test:8001/message/FES-MOCK-MESSAGE-ID')) {
      throw new HttpClientErr(`Error: cannot find pwd encrypted FES link in:\n\n${mimeMsg.text}`);
    }
    if (!mimeMsg.text?.includes('Follow this link to open it')) {
      throw new HttpClientErr(`Error: cannot find pwd encrypted open link prompt in ${mimeMsg.text}`);
    }
  }
}

class MessageWithFooterTestStrategy implements ITestMsgStrategy {
  private readonly footer = 'flowcrypt.compatibility test footer with an img';

  public test = async (mimeMsg: ParsedMail) => {
    const keyInfo = await Config.getKeyInfo(["flowcrypt.compatibility.1pp1", "flowcrypt.compatibility.2pp1"]);
    const decrypted = await MsgUtil.decryptMessage({ kisWithPp: keyInfo!, encryptedData: Buf.fromUtfStr(mimeMsg.text || '') });
    if (!decrypted.success) {
      throw new HttpClientErr(`Error: can't decrypt message`);
    }
    const textContent = decrypted.content.toUtfStr();
    if (!textContent.includes(this.footer)) {
      throw new HttpClientErr(`Error: Msg Text doesn't contain footer. Current: '${mimeMsg.text}', expected footer: '${this.footer}'`);
    }
  }
}

class SignedMessageTestStrategy implements ITestMsgStrategy {
  private readonly expectedText = 'New Signed Message (Mock Test)';
  private readonly signedBy = 'B6BE3C4293DDCF66'; // could potentially grab this from test-secrets.json file

  public test = async (mimeMsg: ParsedMail) => {
    const keyInfo = await Config.getKeyInfo(["flowcrypt.compatibility.1pp1", "flowcrypt.compatibility.2pp1"]);
    const decrypted = await MsgUtil.decryptMessage({ kisWithPp: keyInfo!, encryptedData: Buf.fromUtfStr(mimeMsg.text!) });
    if (!decrypted.success) {
      throw new HttpClientErr(`Error: Could not successfully verify signed message`);
    }
    if (!decrypted.signature) {
      throw new HttpClientErr(`Error: The message isn't signed.`);
    }
    if (decrypted.signature.signer?.longid !== this.signedBy) {
      throw new HttpClientErr(`Error: expected message signed by ${this.signedBy} but was actually signed by ${decrypted.signature.signer?.longid}`);
    }
    const content = decrypted.content.toUtfStr();
    if (!content.includes(this.expectedText)) {
      throw new HttpClientErr(`Error: Contents don't match. Expected: '${this.expectedText}' but got: '${content}'.`);
    }
  }
}

class PlainTextMessageTestStrategy implements ITestMsgStrategy {
  private readonly expectedText = 'New Plain Message';

  public test = async (mimeMsg: ParsedMail) => {
    if (!mimeMsg.text?.includes(this.expectedText)) {
      throw new HttpClientErr(`Error: Msg Text is not matching expected. Current: '${mimeMsg.text}', expected: '${this.expectedText}'`);
    }
  }
}

class IncludeQuotedPartTestStrategy implements ITestMsgStrategy {
  private readonly quotedContent: string = [
    'On 2019-06-14 at 23:24, flowcrypt.compatibility@gmail.com wrote:',
    '> This is some message',
    '> ',
    '> and below is the quote',
    '> ',
    '> > this is the quote',
    '> > still the quote',
    '> > third line',
    '> >> double quote',
    '> >> again double quote'
  ].join('\n');

  public test = async (mimeMsg: ParsedMail) => {
    const keyInfo = await Config.getKeyInfo(["flowcrypt.compatibility.1pp1", "flowcrypt.compatibility.2pp1"]);
    const decrypted = await MsgUtil.decryptMessage({ kisWithPp: keyInfo!, encryptedData: Buf.fromUtfStr(mimeMsg.text!) });
    if (!decrypted.success) {
      throw new HttpClientErr(`Error: can't decrypt message`);
    }
    const textContent = decrypted.content.toUtfStr();
    if (!textContent.endsWith(this.quotedContent)) {
      throw new HttpClientErr(`Error: Quoted content isn't included to the Msg. Msg text: '${textContent}'\n Quoted part: '${this.quotedContent}'`, 400);
    }
  }
}

class NewMessageCCAndBCCTestStrategy implements ITestMsgStrategy {
  public test = async (mimeMsg: ParsedMail) => {
    const hasAtLeastOneRecipient = (ao: AddressObject[]) => ao && ao.length && ao[0].value && ao[0].value.length && ao[0].value[0].address;
    if (!hasAtLeastOneRecipient(parsedMailAddressObjectAsArray(mimeMsg.to))) {
      throw new HttpClientErr(`Error: There is no 'To' header.`, 400);
    }
    if (!hasAtLeastOneRecipient(parsedMailAddressObjectAsArray(mimeMsg.cc))) {
      throw new HttpClientErr(`Error: There is no 'Cc' header.`, 400);
    }
    if (!hasAtLeastOneRecipient(parsedMailAddressObjectAsArray(mimeMsg.bcc))) {
      throw new HttpClientErr(`Error: There is no 'Bcc' header.`, 400);
    }
  }
}

class SmimeEncryptedMessageStrategy implements ITestMsgStrategy {
  public test = async (mimeMsg: ParsedMail) => {
    expect((mimeMsg.headers.get('content-type') as StructuredHeader).value).to.equal('application/pkcs7-mime');
    expect((mimeMsg.headers.get('content-type') as StructuredHeader).params.name).to.equal('smime.p7m');
    expect((mimeMsg.headers.get('content-type') as StructuredHeader).params['smime-type']).to.equal('enveloped-data');
    expect(mimeMsg.headers.get('content-transfer-encoding')).to.equal('base64');
    expect((mimeMsg.headers.get('content-disposition') as StructuredHeader).value).to.equal('attachment');
    expect((mimeMsg.headers.get('content-disposition') as StructuredHeader).params.filename).to.equal('smime.p7m');
    expect(mimeMsg.headers.get('content-description')).to.equal('S/MIME Encrypted Message');
    expect(mimeMsg.attachments!.length).to.equal(1);
    expect(mimeMsg.attachments![0].contentType).to.equal('application/pkcs7-mime');
    expect(mimeMsg.attachments![0].filename).to.equal('smime.p7m');
    expect(mimeMsg.attachments![0].size).to.be.greaterThan(300);
  }
}

export class TestBySubjectStrategyContext {
  private strategy: ITestMsgStrategy;

  constructor(subject: string) {
    if (subject.includes('testing quotes')) {
      this.strategy = new IncludeQuotedPartTestStrategy();
    } else if (subject.includes('Testing CC And BCC')) {
      this.strategy = new NewMessageCCAndBCCTestStrategy();
    } else if (subject.includes('New Plain Message')) {
      this.strategy = new PlainTextMessageTestStrategy();
    } else if (subject.includes('New Signed Message (Mock Test)')) {
      this.strategy = new SignedMessageTestStrategy();
    } else if (subject.includes('Test Footer (Mock Test)')) {
      this.strategy = new MessageWithFooterTestStrategy();
    } else if (subject.includes('PWD encrypted message with flowcrypt.com/api')) {
      this.strategy = new PwdEncryptedMessageWithFlowCryptComApiTestStrategy();
    } else if (subject.includes('PWD encrypted message with FES - access token')) {
      this.strategy = new PwdEncryptedMessageWithFesAccessTokenTestStrategy();
    } else if (subject.includes('PWD encrypted message with FES - ID TOKEN')) {
      this.strategy = new PwdEncryptedMessageWithFesIdTokenTestStrategy();
    } else if (subject.includes('Message With Image')) {
      this.strategy = new SaveMessageInStorageStrategy();
    } else if (subject.includes('Message With Test Text')) {
      this.strategy = new SaveMessageInStorageStrategy();
    } else if (subject.includes('send with single S/MIME cert')) {
      this.strategy = new SmimeEncryptedMessageStrategy();
    } else if (subject.includes('send with several S/MIME certs')) {
      this.strategy = new SmimeEncryptedMessageStrategy();
    } else if (subject.includes('send with S/MIME attachment')) {
      this.strategy = new SmimeEncryptedMessageStrategy();
    } else {
      throw new UnsuportableStrategyError(`There isn't any strategy for this subject: ${subject}`);
    }
  }

  public test = async (mimeMsg: ParsedMail, base64Msg: string) => {
    await this.strategy.test(mimeMsg, base64Msg);
  }
}
