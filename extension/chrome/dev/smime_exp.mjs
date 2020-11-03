/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

/* A sample file for testing over composing smime messages.
   From inside the project root folder, run with (node v12++): 
        node extension/chrome/dev/smime_exp.mjs
*/

'use strict';
import forge from 'node-forge';
import fs from 'fs';

const HEADERS = `To: vnikolaou17@gmail.com
Subject: test1000-secured
Date: Mon, 23 Mar 2020 15:57:20 +0100`;

const CERT = `------BEGIN CERTIFICATE-----
MIIF5DCCA8ygAwIBAgIQJFmRlUfJY63G5TRg7pNtBDANBgkqhkiG9w0BAQsFADCB
gTELMAkGA1UEBhMCSVQxEDAOBgNVBAgMB0JlcmdhbW8xGTAXBgNVBAcMEFBvbnRl
IFNhbiBQaWV0cm8xFzAVBgNVBAoMDkFjdGFsaXMgUy5wLkEuMSwwKgYDVQQDDCNB
Y3RhbGlzIENsaWVudCBBdXRoZW50aWNhdGlvbiBDQSBHMzAeFw0yMDEwMjgxMTQ0
MjVaFw0yMTEwMjgxMDQ0MjVaMCAxHjAcBgNVBAMMFXZuaWtvbGFvdTE3QGdtYWls
LmNvbTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAOlfeiOcmj4LeArW
e51XR6roJZP/BbjdIrbkFqh6w7fMpSjfDb0ptfcKcFu/SpAeTZT7EX1BnQkzfohR
EC7rQVJtPa5+mEDg0xduE96fsUMTUpJH2ZOQBsMGrVbc9xAJ2lxwFk4HGhdTYB+K
BRYe9kPiIEnmnjnQBIDGqyDxzBC4ICDrVLFronvPMEQ8x4g+KBGq1e4EUdSdUHDP
2PbNpPsvW6ITHU/vx96lKayXN+zxN0uA7Si6TVMTd2giKeSQ9cIn9+bOw77XU/UD
O+MgRyhcyo1KIrh+ncHLXEv3PFEuWafKgeS4k5kJFlSIwjxMqw10tTZWjOVA4JQY
sg6V9SUCAwEAAaOCAbYwggGyMAwGA1UdEwEB/wQCMAAwHwYDVR0jBBgwFoAUvpep
qoS/gL8QU30JMvnhLjIbz3cwfgYIKwYBBQUHAQEEcjBwMDsGCCsGAQUFBzAChi9o
dHRwOi8vY2FjZXJ0LmFjdGFsaXMuaXQvY2VydHMvYWN0YWxpcy1hdXRjbGlnMzAx
BggrBgEFBQcwAYYlaHR0cDovL29jc3AwOS5hY3RhbGlzLml0L1ZBL0FVVEhDTC1H
MzAgBgNVHREEGTAXgRV2bmlrb2xhb3UxN0BnbWFpbC5jb20wRwYDVR0gBEAwPjA8
BgYrgR8BGAEwMjAwBggrBgEFBQcCARYkaHR0cHM6Ly93d3cuYWN0YWxpcy5pdC9h
cmVhLWRvd25sb2FkMB0GA1UdJQQWMBQGCCsGAQUFBwMCBggrBgEFBQcDBDBIBgNV
HR8EQTA/MD2gO6A5hjdodHRwOi8vY3JsMDkuYWN0YWxpcy5pdC9SZXBvc2l0b3J5
L0FVVEhDTC1HMy9nZXRMYXN0Q1JMMB0GA1UdDgQWBBSiPatLQj0m8jf34FgOk775
/SQCGzAOBgNVHQ8BAf8EBAMCBaAwDQYJKoZIhvcNAQELBQADggIBADfn8KsfDAKU
/wweiKcXtkNobkv9477fN8vGm5FfLQEJxSz0CtlTvftrDKsJf285YW2YRnTz7NPW
AYOsoMppodzAaKpsnvbX6M1EvfrAHOUqQjPA8RcNUYu401/l6BDbybwJBRVOdbcc
IMxFO1eN77jFN0hy1EoYF0FnY4dglKOYrBUBfSQVsi2fccM7dLP96wZoyloB406I
sOH8WPIuq5vX3AzSudt9FisL/RAMwsd9yAq7resvd3TbUetBMivAd3HgMflXonOy
BDkfGcLvGZo/SbzE/ymrUEYA8+MkWQ/TQjJQuPxYL/P/hRCEa6BBEqQRLmLjCVvu
ILknYAy288fxavaklj11mkUWU/UiPetVwlLAIaDK0gG41mANSIT/06+wS5TEiPdb
6Syxte3sjEL05szseJS0TbgbxkAPbnwqCAmeY4yU1jlAT92mbvMTcQbKBrVXlK44
cdC90MSCFsUtY93+AwtnOSqZvZ+TBy8Blim445OzyWUAfkJArc5w/+MLXxq7kBfo
5LGerr1o7TE37LJxonIed3Q+qyL5Hz86mtPkvbtpQfoAcQPvnQa+HF+EJ/m/k5mC
zj5UjsmAemuUCtF69VbKOdmHbQRgDNGugI9vCbcQlBC1eyNV/GmQw8pEk0SS54qA
Tmn/8PLMFAAPH+FTwAyAbIwasEk7L9Iy
-----END CERTIFICATE-----
`;
const SMIME_HEADERS = `MIME-Version: 1.0
Content-Type: application/pkcs7-mime; name="smime.p7m"; smime-type=enveloped-data
Content-Transfer-Encoding: base64
Content-Disposition: attachment; filename="smime.p7m"
Content-Description: S/MIME Encrypted Message`;

const CONTENT = `test10000`;

const encrypt = () => {
    const p7 = forge.pkcs7.createEnvelopedData();
    const cert = forge.pki.certificateFromPem(String(CERT));
    p7.addRecipient(cert);
    p7.content = forge.util.createBuffer('\r\n\r\n' + CONTENT);
    p7.encrypt();
    const derBuffer = forge.asn1.toDer(p7.toAsn1()).getBytes();

    return HEADERS + '\r\n' + SMIME_HEADERS + '\r\n\r\n' + forge.util.encode64(derBuffer);
};

const encrypted = encrypt();

const file_location = '/Users/vnik/Projects/Mine/Test/msg_enc.eml';
fs.writeFile(file_location, encrypted, function (err) {
    if (err) throw err;
    console.log('\n\nEncrypted message is saved into ' + file_location + ':\n\n' + encrypted + '\n');
});

