/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { ParsedMail, simpleParser } from "mailparser";
import { Buf } from '../core/buf';

type ThreadIdObject = {
  threadId: string;
};

export class ParseMsgResult {
  public threadId?: string;
  public mimeMsg: ParsedMail;
  public base64: string;
}

const strictParse = async (source: string): Promise<ParseMsgResult> => {
  const lines = source.split('\n');
  const result = new ParseMsgResult();
  if (lines[1] === 'Content-Type: application/json; charset=UTF-8' && lines[3]) {
    const threadIdObject = JSON.parse(lines[3]) as ThreadIdObject;
    result.threadId = threadIdObject.threadId;
  } else {
    throw new Error('ThreadId property doesn\'t exist');
  }
  if (lines[6] === 'Content-Type: message/rfc822' && lines[7] === 'Content-Transfer-Encoding: base64' && lines[9]) {
    result.base64 = lines[9];
    result.mimeMsg = await convertBase64ToMimeMsg(lines[9]);
  } else {
    throw new Error('Base64 MIME Msg wasn\'t found');
  }
  return result;
};

const convertBase64ToMimeMsg = async (base64: string) => {
  return await simpleParser(new Buffer(Buf.fromBase64Str(base64)), {
    keepCidLinks: true // #3256
  });
};

export default { strictParse, convertBase64ToMimeMsg };
