/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

export class Stream {
  public static readToEnd = async (data: ReadableStream<Uint8Array>) => {
    let buffer = new Uint8Array();
    const ws = new WritableStream<Uint8Array>({ write: chunk => { buffer = new Uint8Array([...buffer, ...chunk]); } });
    await data.pipeTo(ws);
    return buffer;
  };
}