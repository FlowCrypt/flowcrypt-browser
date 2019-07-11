type ThreadIdObject = {
    threadId: string;
};

export class ParseMsgResult {
    threadId?: string;
    mimeMsg: string;
}


const strictParse = (source: string): ParseMsgResult => {
    const lines = source.split('\n');
    const result = new ParseMsgResult();
    if (lines[1] === 'Content-Type: application/json; charset=UTF-8' && lines[3]) {
        const threadIdObject = JSON.parse(lines[3]) as ThreadIdObject;
        result.threadId = threadIdObject.threadId;
    } else {
        throw new Error('ThreadId property doesn\'t exist');
    }
    if (lines[6] === 'Content-Type: message/rfc822' &&
        lines[7] === 'Content-Transfer-Encoding: base64' && lines[9]) {
        const base64Buffer = new Buffer(lines[9], 'base64');
        result.mimeMsg = base64Buffer.toString();
    } else {
        throw new Error('Base64 MIME Msg wasn\'t found');
    }
    return result;
};

export default { strictParse };
