/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch } from '../../js/common/platform/catch.js';

import * as forge from 'node-forge';

Catch.try(async () => {
  function wrap(string: string) {
    var lines = [];
    var index = 0;
    var length = string.length;
    while (index < length) {
      lines.push(string.slice(index, index += 76));
    }
    return lines.join('\r\n');
  }

  function encrypt() {
    var p7 = forge.pkcs7.createEnvelopedData();
    var cert = forge.pki.certificateFromPem(String($('#cert').val()));
    p7.addRecipient(cert);

    const headers = $('#headers').val();

    p7.content = forge.util.createBuffer(`${headers}

    ${$('#content').val()}`);

    p7.encrypt();

    const derBuffer = forge.asn1.toDer(p7.toAsn1()).getBytes();

    $('#email').val(`${headers}
MIME-Version: 1.0
Content-Type: application/pkcs7-mime; name="smime.p7m"; smime-type=enveloped-data
Content-Transfer-Encoding: base64
Content-Disposition: attachment; filename="smime.p7m"
Content-Description: S/MIME Encrypted Message

${wrap(btoa(derBuffer))}`);
  }

  $("#encrypt").click(encrypt);

})();
