import { ParsedMail } from 'mailparser';

export interface ITestMsgStrategy {
    test(mimeMsg: ParsedMail, base64Msg: string): Promise<void>;
}

export class UnsuportableStrategyError extends Error { }
