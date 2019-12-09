import { ParsedMail } from 'mailparser';

export interface ITestMsgStrategy {
    test(mimeMsg: ParsedMail): Promise<void>;
}

export class UnsuportableStrategyError extends Error { }
