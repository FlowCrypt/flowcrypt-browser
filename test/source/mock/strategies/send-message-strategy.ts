import { UnsuportableStrategyError, ITestMsgStrategy } from './strategy-base.js';
import { ParsedMail, AddressObject } from 'mailparser';
import { HttpClientErr } from '../api.js';
import { PgpMsg } from "../../core/pgp.js";
import { Buf } from '../../core/buf.js';
import { Config } from '../../util/index.js';

class PwdEncryptedMessageTestStrategy implements ITestMsgStrategy {
  async test(mimeMsg: ParsedMail) {
    if (!mimeMsg.text.match(/https:\/\/flowcrypt.com\/[a-z0-9A-Z]{10}/)) {
      throw new HttpClientErr(`Error: cannot find pwd encrypted link`);
    }
    if (!mimeMsg.text.includes('Follow this link to open it')) {
      throw new HttpClientErr(`Error: cannot find pwd encrypted open link prompt in ${mimeMsg.text}`);
    }
  }
}

class MessageWithFooterTestStrategy implements ITestMsgStrategy {
  private readonly footer = 'The best footer ever!';

  async test(mimeMsg: ParsedMail) {
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

  async test(mimeMsg: ParsedMail) {
    const keyInfo = Config.secrets.keyInfo.find(k => k.email === 'flowcrypt.compatibility@gmail.com')!.key;
    const decrypted = await PgpMsg.decrypt({ kisWithPp: keyInfo!, encryptedData: Buf.fromUtfStr(mimeMsg.text) });
    // maybe would be better to move the longid in the secrets file, I didn't move it because it's the only one use
    if (decrypted.success && decrypted.signature && decrypted.signature.signer === 'B6BE3C4293DDCF66') {
      const content = decrypted.content.toUtfStr();
      if (!content.includes(this.expectedText)) {
        throw new HttpClientErr(`Error: Contents don't match. Expected: '${this.expectedText}' but got: '${content}'.`);
      }
    } else {
      throw new HttpClientErr(`Error: The message isn't signed.`);
    }
  }
}

class PlainTextMessageTestStrategy implements ITestMsgStrategy {
  private readonly expectedText = 'New Plain Message';

  async test(mimeMsg: ParsedMail) {
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

  async test(mimeMsg: ParsedMail) {
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
  async test(mimeMsg: ParsedMail) {
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
    } else {
      throw new UnsuportableStrategyError(`There isn't any strategy for this subject: ${subject}`);
    }
  }

  async test(mimeMsg: ParsedMail) {
    await this.strategy.test(mimeMsg);
  }
}
