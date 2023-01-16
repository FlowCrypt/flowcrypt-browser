/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import type * as OpenPGP from 'openpgp';

export class Stream {
  public static readUint8ArrayToEnd = async (input: OpenPGP.MaybeStream<Uint8Array>): Promise<Uint8Array> => {
    let buffer = new Uint8Array();
    if ('pipeTo' in input) {
      // OpenPGP.WebStream
      const ws = new WritableStream<Uint8Array>({
        write: chunk => {
          buffer = new Uint8Array([...buffer, ...chunk]);
        },
      });
      await input.pipeTo(ws);
    } else if (input instanceof Uint8Array) {
      return input;
    } else {
      for await (const chunk of input) {
        buffer = new Uint8Array([...buffer, ...chunk]);
      }
    }
    return buffer;
  };
  public static readStringToEnd = async (input: OpenPGP.MaybeStream<string>): Promise<string> => {
    const buffer: string[] = [];
    if (!input || typeof input === 'string') {
      return input;
    } else if (input && 'pipeTo' in input) {
      const ws = new WritableStream<string>({
        write: chunk => {
          buffer.push(chunk);
        },
      });
      await input.pipeTo(ws);
    } else {
      for await (const chunk of input) {
        buffer.push(chunk);
      }
    }
    return buffer.join('');
  };
}
