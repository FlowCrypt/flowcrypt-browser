/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch } from '../../js/common/platform/catch.js';

import * as forge from 'node-forge';

import { BrowserWindow } from '../../js/common/browser/browser-window';

const HEADERS = `MIME-Version: 1.0
Content-Type: application/pkcs7-mime; name="smime.p7m"; smime-type=enveloped-data
Content-Transfer-Encoding: base64
Content-Disposition: attachment; filename="smime.p7m"
Content-Description: S/MIME Encrypted Message`;

Catch.try(async () => {
  const mimeCodec: {
    foldLines(text: string, maxLength: number, afterSpace: boolean): string;
  } = (window as unknown as BrowserWindow)['emailjs-mime-codec']; // tslint:disable-line:no-unsafe-any
  const wrap = (text: string) => mimeCodec.foldLines(text, 76, true);

  const encrypt = () => {
    const p7 = forge.pkcs7.createEnvelopedData();
    const cert = forge.pki.certificateFromPem(String($('#cert').val()));
    p7.addRecipient(cert);

    const headers = $('#headers').val();

    p7.content = forge.util.createBuffer(headers + '\r\n\r\n' + $('#content').val());

    p7.encrypt();

    const derBuffer = forge.asn1.toDer(p7.toAsn1()).getBytes();

    $('#email').val(headers + '\r\n' + HEADERS + '\r\n\r\n' + wrap(btoa(derBuffer)));
  };

  $("#encrypt").click(encrypt);

})();
