import { UnsuportableStrategyError, ITestMsgStrategy } from './strategy-base.js';
import { ParsedMail } from 'mailparser';
import { HttpClientErr } from '../api.js';
import { Pgp, PgpMsg } from "../../core/pgp.js";
import { Buf } from '../../core/buf.js';
import { Data } from '../data.js';

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
        const keyInfo = new Data('flowcrypt.compatibility@gmail.com').getKeyInfo();
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

export class TestBySubjectStrategyContext {
    private strategy: ITestMsgStrategy;

    constructor(subject: string) {
        if (subject.includes('testing quotes')) {
            this.strategy = new IncludeQuotedPartTestStrategy();
        } else {
            throw new UnsuportableStrategyError(`There isn't any strategy for this subject: ${subject}`);
        }
    }

    async test(mimeMsg: ParsedMail) {
        await this.strategy.test(mimeMsg);
    }
}
