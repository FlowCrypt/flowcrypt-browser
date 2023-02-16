/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { ParseMsgResult } from '../../../util/parse';

export interface ITestMsgStrategy {
  test(parseResult: ParseMsgResult, id: string, port: string): Promise<void>;
}

export class UnsupportableStrategyError extends Error {}
