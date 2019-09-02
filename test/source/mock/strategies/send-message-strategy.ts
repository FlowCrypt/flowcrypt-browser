import { UnsuportableStrategyError, ITestMsgStrategy } from './strategy-base.js';
import { ParsedMail, AddressObject } from 'mailparser';
import { HttpClientErr } from '../api.js';
import { PgpMsg } from "../../core/pgp.js";
import { Buf } from '../../core/buf.js';
import { Config } from '../../util/index.js';

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
    } else {
      throw new UnsuportableStrategyError(`There isn't any strategy for this subject: ${subject}`);
    }
  }

  async test(mimeMsg: ParsedMail) {
    await this.strategy.test(mimeMsg);
  }
}
