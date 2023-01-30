/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import * as forge from 'node-forge';
import { AddressObject, StructuredHeader } from 'mailparser';
import { ITestMsgStrategy, UnsuportableStrategyError } from './strategy-base.js';
import { Buf } from '../../../core/buf';
import { Config } from '../../../util';
import { expect } from 'chai';
import { GoogleData } from '../google-data';
import { HttpClientErr, Status } from '../../lib/api';
import { MsgUtil } from '../../../core/crypto/pgp/msg-util';
import Parse, { ParseMsgResult } from '../../../util/parse';
import { parsedMailAddressObjectAsArray } from '../google-endpoints.js';
import { Str } from '../../../core/common.js';
import { GMAIL_RECOVERY_EMAIL_SUBJECTS } from '../../../core/const.js';
import { ENVELOPED_DATA_OID, SIGNED_DATA_OID, SmimeKey } from '../../../core/crypto/smime/smime-key.js';
import { testConstants } from '../../../tests/tooling/consts.js';

const checkPwdEncryptedMessage = (message: string | undefined) => {
  if (!message?.match(/https:\/\/flowcrypt.com\/shared-tenant-fes\/message\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/)) {
    throw new HttpClientErr(`Error: cannot find pwd encrypted flowcrypt.com/shared-tenant-fes link in:\n\n${message}`);
  }
};

/* eslint-disable @typescript-eslint/no-non-null-assertion */
// TODO: Make a better structure of ITestMsgStrategy. Because this class doesn't test anything, it only saves message in the Mock
class SaveMessageInStorageStrategy implements ITestMsgStrategy {
  public test = async (parseResult: ParseMsgResult, id: string) => {
    (await GoogleData.withInitializedData(parseResult.mimeMsg.from!.value[0].address!)).storeSentMessage(parseResult, id);
  };
}

class PwdAndPubkeyEncryptedMessagesWithFlowCryptComApiTestStrategy implements ITestMsgStrategy {
  public test = async (parseResult: ParseMsgResult, id: string) => {
    const mimeMsg = parseResult.mimeMsg;
    const senderEmail = Str.parseEmail(mimeMsg.from!.text).email;
    await new SaveMessageInStorageStrategy().test(parseResult, id);
    if (mimeMsg.cc) {
      // this is a message to the pubkey recipient
      expect((mimeMsg.cc as AddressObject).text!).to.include('flowcrypt.compatibility@gmail.com');
      expect(mimeMsg.text!).to.not.include('has sent you a password-encrypted email');
      expect(mimeMsg.text!).to.not.include('Follow this link to open it');
      const kisWithPp = await Config.getKeyInfo(['flowcrypt.compatibility.1pp1', 'flowcrypt.compatibility.2pp1']);
      const encryptedData = Buf.fromUtfStr(mimeMsg.text!);
      const decrypted = await MsgUtil.decryptMessage({ kisWithPp, encryptedData, verificationPubs: [] });
      expect(decrypted.success).to.be.true;
      expect(decrypted.content!.toUtfStr()).to.contain('PWD and pubkey encrypted messages with flowcrypt.com/shared-tenant-fes');
      expect(mimeMsg.bcc).to.be.an.undefined;
      expect(mimeMsg.to).to.be.an.undefined;
      expect((mimeMsg.headers.get('reply-to') as AddressObject).text).to.equal('First Last <flowcrypt.compatibility@gmail.com>, test@email.com');
    } else {
      expect(mimeMsg.text!).to.contain(`${senderEmail} has sent you a password-encrypted email`);
      expect(mimeMsg.text!).to.contain('Follow this link to open it');
      checkPwdEncryptedMessage(mimeMsg.text);
    }
  };
}
class PwdEncryptedMessageWithFlowCryptComApiTestStrategy implements ITestMsgStrategy {
  public test = async (parseResult: ParseMsgResult) => {
    const mimeMsg = parseResult.mimeMsg;
    const senderEmail = Str.parseEmail(mimeMsg.from!.text).email;
    if (!mimeMsg.text?.includes(`${senderEmail} has sent you a password-encrypted email`)) {
      throw new HttpClientErr(`Error checking sent text in:\n\n${mimeMsg.text}`);
    }
    checkPwdEncryptedMessage(mimeMsg.text);
    if (!mimeMsg.text?.includes('Follow this link to open it')) {
      throw new HttpClientErr(`Error: cannot find pwd encrypted open link prompt in ${mimeMsg.text}`);
    }
  };
}

class PwdEncryptedMessageWithFesIdTokenTestStrategy implements ITestMsgStrategy {
  public test = async (parseResult: ParseMsgResult, id: string) => {
    const mimeMsg = parseResult.mimeMsg;
    const expectedSenderEmail = 'user@standardsubdomainfes.localhost:8001';
    expect(mimeMsg.from!.text).to.equal(`First Last <${expectedSenderEmail}>`);
    if (mimeMsg.text?.includes('http://fes.standardsubdomainfes.localhost:8001/message/FES-MOCK-MESSAGE-FOR-TO@EXAMPLE.COM-ID')) {
      expect((mimeMsg.to as AddressObject).text).to.equal('Mr To <to@example.com>');
      expect(mimeMsg.cc).to.be.an.undefined;
      expect(mimeMsg.bcc).to.be.an.undefined;
    } else if (mimeMsg.text?.includes('http://fes.standardsubdomainfes.localhost:8001/message/FES-MOCK-MESSAGE-FOR-BCC@EXAMPLE.COM-ID')) {
      expect((mimeMsg.to as AddressObject).text).to.equal('Mr Bcc <bcc@example.com>');
      expect(mimeMsg.cc).to.be.an.undefined;
      expect(mimeMsg.bcc).to.be.an.undefined;
    } else {
      // no pubkey recipients in this test
      throw new HttpClientErr(`Error: cannot find pwd encrypted FES link in:\n\n${mimeMsg.text}`);
    }
    expect(mimeMsg.text!).to.include(`${expectedSenderEmail} has sent you a password-encrypted email`);
    expect(mimeMsg.text!).to.include('Follow this link to open it');
    await new SaveMessageInStorageStrategy().test(parseResult, id);
  };
}

class PwdEncryptedMessageWithFesPubkeyRecipientInBccTestStrategy implements ITestMsgStrategy {
  public test = async (parseResult: ParseMsgResult, id: string) => {
    const mimeMsg = parseResult.mimeMsg;
    const expectedSenderEmail = 'user3@standardsubdomainfes.localhost:8001';
    expect(mimeMsg.from!.text).to.equal(`First Last <${expectedSenderEmail}>`);
    if (mimeMsg.text?.includes('http://fes.standardsubdomainfes.localhost:8001/message/FES-MOCK-MESSAGE-FOR-TO@EXAMPLE.COM-ID')) {
      expect(mimeMsg.text!).to.include(`${expectedSenderEmail} has sent you a password-encrypted email`);
      expect(mimeMsg.text!).to.include('Follow this link to open it');
      expect((mimeMsg.to as AddressObject).text).to.equal('to@example.com');
      expect(mimeMsg.cc).to.be.an.undefined;
      expect(mimeMsg.bcc).to.be.an.undefined;
      expect(mimeMsg.headers.get('reply-to')).to.be.an.undefined;
    } else {
      // this is a message to pubkey recipients
      expect(mimeMsg.text!).to.not.include('has sent you a password-encrypted email');
      expect(mimeMsg.text!).to.not.include('Follow this link to open it');
      const kisWithPp = await Config.getKeyInfo(['flowcrypt.test.key.used.pgp']);
      const encryptedData = Buf.fromUtfStr(mimeMsg.text!);
      const decrypted = await MsgUtil.decryptMessage({ kisWithPp, encryptedData, verificationPubs: [] });
      expect(decrypted.success).to.be.true;
      expect(decrypted.content!.toUtfStr()).to.equal('PWD encrypted message with FES - pubkey recipient in bcc');
      expect((mimeMsg.bcc as AddressObject).text).to.equal('flowcrypt.compatibility@gmail.com');
      expect(mimeMsg.cc).to.be.an.undefined;
      expect(mimeMsg.to).to.be.an.undefined;
      expect((mimeMsg.headers.get('reply-to') as AddressObject).text).to.equal('First Last <user3@standardsubdomainfes.localhost:8001>, to@example.com');
    }
    await new SaveMessageInStorageStrategy().test(parseResult, id);
  };
}

class PwdEncryptedMessageWithFesReplyBadRequestTestStrategy implements ITestMsgStrategy {
  public test = async (parseResult: ParseMsgResult, id: string) => {
    const mimeMsg = parseResult.mimeMsg;
    const expectedSenderEmail = 'user4@standardsubdomainfes.localhost:8001';
    expect(mimeMsg.from!.text).to.equal(`First Last <${expectedSenderEmail}>`);
    const to = parsedMailAddressObjectAsArray(mimeMsg.to)
      .concat(parsedMailAddressObjectAsArray(mimeMsg.cc))
      .concat(parsedMailAddressObjectAsArray(mimeMsg.bcc));
    expect(to.length).to.equal(1);
    const recipientEmail = to[0].text;
    if (recipientEmail === 'to@example.com') {
      // success
      await new SaveMessageInStorageStrategy().test(parseResult, id);
      return;
    } else if (recipientEmail === 'invalid@example.com') {
      throw new HttpClientErr('Invalid to header', Status.BAD_REQUEST);
    } else if (recipientEmail === 'timeout@example.com') {
      throw new HttpClientErr('RequestTimeout', Status.BAD_REQUEST);
    } else {
      throw new HttpClientErr(`Vague failure for ${recipientEmail}`, Status.BAD_REQUEST);
    }
  };
}

class PwdEncryptedMessageWithFesReplyRenderingTestStrategy implements ITestMsgStrategy {
  public test = async (parseResult: ParseMsgResult, id: string) => {
    const mimeMsg = parseResult.mimeMsg;
    const expectedSenderEmail = 'user2@standardsubdomainfes.localhost:8001';
    expect(mimeMsg.from!.text).to.equal(`First Last <${expectedSenderEmail}>`);
    if (mimeMsg.text?.includes('http://fes.standardsubdomainfes.localhost:8001/message/FES-MOCK-MESSAGE-FOR-SENDER@DOMAIN.COM-ID')) {
      expect(mimeMsg.text!).to.include(`${expectedSenderEmail} has sent you a password-encrypted email`);
      expect(mimeMsg.text!).to.include('Follow this link to open it');
      expect((mimeMsg.to as AddressObject).text).to.equal('sender@domain.com');
      expect(mimeMsg.cc).to.be.an.undefined;
      expect(mimeMsg.bcc).to.be.an.undefined;
      expect(mimeMsg.headers.get('reply-to')).to.be.an.undefined;
    } else if (mimeMsg.text?.includes('http://fes.standardsubdomainfes.localhost:8001/message/FES-MOCK-MESSAGE-FOR-TO@EXAMPLE.COM-ID')) {
      expect(mimeMsg.text!).to.include(`${expectedSenderEmail} has sent you a password-encrypted email`);
      expect(mimeMsg.text!).to.include('Follow this link to open it');
      expect((mimeMsg.to as AddressObject).text).to.equal('to@example.com');
      expect(mimeMsg.cc).to.be.an.undefined;
      expect(mimeMsg.bcc).to.be.an.undefined;
      expect(mimeMsg.headers.get('reply-to')).to.be.an.undefined;
    } else {
      // this is a message to pubkey recipients
      expect(mimeMsg.text!).to.not.include('has sent you a password-encrypted email');
      expect(mimeMsg.text!).to.not.include('Follow this link to open it');
      const kisWithPp = await Config.getKeyInfo(['flowcrypt.test.key.used.pgp']);
      const encryptedData = Buf.fromUtfStr(mimeMsg.text!);
      const decrypted = await MsgUtil.decryptMessage({ kisWithPp, encryptedData, verificationPubs: [] });
      expect(decrypted.success).to.be.true;
      expect(decrypted.content!.toUtfStr()).to.include('> some dummy text');
      expect((mimeMsg.to as AddressObject).text).to.equal('flowcrypt.compatibility@gmail.com, mock.only.pubkey@flowcrypt.com');
      expect(mimeMsg.cc).to.be.an.undefined;
      expect(mimeMsg.bcc).to.be.an.undefined;
      expect((mimeMsg.headers.get('reply-to') as AddressObject).text).to.equal(
        'First Last <user2@standardsubdomainfes.localhost:8001>, sender@domain.com, to@example.com'
      );
    }
    await new SaveMessageInStorageStrategy().test(parseResult, id);
  };
}
/* eslint-enable @typescript-eslint/no-non-null-assertion */

class MessageWithFooterTestStrategy implements ITestMsgStrategy {
  private readonly footer = 'flowcrypt.compatibility test footer with an img';

  public test = async (parseResult: ParseMsgResult) => {
    const mimeMsg = parseResult.mimeMsg;
    const keyInfo = await Config.getKeyInfo(['flowcrypt.compatibility.1pp1', 'flowcrypt.compatibility.2pp1']);
    const decrypted = await MsgUtil.decryptMessage({
      kisWithPp: keyInfo!, // eslint-disable-line @typescript-eslint/no-non-null-assertion
      encryptedData: Buf.fromUtfStr(mimeMsg.text || ''),
      verificationPubs: [],
    });
    if (!decrypted.success) {
      throw new HttpClientErr(`Error: can't decrypt message`);
    }
    const textContent = decrypted.content.toUtfStr();
    if (!textContent.includes(this.footer)) {
      throw new HttpClientErr(`Error: Msg Text doesn't contain footer. Current: '${mimeMsg.text}', expected footer: '${this.footer}'`);
    }
  };
}

class SignedMessageTestStrategy implements ITestMsgStrategy {
  private readonly expectedText = 'New Signed Message (Mock Test)';
  private readonly signedBy = 'B6BE3C4293DDCF66'; // could potentially grab this from test-secrets.json file

  public test = async (parseResult: ParseMsgResult) => {
    const mimeMsg = parseResult.mimeMsg;
    const keyInfo = await Config.getKeyInfo(['flowcrypt.compatibility.1pp1', 'flowcrypt.compatibility.2pp1']);
    const decrypted = await MsgUtil.decryptMessage({
      kisWithPp: keyInfo!, // eslint-disable-line @typescript-eslint/no-non-null-assertion
      encryptedData: Buf.fromUtfStr(mimeMsg.text!), // eslint-disable-line @typescript-eslint/no-non-null-assertion
      verificationPubs: [],
    });
    if (!decrypted.success) {
      throw new HttpClientErr(`Error: Could not successfully verify signed message`);
    }
    if (!decrypted.signature) {
      throw new HttpClientErr(`Error: The message isn't signed.`);
    }
    if (!decrypted.signature.signerLongids.includes(this.signedBy)) {
      throw new HttpClientErr(
        `Error: expected message signed by ${this.signedBy} but was actually signed by ${decrypted.signature.signerLongids.length} other signers`
      );
    }
    const content = decrypted.content.toUtfStr();
    if (!content.includes(this.expectedText)) {
      throw new HttpClientErr(`Error: Contents don't match. Expected: '${this.expectedText}' but got: '${content}'.`);
    }
  };
}

class PlainTextMessageTestStrategy implements ITestMsgStrategy {
  private readonly expectedText = 'New Plain Message';

  public test = async (parseResult: ParseMsgResult) => {
    const mimeMsg = parseResult.mimeMsg;
    if (!mimeMsg.text?.includes(this.expectedText)) {
      throw new HttpClientErr(`Error: Msg Text is not matching expected. Current: '${mimeMsg.text}', expected: '${this.expectedText}'`);
    }
  };
}

class NoopTestStrategy implements ITestMsgStrategy {
  public test = async () => {}; // eslint-disable-line @typescript-eslint/no-empty-function, no-empty-function
}

class IncludeQuotedPartTestStrategy implements ITestMsgStrategy {
  private readonly quotedContent: string = [
    'On 2019-06-14 at 23:24, flowcrypt.compatibility@gmail.com wrote:',
    '> This is some message',
    '>',
    '> and below is the quote',
    '>',
    '> > this is the quote',
    '> > still the quote',
    '> > third line',
    '> >> double quote',
    '> >> again double quote',
  ].join('\n');

  public test = async (parseResult: ParseMsgResult) => {
    const keyInfo = await Config.getKeyInfo(['flowcrypt.compatibility.1pp1', 'flowcrypt.compatibility.2pp1']);
    /* eslint-disable @typescript-eslint/no-non-null-assertion */
    const decrypted = await MsgUtil.decryptMessage({
      kisWithPp: keyInfo!,
      encryptedData: Buf.fromUtfStr(parseResult.mimeMsg.text!),
      verificationPubs: [],
    });
    /* eslint-enable @typescript-eslint/no-non-null-assertion */
    if (!decrypted.success) {
      throw new HttpClientErr(`Error: can't decrypt message`);
    }
    const textContent = decrypted.content.toUtfStr();
    if (!textContent.endsWith(this.quotedContent)) {
      throw new HttpClientErr(`Error: Quoted content isn't included to the Msg. Msg text: '${textContent}'\n Quoted part: '${this.quotedContent}'`, 400);
    }
  };
}

class NewMessageCCAndBCCTestStrategy implements ITestMsgStrategy {
  public test = async (parseResult: ParseMsgResult) => {
    const mimeMsg = parseResult.mimeMsg;
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
  };
}

class SmimeEncryptedMessageStrategy implements ITestMsgStrategy {
  public test = async (parseResult: ParseMsgResult) => {
    const mimeMsg = parseResult.mimeMsg;
    expect((mimeMsg.headers.get('content-type') as StructuredHeader).value).to.equal('application/pkcs7-mime');
    expect((mimeMsg.headers.get('content-type') as StructuredHeader).params.name).to.equal('smime.p7m');
    expect((mimeMsg.headers.get('content-type') as StructuredHeader).params['smime-type']).to.equal('enveloped-data');
    expect(mimeMsg.headers.get('content-transfer-encoding')).to.equal('base64');
    expect((mimeMsg.headers.get('content-disposition') as StructuredHeader).value).to.equal('attachment');
    expect((mimeMsg.headers.get('content-disposition') as StructuredHeader).params.filename).to.equal('smime.p7m');
    expect(mimeMsg.headers.get('content-description')).to.equal('S/MIME Encrypted Message');
    /* eslint-disable @typescript-eslint/no-non-null-assertion */
    expect(mimeMsg.attachments!.length).to.equal(1);
    expect(mimeMsg.attachments![0].contentType).to.equal('application/pkcs7-mime');
    expect(mimeMsg.attachments![0].filename).to.equal('smime.p7m');
    const withAttachments = mimeMsg.subject?.includes(' with attachment');
    expect(mimeMsg.attachments![0].size).to.be.greaterThan(withAttachments ? 20000 : 300);
    const msg = new Buf(mimeMsg.attachments![0].content).toRawBytesStr();
    /* eslint-enable @typescript-eslint/no-non-null-assertion */
    const p7 = forge.pkcs7.messageFromAsn1(forge.asn1.fromDer(msg));
    expect(p7.type).to.equal(ENVELOPED_DATA_OID);
    if (p7.type === ENVELOPED_DATA_OID) {
      const key = SmimeKey.parse(testConstants.testKeyMultipleSmimeCEA2D53BB9D24871);
      const decrypted = SmimeKey.decryptMessage(p7, key);
      const decryptedMessage = Buf.with(decrypted).toRawBytesStr();
      if (mimeMsg.subject?.includes(' signed ')) {
        expect(decryptedMessage).to.contain('smime-type=signed-data');
        // todo: parse PKCS#7, check that is of SIGNED_DATA_OID content type, extract content?
        // todo: #4046
      } else {
        expect(decryptedMessage).to.contain('This text should be encrypted into PKCS#7 data');
        if (withAttachments) {
          const nestedMimeMsg = await Parse.parseMixed(decryptedMessage);
          /* eslint-disable @typescript-eslint/no-non-null-assertion */
          expect(nestedMimeMsg.attachments!.length).to.equal(3);
          expect(nestedMimeMsg.attachments![0].content.toString()).to.equal(`small text file\nnot much here\nthis worked\n`);
          /* eslint-enable @typescript-eslint/no-non-null-assertion */
        }
      }
    }
  };
}

class SmimeSignedMessageStrategy implements ITestMsgStrategy {
  public test = async (parseResult: ParseMsgResult) => {
    const mimeMsg = parseResult.mimeMsg;
    expect((mimeMsg.headers.get('content-type') as StructuredHeader).value).to.equal('application/pkcs7-mime');
    expect((mimeMsg.headers.get('content-type') as StructuredHeader).params.name).to.equal('smime.p7m');
    expect((mimeMsg.headers.get('content-type') as StructuredHeader).params['smime-type']).to.equal('signed-data');
    expect(mimeMsg.headers.get('content-transfer-encoding')).to.equal('base64');
    expect((mimeMsg.headers.get('content-disposition') as StructuredHeader).value).to.equal('attachment');
    expect((mimeMsg.headers.get('content-disposition') as StructuredHeader).params.filename).to.equal('smime.p7m');
    expect(mimeMsg.headers.get('content-description')).to.equal('S/MIME Signed Message');
    /* eslint-disable @typescript-eslint/no-non-null-assertion */
    expect(mimeMsg.attachments!.length).to.equal(1);
    expect(mimeMsg.attachments![0].contentType).to.equal('application/pkcs7-mime');
    expect(mimeMsg.attachments![0].filename).to.equal('smime.p7m');
    expect(mimeMsg.attachments![0].size).to.be.greaterThan(300);
    const msg = new Buf(mimeMsg.attachments![0].content).toRawBytesStr();
    /* eslint-enable @typescript-eslint/no-non-null-assertion */
    const p7 = forge.pkcs7.messageFromAsn1(forge.asn1.fromDer(msg));
    expect(p7.type).to.equal(SIGNED_DATA_OID);
  };
}
export class TestBySubjectStrategyContext {
  private strategy: ITestMsgStrategy;

  public constructor(subject: string) {
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
    } else if (subject.includes('PWD encrypted message with flowcrypt.com/shared-tenant-fes')) {
      this.strategy = new PwdEncryptedMessageWithFlowCryptComApiTestStrategy();
    } else if (subject.includes('PWD and pubkey encrypted messages with flowcrypt.com/shared-tenant-fes')) {
      this.strategy = new PwdAndPubkeyEncryptedMessagesWithFlowCryptComApiTestStrategy();
    } else if (subject.includes('PWD encrypted message with FES - ID TOKEN')) {
      this.strategy = new PwdEncryptedMessageWithFesIdTokenTestStrategy();
    } else if (subject.includes('PWD encrypted message with FES - Reply rendering')) {
      this.strategy = new PwdEncryptedMessageWithFesReplyRenderingTestStrategy();
    } else if (subject.includes('PWD encrypted message with FES - pubkey recipient in bcc')) {
      this.strategy = new PwdEncryptedMessageWithFesPubkeyRecipientInBccTestStrategy();
    } else if (subject.includes('PWD encrypted message with FES web portal - some sends fail with BadRequest error')) {
      this.strategy = new PwdEncryptedMessageWithFesReplyBadRequestTestStrategy();
    } else if (subject.includes('PWD encrypted message with FES web portal - a send fails with gateway update error')) {
      this.strategy = new SaveMessageInStorageStrategy();
    } else if (subject.includes('Message With Image')) {
      this.strategy = new SaveMessageInStorageStrategy();
    } else if (subject.includes('Message With Test Text')) {
      this.strategy = new SaveMessageInStorageStrategy();
    } else if (subject.includes('PWD encrypted message after reconnect account')) {
      this.strategy = new SaveMessageInStorageStrategy();
    } else if (subject.includes('send with single S/MIME cert')) {
      this.strategy = new SmimeEncryptedMessageStrategy();
    } else if (subject.includes('send with several S/MIME certs')) {
      this.strategy = new SmimeEncryptedMessageStrategy();
    } else if (subject.includes('S/MIME message')) {
      this.strategy = new SmimeEncryptedMessageStrategy();
    } else if (subject.includes('send signed S/MIME without attachment')) {
      this.strategy = new SmimeSignedMessageStrategy();
    } else if (GMAIL_RECOVERY_EMAIL_SUBJECTS.includes(subject)) {
      this.strategy = new SaveMessageInStorageStrategy();
    } else if (subject.includes('Re: FROM: flowcrypt.compatibility@gmail.com, TO: flowcrypt.compatibility@gmail.com + vladimir@flowcrypt.com')) {
      this.strategy = new NoopTestStrategy();
    } else {
      throw new UnsuportableStrategyError(`There isn't any strategy for this subject: ${subject}`);
    }
  }

  public test = async (parseResult: ParseMsgResult, id: string) => {
    await this.strategy.test(parseResult, id);
  };
}
