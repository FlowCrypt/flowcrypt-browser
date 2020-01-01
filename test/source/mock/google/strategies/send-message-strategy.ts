import { AddressObject, ParsedMail } from 'mailparser';
import { ITestMsgStrategy, UnsuportableStrategyError } from './strategy-base.js';

import { Buf } from '../../../core/buf';
import { Config } from '../../../util';
import { GoogleData } from '../google-data';
import { HttpClientErr } from '../../lib/api';
import { PgpMsg } from '../../../core/pgp-msg';

// TODO: Make a better structure of ITestMsgStrategy. Because this class doesn't test anything, it only saves message in the Mock
class SaveMessageInStorageStrategy implements ITestMsgStrategy {
  test = async (mimeMsg: ParsedMail, base64Msg: string) => {
    console.log('adding to db');
    new GoogleData(mimeMsg.from.value[0].address).storeSentMessage(mimeMsg, base64Msg);
  }
}

class PwdEncryptedMessageTestStrategy implements ITestMsgStrategy {
  test = async (mimeMsg: ParsedMail, base64Msg: string) => {
    if (!mimeMsg.text.match(/https:\/\/flowcrypt.com\/[a-z0-9A-Z]{10}/)) {
      throw new HttpClientErr(`Error: cannot find pwd encrypted link in:\n\n${mimeMsg.text}`);
    }
    if (!mimeMsg.text.includes('Follow this link to open it')) {
      throw new HttpClientErr(`Error: cannot find pwd encrypted open link prompt in ${mimeMsg.text}`);
    }
    new GoogleData(mimeMsg.from.value[0].address).storeSentMessage(mimeMsg, base64Msg);
  }
}

class MessageWithFooterTestStrategy implements ITestMsgStrategy {
  private readonly footer = 'flowcrypt.compatibility test footer with an img';

  test = async (mimeMsg: ParsedMail) => {
    const keyInfo = Config.secrets.keyInfo.find(k => k.email === 'flowcrypt.compatibility@gmail.com')!.key;
    const decrypted = await PgpMsg.decrypt({ kisWithPp: keyInfo!, encryptedData: Buf.fromUtfStr(mimeMsg.text) });
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

  test = async (mimeMsg: ParsedMail) => {
    const keyInfo = Config.secrets.keyInfo.find(k => k.email === 'flowcrypt.compatibility@gmail.com')!.key;
    const decrypted = await PgpMsg.decrypt({ kisWithPp: keyInfo!, encryptedData: Buf.fromUtfStr(mimeMsg.text) });
    if (!decrypted.success) {
      throw new HttpClientErr(`Error: Could not successfully verify signed message`);
    }
    if (!decrypted.signature) {
      throw new HttpClientErr(`Error: The message isn't signed.`);
    }
    if (decrypted.signature.signer !== this.signedBy) {
      throw new HttpClientErr(`Error: expected message signed by ${this.signedBy} but was actually signed by ${decrypted.signature.signer}`);
    }
    const content = decrypted.content.toUtfStr();
    if (!content.includes(this.expectedText)) {
      throw new HttpClientErr(`Error: Contents don't match. Expected: '${this.expectedText}' but got: '${content}'.`);
    }
  }
}

class PlainTextMessageTestStrategy implements ITestMsgStrategy {
  private readonly expectedText = 'New Plain Message';

  test = async (mimeMsg: ParsedMail) => {
    if (!mimeMsg.text.includes(this.expectedText)) {
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

  test = async (mimeMsg: ParsedMail) => {
    const keyInfo = Config.secrets.keyInfo.find(k => k.email === 'flowcrypt.compatibility@gmail.com')!.key;
    const decrypted = await PgpMsg.decrypt({ kisWithPp: keyInfo!, encryptedData: Buf.fromUtfStr(mimeMsg.text) });
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
  test = async (mimeMsg: ParsedMail) => {
    const hasAddr = (ao?: AddressObject) => ao && ao.value && ao.value.length && ao.value[0].address;
    if (!hasAddr(mimeMsg.to)) {
      throw new HttpClientErr(`Error: There is no 'To' header.`, 400);
    }
    if (!hasAddr(mimeMsg.cc)) {
      throw new HttpClientErr(`Error: There is no 'Cc' header.`, 400);
    }
    if (!hasAddr(mimeMsg.bcc)) {
      throw new HttpClientErr(`Error: There is no 'Bcc' header.`, 400);
    }
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
    } else if (subject.includes('PWD encrypted message')) {
      this.strategy = new PwdEncryptedMessageTestStrategy();
    } else if (subject.includes('Test Sending Encrypted Message With Image') ||
      subject.includes('Test Sending Signed Message With Image')) {
      this.strategy = new SaveMessageInStorageStrategy();
    } else {
      throw new UnsuportableStrategyError(`There isn't any strategy for this subject: ${subject}`);
    }
  }

  test = async (mimeMsg: ParsedMail, base64Msg: string) => {
    await this.strategy.test(mimeMsg, base64Msg);
  }
}
