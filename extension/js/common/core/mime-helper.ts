/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

export class MimeHelper {
  public static contentTransferEncoding7bitOrFallbackToQuotedPrintable = (content: string | Uint8Array) => {
    for (let i = 0; i < content.length; i++) {
      const code = typeof content === 'string' ? content.charCodeAt(i) : content[i] ?? 0;
      if (!(code >= 0 && code <= 127)) {
        return 'quoted-printable';
      }
    }
    return '7bit';
  };
}
