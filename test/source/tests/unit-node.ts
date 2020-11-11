/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import * as ava from 'ava';

import { MsgBlock } from '../core/msg-block';
import { MsgBlockParser } from '../core/msg-block-parser';
import { PgpHash } from '../core/crypto/pgp/pgp-hash';
import { TestVariant } from '../util';
import { TestWithBrowser } from '../test';
import { expect } from 'chai';
import { KeyUtil, PrvKeyInfo } from '../core/crypto/key';
import { UnreportableError } from '../platform/catch.js';
import { Buf } from '../core/buf';
import { OpenPGPKey } from '../core/crypto/pgp/openpgp-key';
import { DecryptError, MsgUtil, PgpMsgMethod } from '../core/crypto/pgp/msg-util';
import { opgp } from '../core/crypto/pgp/openpgpjs-custom';
import { Att } from '../core/att.js';
import { ContactStore } from '../platform/store/contact-store.js';
import { GoogleData, GmailParser, GmailMsg } from '../mock/google/google-data';

// tslint:disable:no-blank-lines-func
/* eslint-disable max-len */
// tslint:disable:no-unused-expression
/* eslint-disable no-unused-expressions */

export let defineUnitNodeTests = (testVariant: TestVariant, testWithBrowser: TestWithBrowser) => {

  if (testVariant !== 'CONSUMER-LIVE-GMAIL') {

    ava.default(`[unit][MsgBlockParser.detectBlocks] does not get tripped on blocks with unknown headers`, async t => {
      expect(MsgBlockParser.detectBlocks("This text breaks email and Gmail web app.\n\n-----BEGIN FOO-----\n\nEven though it's not a vaild PGP m\n\nMuhahah")).to.deep.equal({
        "blocks": [
          MsgBlock.fromContent("plainText", "This text breaks email and Gmail web app.\n\n-----BEGIN FOO-----\n\nEven though it's not a vaild PGP m\n\nMuhahah"),
        ],
        "normalized": "This text breaks email and Gmail web app.\n\n-----BEGIN FOO-----\n\nEven though it's not a vaild PGP m\n\nMuhahah"
      });
      t.pass();
    });

    ava.default(`[unit][MsgBlockParser.detectBlocks] ignores false-positive blocks`, async t => {
      const input = `Hello, sending you the promised json:
      {
        "entries" : [ {
          "id" : "1,email-key-manager,evaluation.org,pgp-key-private,106988520142055188323",
          "content" : "-----BEGIN PGP PRIVATE KEY BLOCK-----\r\nVersion: FlowCrypt 7.6.9 Gmail Encryption\r\nComment: Seamlessly send and receive encrypted email\r\n\r\n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\r\n+P9DgunMb5OtkDwm6WWxpzV150LJcA==\r\n=FAco\r\n-----END PGP PRIVATE KEY BLOCK-----\r\n"
        }, {
          "id" : "1,email-key-manager,evaluation.org,pgp-key-public,ekm%40ekm-org-rules-test.flowcrypt.com",
          "content" : "-----BEGIN PGP PUBLIC KEY BLOCK-----\r\nVersion: FlowCrypt 7.6.9 Gmail Encryption\r\nComment: Seamlessly send and receive encrypted email\r\n\r\nxsBNBF5mRKEBCADX62s0p6mI6yrxB/ui/LqxfG4RcQzZJf8ah52Ynu1n8V7Y\r\n7143LmT3MfCDw1bfHu2k1OK7hT+BOi6sXas1D/fVtjz5WwuoBvwf1DBZ7eq8\r\ntMQbLqQ7m/A8uwrVFOhWfuxulM7RuzIPIgv4HqtKKEugprUd80bPus45+f80\r\nH6ZSgEpmZD6t9JShY6f8pU1OHcnPqFsFF0sLyOk7WcCG5Li3WjkwU/lIu18q\r\nR26oLb5UM8z6vv6JD29GmqCj+OLYaPk8b00kdpGEvTjw3VzGM+tXOgUf2y1T\r\nK9UfhMNkyswxUZw543CMTdw9V0+AzM0q70T/p0fP9nlJCv6M3bQm6D/vABEB\r\nAAHNL0VrbSBVc2VyIDxla21AZWttLW9yZy1ydWxlcy10ZXN0LmZsb3djcnlw\r\ndC5jb20+wsB1BBABCAAfBQJeZkShBgsJBwgDAgQVCAoCAxYCAQIZAQIbAwIe\r\nAQAKCRDESadeBea4P0KvCACD5uOgGxwGEmUWfH8EXPK7npDKulmoZnSWYrfC\r\nX3ctUKXjwPBWRXYid7LChnQAR6SRcyxyD1Eoel5ZVrJyKHqRkxcanFHeqRU1\r\nOyOgtsQyPIGtLipmOgc6i5JYhqbQ4mNu10CGS6ZKhjf6rFIqLl/8f4lnBc28\r\nUqVuP20Ru6KJZTVVQRF28FweMByR/3LyAWfObMwXJ0+uFEV941VEDv5MGdId\r\nfePTP2cHRSJxPqVhpPWtfzYLStUzLFvtLfE45hympok4lZeKfLVtZVVQEgT+\r\nojEImdiZQJ0dT+jeJhmuTjzURQcLapXv2GLBUZaY2zfoAXR31QNYjADOxlrO\r\nutSUzsBNBF5mRKEBCACVNQTzI2Cf1+G3q38OtXO89tuBI/a5TjcHh/sFIJB6\r\nPPuEg/uW+EsjkgI3yk+UZZd6iYohO2mJcJ7MnaFHOu7tmOEaaHSiYsA0RTnV\r\nqUBlbHbsl2oSlQJ/mjJ4cWq5ateuLHhx2RV0t1bm2anHJnqKGkqYqXA72m5g\r\nrLzRSJ9M43wQRheGWGNoNdg4kPxU+PjYwfk2ARX5SCUKoG0qp0RhRMplX74u\r\nYi+Ek/9qSyZevmhK55sXIUNwLsuEhejlr0iucOt2vcIybQ9EbMXz62yYMRjY\r\ngy4SxW5aQJxXFeWkSo6wzMqQ1ZiSArRCezBk+mftxNrmwmtCcJajQt2uAQQV\r\nABEBAAHCwF8EGAEIAAkFAl5mRKECGwwACgkQxEmnXgXmuD/7VAf+IMJMoADc\r\ndWNhn45AvkwbzSmYt4i2aRGe+qojswwYzvFBFZtyZ/FKV2+LHfKUBI18FRmH\r\nmKEba1UUetflytxiAwZxSJSf7Yz/NDiWaVn0eOLopmFMiPb02a5i3CjbLsDe\r\nex2y/69R0+fQc+rE3HZ04C8H/YAqFV0VOv3L+2EztOGK7KOZOx4toR05oDqb\r\nZbiDzwhsa2MugHLPLZuGl3eGk+n/EcINhopHg+HU8MHQE6rADvrok6QiYVhp\r\nGqi8ksD3kBAk43hGRSD2m/WDPWa/h2sh5rVswTKUDtv1fd1H6Ff5FnK21LHj\r\nEk0f+P9DgunMb5OtkDwm6WWxpzV150LJcA==\r\n=Hcoc\r\n-----END PGP PUBLIC KEY BLOCK-----\r\n"
        }, {
          "id" : "1,email-key-manager,evaluation.org,pgp-key-fingerprint,C05803F40E0B9FE4FE9B4822C449A75E05E6B83F",
          "content" : "1,email-key-manager,evaluation.org,pgp-key-private,106988520142055188323\n1,email-key-manager,evaluation.org,pgp-key-public,ekm%40ekm-org-rules-test.flowcrypt.com"
        } ]
      }`;
      const { blocks, normalized } = MsgBlockParser.detectBlocks(input);
      expect(normalized).to.equal(input);
      expect(blocks).to.have.property('length').that.equals(1);
      expect(blocks[0]).to.deep.equal(MsgBlock.fromContent("plainText", input));
      t.pass();
    });

    ava.default(`[unit][MsgBlockParser.detectBlocks] replaces intended blocks`, async t => {
      const prv = `-----BEGIN PGP PRIVATE KEY BLOCK-----\r\nVersion: FlowCrypt 7.6.9 Gmail Encryption\r\nComment: Seamlessly send and receive encrypted email\r\n\r\n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\r\n+P9DgunMb5OtkDwm6WWxpzV150LJcA==\r\n=FAco\r\n-----END PGP PRIVATE KEY BLOCK-----`;
      const pub = `-----BEGIN PGP PUBLIC KEY BLOCK-----\r\nVersion: FlowCrypt 7.6.9 Gmail Encryption\r\nComment: Seamlessly send and receive encrypted email\r\n\r\nxsBNBF5mRKEBCADX62s0p6mI6yrxB/ui/LqxfG4RcQzZJf8ah52Ynu1n8V7Y\r\n7143LmT3MfCDw1bfHu2k1OK7hT+BOi6sXas1D/fVtjz5WwuoBvwf1DBZ7eq8\r\ntMQbLqQ7m/A8uwrVFOhWfuxulM7RuzIPIgv4HqtKKEugprUd80bPus45+f80\r\nH6ZSgEpmZD6t9JShY6f8pU1OHcnPqFsFF0sLyOk7WcCG5Li3WjkwU/lIu18q\r\nR26oLb5UM8z6vv6JD29GmqCj+OLYaPk8b00kdpGEvTjw3VzGM+tXOgUf2y1T\r\nK9UfhMNkyswxUZw543CMTdw9V0+AzM0q70T/p0fP9nlJCv6M3bQm6D/vABEB\r\nAAHNL0VrbSBVc2VyIDxla21AZWttLW9yZy1ydWxlcy10ZXN0LmZsb3djcnlw\r\ndC5jb20+wsB1BBABCAAfBQJeZkShBgsJBwgDAgQVCAoCAxYCAQIZAQIbAwIe\r\nAQAKCRDESadeBea4P0KvCACD5uOgGxwGEmUWfH8EXPK7npDKulmoZnSWYrfC\r\nX3ctUKXjwPBWRXYid7LChnQAR6SRcyxyD1Eoel5ZVrJyKHqRkxcanFHeqRU1\r\nOyOgtsQyPIGtLipmOgc6i5JYhqbQ4mNu10CGS6ZKhjf6rFIqLl/8f4lnBc28\r\nUqVuP20Ru6KJZTVVQRF28FweMByR/3LyAWfObMwXJ0+uFEV941VEDv5MGdId\r\nfePTP2cHRSJxPqVhpPWtfzYLStUzLFvtLfE45hympok4lZeKfLVtZVVQEgT+\r\nojEImdiZQJ0dT+jeJhmuTjzURQcLapXv2GLBUZaY2zfoAXR31QNYjADOxlrO\r\nutSUzsBNBF5mRKEBCACVNQTzI2Cf1+G3q38OtXO89tuBI/a5TjcHh/sFIJB6\r\nPPuEg/uW+EsjkgI3yk+UZZd6iYohO2mJcJ7MnaFHOu7tmOEaaHSiYsA0RTnV\r\nqUBlbHbsl2oSlQJ/mjJ4cWq5ateuLHhx2RV0t1bm2anHJnqKGkqYqXA72m5g\r\nrLzRSJ9M43wQRheGWGNoNdg4kPxU+PjYwfk2ARX5SCUKoG0qp0RhRMplX74u\r\nYi+Ek/9qSyZevmhK55sXIUNwLsuEhejlr0iucOt2vcIybQ9EbMXz62yYMRjY\r\ngy4SxW5aQJxXFeWkSo6wzMqQ1ZiSArRCezBk+mftxNrmwmtCcJajQt2uAQQV\r\nABEBAAHCwF8EGAEIAAkFAl5mRKECGwwACgkQxEmnXgXmuD/7VAf+IMJMoADc\r\ndWNhn45AvkwbzSmYt4i2aRGe+qojswwYzvFBFZtyZ/FKV2+LHfKUBI18FRmH\r\nmKEba1UUetflytxiAwZxSJSf7Yz/NDiWaVn0eOLopmFMiPb02a5i3CjbLsDe\r\nex2y/69R0+fQc+rE3HZ04C8H/YAqFV0VOv3L+2EztOGK7KOZOx4toR05oDqb\r\nZbiDzwhsa2MugHLPLZuGl3eGk+n/EcINhopHg+HU8MHQE6rADvrok6QiYVhp\r\nGqi8ksD3kBAk43hGRSD2m/WDPWa/h2sh5rVswTKUDtv1fd1H6Ff5FnK21LHj\r\nEk0f+P9DgunMb5OtkDwm6WWxpzV150LJcA==\r\n=Hcoc\r\n-----END PGP PUBLIC KEY BLOCK-----`;
      const input = `Hello, these should get replaced:\n${prv}\n\nAnd this one too:\n\n${pub}`;
      const { blocks, normalized } = MsgBlockParser.detectBlocks(input);
      expect(normalized).to.equal(input);
      expect(blocks).to.have.property('length').that.equals(4);
      expect(blocks[0]).to.deep.equal(MsgBlock.fromContent('plainText', 'Hello, these should get replaced:'));
      expect(blocks[1]).to.deep.equal(MsgBlock.fromContent('privateKey', prv));
      expect(blocks[2]).to.deep.equal(MsgBlock.fromContent('plainText', 'And this one too:'));
      expect(blocks[3]).to.deep.equal(MsgBlock.fromContent('publicKey', pub));
      t.pass();
    });

    ava.default(`[unit][PgpHash.sha1] hello`, async t => {
      expect(await PgpHash.sha1UtfStr("hello")).to.equal("aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d");
      t.pass();
    });

    ava.default(`[unit][PgpHash.sha256] hello`, async t => {
      expect(await PgpHash.sha256UtfStr("hello")).to.equal('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
      t.pass();
    });

    ava.default(`[unit][PgpHash.doubleSha1Upper] hello`, async t => {
      expect(await PgpHash.doubleSha1Upper("hello")).to.equal("9CF5CAF6C36F5CCCDE8C73FAD8894C958F4983DA");
      t.pass();
    });

    ava.default(`[unit][PgpHash.challengeAnswer] hello`, async t => {
      expect(await PgpHash.challengeAnswer("hello")).to.equal('3b2d9ab4b38fe0bc24c1b5f094a45910b9d4539e8963ae8c79c8d76c5fb24978');
      t.pass();
    });

    ava.default(`[unit][PgpKey.usableButExpired] recognizes usable expired key`, async t => {
      const armored = "-----BEGIN PGP PRIVATE KEY BLOCK-----\nVersion: FlowCrypt 7.0.1 Gmail Encryption\nComment: Seamlessly send and receive encrypted email\n\n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\n+gib+vSxHvLhC6oDBA==\n=RIPF\n-----END PGP PRIVATE KEY BLOCK-----"; // eslint-disable-line max-len
      const expiredKey = await KeyUtil.parse(armored);
      expect(expiredKey.usableButExpired).to.equal(true);
      t.pass();
    });

    const smimeCert = `-----BEGIN CERTIFICATE-----
MIIE9DCCA9ygAwIBAgIQY/cCXnAPOUUwH7L7pWdPhDANBgkqhkiG9w0BAQsFADCB
jTELMAkGA1UEBhMCSVQxEDAOBgNVBAgMB0JlcmdhbW8xGTAXBgNVBAcMEFBvbnRl
IFNhbiBQaWV0cm8xIzAhBgNVBAoMGkFjdGFsaXMgUy5wLkEuLzAzMzU4NTIwOTY3
MSwwKgYDVQQDDCNBY3RhbGlzIENsaWVudCBBdXRoZW50aWNhdGlvbiBDQSBHMjAe
Fw0yMDAzMjMxMzU2NDZaFw0yMTAzMjMxMzU2NDZaMCIxIDAeBgNVBAMMF2FjdGFs
aXNAbWV0YS4zM21haWwuY29tMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKC
AQEArVVpXBkzGvcqib8rDwqHCaKm2EiPslQ8I0G1ZDxrs6Ke2QXNm3yGVwOzkVvK
eEnuzE5M4BBeh+GwcfvoyS/xI6m44WWnqj65cJoSLA1ypE4D4urv/pzG783y2Vdy
Q96izBdFyevsil89Z2AxZxrFh1RC2XvgXad4yyD4yvVpHskfPexnhLliHl7cpXjw
5D2n1hBGR8CSDbQAgO58PB7Y2ldrTi+rWBu2Akuk/YyWOOiGA8pdfLBIkOFJTeQc
m7+vWP2JTN6Xp+JkGvXQBRaqwyGVg8fSc4e7uGCXZaH5/Na2FXY2OL+tYDDb27zS
3cBrzEbGVjA6raYxcrFWV4PkdwIDAQABo4IBuDCCAbQwDAYDVR0TAQH/BAIwADAf
BgNVHSMEGDAWgBRr8o2eaMElBB9RNFf2FlyU6k1pGjB+BggrBgEFBQcBAQRyMHAw
OwYIKwYBBQUHMAKGL2h0dHA6Ly9jYWNlcnQuYWN0YWxpcy5pdC9jZXJ0cy9hY3Rh
bGlzLWF1dGNsaWcyMDEGCCsGAQUFBzABhiVodHRwOi8vb2NzcDA5LmFjdGFsaXMu
aXQvVkEvQVVUSENMLUcyMCIGA1UdEQQbMBmBF2FjdGFsaXNAbWV0YS4zM21haWwu
Y29tMEcGA1UdIARAMD4wPAYGK4EfARgBMDIwMAYIKwYBBQUHAgEWJGh0dHBzOi8v
d3d3LmFjdGFsaXMuaXQvYXJlYS1kb3dubG9hZDAdBgNVHSUEFjAUBggrBgEFBQcD
AgYIKwYBBQUHAwQwSAYDVR0fBEEwPzA9oDugOYY3aHR0cDovL2NybDA5LmFjdGFs
aXMuaXQvUmVwb3NpdG9yeS9BVVRIQ0wtRzIvZ2V0TGFzdENSTDAdBgNVHQ4EFgQU
FrtAdAOjrcVeHg5K+T7sj7GHySMwDgYDVR0PAQH/BAQDAgWgMA0GCSqGSIb3DQEB
CwUAA4IBAQAa9lXKDmV9874ojmIZEBL1S8mKaSNBWP+n0vp5FO0Yh5oL9lspYTPs
8s6alWUSpVHV8if4uZ2EfcNpNkm9dAajj2n/F/Jyfkp8URu4uvBfm1QColl/zM/D
x4B7FaD2dw0jTF/k5ulDmzUOc4k+j3LtZNbDOZMF/2g05hSKde/he1njlY3oKa9g
VW8ftc2NwiSMthxyEIM+ALbNQVML2oN50gArBn5GeI22/aIBZxjtbEdmSTZIf82H
sOwAnhJ+pD5iIPaF2oa0yN3PvI6IGxLpEv16tQO1N6e5bdP6ZDwqTQJyK+oNTNda
yPLCqVTFJQWaCR5ZTekRQPTDZkjxjxbs
-----END CERTIFICATE-----`;

    ava.default('[unit][KeyUtil.parse] S/MIME key parsing works', async t => {
      const key = await KeyUtil.parse(smimeCert);
      expect(key.id).to.equal('63F7025E700F3945301FB2FBA5674F84');
      expect(key.type).to.equal('x509');
      expect(key.usableForEncryption).to.equal(true);
      expect(key.usableForSigning).to.equal(true);
      expect(key.usableButExpired).to.equal(false);
      expect(key.emails.length).to.equal(1);
      expect(key.emails[0]).to.equal('actalis@meta.33mail.com');
      expect(key.identities.length).to.equal(1);
      expect(key.identities[0]).to.equal('actalis@meta.33mail.com');
      expect(key.isPublic).to.equal(true);
      expect(key.isPrivate).to.equal(true);
      expect(key.expiration).to.not.equal(undefined);
      t.pass();
    });

    const httpsCert = `-----BEGIN CERTIFICATE-----
MIIGqzCCBZOgAwIBAgIQB0/pAsa31hmIThyhhU2ReDANBgkqhkiG9w0BAQsFADBN
MQswCQYDVQQGEwJVUzEVMBMGA1UEChMMRGlnaUNlcnQgSW5jMScwJQYDVQQDEx5E
aWdpQ2VydCBTSEEyIFNlY3VyZSBTZXJ2ZXIgQ0EwHhcNMTkwNzA4MDAwMDAwWhcN
MjEwOTEwMTIwMDAwWjB2MQswCQYDVQQGEwJVUzETMBEGA1UECBMKQ2FsaWZvcm5p
YTEWMBQGA1UEBxMNU2FuIEZyYW5jaXNjbzEbMBkGA1UEChMSWSBDb21iaW5hdG9y
LCBJbmMuMR0wGwYDVQQDExRuZXdzLnljb21iaW5hdG9yLmNvbTCCASIwDQYJKoZI
hvcNAQEBBQADggEPADCCAQoCggEBAMsNA6BafLAJyN3SjorK4fq6P8oArZLHCHwB
uf4NQ0Oo/CdMgrV28/PM4yh2U0++zL9ZuS3foqMOSwy6DZbZIfBa/WBjhJKd4/gy
2yJwOGwSsIyVMpQ/HsBrZRruN2oEiu4inE4hPyYC03Z7zRlTDOuxDDBOJjuKMYRr
aMlzOqj7ZZDLAOYgRDoGHTGF1AnqT+ZsV98rXCijgFGvHTaXqJxcz+edKfHTzy+n
jsgbbbBJ9jGATX8qXqdqjCHm6D5G6hJ2MfcQt4Ohd5sm8BKvZAEMCcsLww2ijwx9
j7ZadN7n7dOp5sY32BEhe7l0ki22TDS+pcaySoP8E5axqrnAMkUCAwEAAaOCA1ww
ggNYMB8GA1UdIwQYMBaAFA+AYRyCMWHVLyjnjUY4tCzhxtniMB0GA1UdDgQWBBQO
JfQVakUgYp9x0ncgzQTXXFjfOjAfBgNVHREEGDAWghRuZXdzLnljb21iaW5hdG9y
LmNvbTAOBgNVHQ8BAf8EBAMCBaAwHQYDVR0lBBYwFAYIKwYBBQUHAwEGCCsGAQUF
BwMCMGsGA1UdHwRkMGIwL6AtoCuGKWh0dHA6Ly9jcmwzLmRpZ2ljZXJ0LmNvbS9z
c2NhLXNoYTItZzYuY3JsMC+gLaArhilodHRwOi8vY3JsNC5kaWdpY2VydC5jb20v
c3NjYS1zaGEyLWc2LmNybDBMBgNVHSAERTBDMDcGCWCGSAGG/WwBATAqMCgGCCsG
AQUFBwIBFhxodHRwczovL3d3dy5kaWdpY2VydC5jb20vQ1BTMAgGBmeBDAECAjB8
BggrBgEFBQcBAQRwMG4wJAYIKwYBBQUHMAGGGGh0dHA6Ly9vY3NwLmRpZ2ljZXJ0
LmNvbTBGBggrBgEFBQcwAoY6aHR0cDovL2NhY2VydHMuZGlnaWNlcnQuY29tL0Rp
Z2lDZXJ0U0hBMlNlY3VyZVNlcnZlckNBLmNydDAMBgNVHRMBAf8EAjAAMIIBfQYK
KwYBBAHWeQIEAgSCAW0EggFpAWcAdgDuS723dc5guuFCaR+r4Z5mow9+X7By2IMA
xHuJeqj9ywAAAWvSsgGGAAAEAwBHMEUCIQDuwilh2VuUnkTH0tmDUbAdKWDxFukD
m/4EktTbiwgFNAIgZltmbZUzknxDpGUXkVLpFmWTogu4wAGxh72hbbFp804AdgCH
db/nWXz4jEOZX73zbv9WjUdWNv9KtWDBtOr/XqCDDwAAAWvSsgIeAAAEAwBHMEUC
IQDzAY1oWZD1mhX+nCKORP4DxtO3AnhLSUMOyvv3OBbICQIgWWzTJP2gsPM6vHux
kb6fQtPekabXk0nhrOScMHr/cvAAdQBElGUusO7Or8RAB9io/ijA2uaCvtjLMbU/
0zOWtbaBqAAAAWvSsgEiAAAEAwBGMEQCIFqbAfpfnJFvd4miwlb3ZMCy/tph+qn6
0gFBIGhOFVlQAiBqo/dlgJEfPJU2pjPlR22kl7wTbnFnbVabTAy8eKx+DjANBgkq
hkiG9w0BAQsFAAOCAQEARcovgnGiFSc6ve8yTxFOho47wBKXwYAUfoGiiRFybcX6
43JcEMyH6KYU8qnfhKzp9juYBXTuc+4BqLP8fGdrP6I7xfYux6PWdhZ9ReVxZhrn
+7neAPnr4IcDyUMGB3bqn4wslL8Go1+dHKfM+Ix8k/+ytaXWYZQgiWNwmuR3Piay
vo5ioURVp9Hm28b1A5o828aXph6nbPhyaLD5gUdQTuprQGpJMo2tL9AmZhtw3iPH
Nu6RzBFp27492OM1t0vvbEsNkMgD3/wSCMev5rleor1bvTT+GkSEArEdpHRydtcN
WeNYP84Yjw6OFSHdi2W0VojRGhxm7PZCMqswN/XaBg==
-----END CERTIFICATE-----`;

    ava.default('[unit][KeyUtil.parse] S/MIME key parsing of HTTPS cert', async t => {
      // parsing throws because the domain name doesn't look like an e-mail
      // address
      await t.throwsAsync(() => KeyUtil.parse(httpsCert), UnreportableError);
    });

    ava.default('[unit][KeyUtil.parse] Unknown key type parsing fails', async t => {
      await t.throwsAsync(() => KeyUtil.parse('dummy string for unknown key'), Error);
    });

    const expiredPgp = `-----BEGIN PGP PRIVATE KEY BLOCK-----

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
=wYbc
-----END PGP PRIVATE KEY BLOCK-----`;

    ava.default('[unit][KeyUtil.parse] OpenPGP parsing of expired key', async t => {
      const key = await KeyUtil.parse(expiredPgp);
      expect(key.id).to.equal('3449178FCAAF758E24CB68BE62CB4E6F9ECA6FA1');
      expect(key.allIds.length).to.equal(2);
      expect(key.allIds[0]).to.equal('3449178FCAAF758E24CB68BE62CB4E6F9ECA6FA1');
      expect(key.allIds[1]).to.equal('2D3391762FAC9394F7D5E9EDB30FE36B3AEC2F8F');
      expect(key.type).to.equal('openpgp');
      expect(key.usableForEncryption).equal(false);
      expect(key.usableForSigning).equal(false);
      expect(key.usableButExpired).equal(true);
      expect(key.emails.length).to.equal(1);
      expect(key.emails[0]).to.equal('flowcrypt@metacode.biz');
      expect(key.identities.length).to.equal(1);
      expect(key.identities[0]).to.equal('Testing <flowcrypt@metacode.biz>');
      expect(key.isPublic).equal(false);
      expect(key.isPrivate).equal(true);
      expect(key.expiration).to.not.equal(undefined);
      t.pass();
    });

    const notExpiredPgp = `-----BEGIN PGP PRIVATE KEY BLOCK-----

lQPGBAAAB+EBCADX2Ii2BPS7Uxl/iLZOKYNI5RT/b1o2p8KGZ515fJsvpv1kPlK4
jgnsLLJHKOv9xgs4Yh53bAMjWBK38OBGGT3xQXFkjswRpsTmc9yPEp322q6B+gzt
ZCbtzYBUtoTxR3POHW/MSauSlDyYqZxDhGGUf0hGxfWKYeONw9ulxDb/k0iMLUH+
ywufQ0hX43qApWvLo+1C7vmDChd3Pyh9LRXfbAhTv9Aie9bs1Z5J/jSAYdlzJyyh
MQKxJFpGosieb51yfOT1voK6EIlhtJAiWrgDbNzEwoZ9tfPMIoEwqSSdNbb9xWb5
XqeM5dGGpgWb3ZNedw53ub6+DxGIQrEbeOPlABEBAAH+BwMCuOPhJfdVejLtGdDE
7sS2ZiEp9YVibM0W8/lJ23nro3LdS+tYjviBjuhA8lzr5DZk1hK5eJwOBV8whhwX
yuRuNeUmzwyeRxy0CeQN/fyWUvRbONWjHHVEyQYItrUNSc9+1BzUu8BoAe3rZA9c
lumYgtQkGXHlE8pGD4f6p/e8DLfV1gSWpzclzMeZOKLrBfzs97gFbNlK+npuDH5K
aHleT/MRdW8LTcQYjC7dOZeS0UmvGX28TOvJ8uZUEdL2/yzTmcicE9kEwBbl/PNu
tVbzGANWY3zKPfrhTZed0lKopMNRKMXs7QdSKta6+sCOzJDzd7N/sOvuKwFtEEDK
hJqvl9NUduPT7vbfuIzmqYY5i0SuegwuKsSBl12B1lwCUGsrzQLPC0W48oDQ1SaO
xApCl1MK72UmLPVkJqzKAZh8UQT3h2kHKytTi7cJ8g69IpDwR6nPVUQUbRobbWSC
2QFUd0J3316cJvHcPYnL/3o97/W9x+ZpG68Wa5DHFjM5neJ1VbQ/tUtWv5BTfipP
vST7s5QJEoRqWD2+2lg5wLrRi8bA87FmSi0yka33iqJ9A6yS0cPzck+cJ/5wuu8G
yyXzlUt7Q09l0Q95Wx1io1UkMfgahqeuUbbON+//fHO57LUhh0fa2Lbov1JXkvWO
quIE8qtx0cUeBgrz+et2bc+keHXp6nSZPlKyHZt5HzX6NtxRUIeMkC+WtON8Uvgh
7aqqQNPvGkjAmU8hXxP8aobLEOd1xQMSBdIOi5b9W4GPnAxMmzZ579UNTNrl2V4G
yK6+CCOm4q1WS9xLKuBOMvULpRvw+TWt+U+1bSkjzWbM3XhQt1hY4yoH44puHgXC
ILWh60KgYzot7Pt0iOqvXgyy0K/3JC+T4NU1FkF9sH4i/FyB3JeTKGF4O/nvFWs2
vzEfKiiV6JZctCBUZXN0aW5nIDxmbG93Y3J5cHRAbWV0YWNvZGUuYml6PokBVAQT
AQgAPgIbAwULCQgHAgYVCgkICwIEFgIDAQIeAQIXgBYhBDRJF4/Kr3WOJMtovmLL
Tm+eym+hBQJeqZOKBQlgir8pAAoJEGLLTm+eym+htJMIAItUdiHyjUVD2P9YZ0vw
4HpvDF3sAZ/qnbHesPy8+Ej87yu00oyWBcaV1QIz65pUfin4RzEpfVf70fjE4/Vn
2ayRht0vQG5KzG+bwlVfi8oCEf5ZsDCpOEZ95W+doV2xsvaNkHY2PpyoF8weHpnT
FjvYdSFXLXCpo9azvhNFL5MMCoNdZ5M8EHhxjR2qXr7u50m1ofVrFlwuPYfwj9Tt
U0ZOxFW4g1Vys7SiDh7RRCC1LHrUYVvRYt3I7GaetgUgrsp8G8S9WhochQepv5nY
DiERgp8tD9jz4+tBzov4nuxGTFNaIkfQM5QboyNeyoMZ/fv2NTAih5j28sRxf8VU
pkqdA8YEAAAH4QEIAMIl1Ne1dLEBf6oHPzlXQzHA9xZaY13Gb/21VK6aT1QInLLs
2abo96yFdYqTueDxUeNJLbyKBXaDv7ipwBYJa+ZPqnMfFU0Dwm0D4qU0qkVO4laT
4F34HVmCUTQaUa7JOQaXI4pwXbdmjacO+PCaM157bHbkkkwPkPK0vo1OEvV7zeAS
B/Z8Q7TRkk9YX0HsODpGxyRO6ylhksX0WqRCnTEdj8Nr62ZXv8q564saIwfdn1G/
xG83yJmuLwjK04PboTkC2eX+RlgAaumeY0hNbrneYabUq+8mK+ECIZIQkvA9b6dW
t65zPv2VYPazmsH0Lk+Bh9yEKSeXWCRcFzbKfhUAEQEAAf4HAwJTV8b8BCMeWe1u
8ajJ9t0LqO6HSdcR8UchD+aW6XMpsprzWWNxDosVDt7PWahIEmVUFTtBzOHIO7ia
fcalgYwbNSkJewVPIElEFMiaRkePVByWYkvlY4o3ueHgTOjw4UZE2KcfUyOyzeUe
pa83OOZA08wVeFE8PSws+ptmbevaonaW3YfhS5RqWz1bqfJY1qcdls0jq261muvj
VjyryB61qcFh24F9O2rmlZEvtrHoWredYdqImr+ZLN/UaVu37t17xMGCccdDlWTz
UBe2XmK8Hmn16XUgAApin5KokrmOveeUL4Dgc+FMMqXAPgz96x8onUFSwbORdXZm
r28ZxlP7IOUCRUGq0t4EfO7mP7U34B8E1l0BFSfe51goj9cavkw/F7YfKmJZ0dIg
LO78f2S79LrPm1KrwExjHGeqUUx4ygvAMkV5N7qCoSvtYzNQhYwt74y/8ShSijO+
Hz5TGEwQb9SSQ8T/fQCCPZJ3NcQH1X2W2R8thtjwufMRlPo581AmAxy1hXxNEUIA
mAOQ1enkF/E/7Yrmt59r5JIWcoGj83WER3g4JfV7Lr8BndtM6kSPwqECjU8sFUyd
oj6zB9kaTQXCTEFs8z459b99kAEoOKRAugequqpxLKtCehmCLbv1ry1+HuofxuBl
ByFUyy1OmEnJOHEbDRuIDM0V2u/wuoGD6lNur/UAfOTs0Q2FWuuCBCs+uXFDyvIP
krxRTijfIzAJPfCuurnouD8JxUY4A4dxPUSPCVOoPVJ/EJ7LUQU/nsDFyi9oxHkP
F3jf9IIP3Exzr1w5rRKa+r0tP3nqnS9ZSDu4zIlGet+YKabIeRvj9UTuYKPwLKRA
/WtjlkybjJerZpZXPSlV/ZsqkNTMP+Pj8rNU2e7ztIy3QsbeAkFMCxLUWx+otM/L
FOFYjwL6HDnfqyiJATwEGAEIACYCGwwWIQQ0SRePyq91jiTLaL5iy05vnspvoQUC
XqmUhwUJYIrAJgAKCRBiy05vnspvoSf4CACkM3ZRFTP8HyRx+LNzyn/FDHEl3CMt
/40iuWXJ3t+raiha1r3ZkNhPAu8WR3KmFYxCCmKwQjr9oF9ahcjuvAidZdhvH4YW
4hc5b4myHPwTpd25Re5tI3l9fmwDhqt1XdP1ufgOIoMc/JGuizLAxu9kxQTL6CIs
cAdAyCR+iT6DIR0cnrI/zNGG3B0wbodktP9/Usj59GF9+8LRJ5LRussU0bj/M2AM
kMM1A/MznyBngfgmWaK8D9DjtdnGxObyA0XoNalEG9Cj/S4kEl4CQGhHi0EROBOp
KwoTyPGP6prXobe5lmo+4Ji3bE+OFqD20SgDyM6ER7KsrjsKi/Gmh7Q0
=U0GN
-----END PGP PRIVATE KEY BLOCK-----`;

    ava.default('[unit][KeyUtil.parse] OpenPGP parsing of not-expired key', async t => {
      const key = await KeyUtil.parse(notExpiredPgp);
      expect(key.id).to.equal('3449178FCAAF758E24CB68BE62CB4E6F9ECA6FA1');
      expect(key.allIds.length).to.equal(2);
      expect(key.allIds[0]).to.equal('3449178FCAAF758E24CB68BE62CB4E6F9ECA6FA1');
      expect(key.allIds[1]).to.equal('2D3391762FAC9394F7D5E9EDB30FE36B3AEC2F8F');
      expect(key.type).to.equal('openpgp');
      expect(key.usableForEncryption).equal(true);
      expect(key.usableForSigning).equal(true);
      expect(key.usableButExpired).equal(false);
      expect(key.emails.length).to.equal(1);
      expect(key.emails[0]).to.equal('flowcrypt@metacode.biz');
      expect(key.identities.length).to.equal(1);
      expect(key.identities[0]).to.equal('Testing <flowcrypt@metacode.biz>');
      expect(key.isPublic).equal(false);
      expect(key.isPrivate).equal(true);
      expect(key.expiration).to.not.equal(undefined);
      t.pass();
    });

    const nonExpiringKey = `-----BEGIN PGP PUBLIC KEY BLOCK-----

mDMEXylIoBYJKwYBBAHaRw8BAQdAMgtGtZnSa/oq2FHZ7Ow7rnCpRDJ5+WlojNXt
6r74RdW0DE5vdCBFeHBpcmluZ4iQBBMWCAA4FiEEjdc3wIbaszE+t21fSpIVLfL9
bb0FAl8pSKACGwMFCwkIBwIGFQoJCAsCBBYCAwECHgECF4AACgkQSpIVLfL9bb1J
/QD8CDQrGNP3ZvSQUoA7kTQURLO9qkctY6Yn1+GsJR6M3zQA/ievQawWchCZVzgT
SBC9rHNi6GbYSn3Tm+PnsUOe9g8NuDgEXylIoBIKKwYBBAGXVQEFAQEHQLU+tO+s
CpD7n1C0Mg9Yzghr9pMps9UaexwMuxxVeWZcAwEIB4h4BBgWCAAgFiEEjdc3wIba
szE+t21fSpIVLfL9bb0FAl8pSKACGwwACgkQSpIVLfL9bb39XgD6A91LwqK+CEzl
McqZHXuttXHc2wZ2nvjjtbzWSEzxvpAA/jdWwCNBg65Wh93Df5/6Ec05W8AgFwJH
/NBHfzBA90AM
=E46c
-----END PGP PUBLIC KEY BLOCK-----`;

    ava.default('[unit][KeyUtil.parse] OpenPGP parsing of never expiring key', async t => {
      const key = await KeyUtil.parse(nonExpiringKey);
      expect(key.id).to.equal('8DD737C086DAB3313EB76D5F4A92152DF2FD6DBD');
      expect(key.expiration).to.equal(undefined);
      t.pass();
    });

    const pgpArmoredTwoKeys = `-----BEGIN PGP PUBLIC KEY BLOCK-----

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
zZFGf6poIjKUC8V2Zww6
=Hjpw
-----END PGP PUBLIC KEY BLOCK-----`;

    ava.default('[unit][KeyUtil.readMany] Parsing two OpenPGP armored together keys', async t => {
      const { keys, errs } = await KeyUtil.readMany(Buf.fromUtfStr(pgpArmoredTwoKeys));
      expect(keys.length).to.equal(2);
      expect(errs.length).to.equal(0);
      expect(keys.some(key => key.id === '5A5F75AEA28751C3EE8CFFC3AC5F0CE1BB2B99DD')).to.equal(true);
      expect(keys.some(key => key.id === 'BBC75684E46EF0948D31359992C4E7841B3AFF74')).to.equal(true);
      expect(keys.every(key => key.type === 'openpgp')).to.equal(true);
      t.pass();
    });

    const pgpArmoredSeparate = `-----BEGIN PGP PUBLIC KEY BLOCK-----

mQENBFzYItQBCAD1FmP71FRRC3nkaIltLH2oZklMY+SAbnses8o5e3wj3DKQk3P4
ZTxALAl9g5GtYqYE5vA2SOSRiuiVD+ibYDOAAEjBBKYlfaFy1UCFAK5gibhP1o04
eEuRuAJt9JJO0aFTj+cwWx/wII+ledavdiWHg1T80JEoHV+EMlvNB51ydZGnSjPs
ntQTO4tQzp1knA9hS20O6g6gLakaNlEc1m3G445d8tWj7V3plLR+FegYWoCJkQ4F
3W6jLSM4ErfLQpj6Ew6bk65wRC8XSNFJAImfVGd40tAtYcHFf/HE3D3NLH3OhFc3
EUnaQtCEqrWqBD/HFdGvqmbVYL3KWusJCXafABEBAAG0IFRlc3QgV0tEIDx0ZXN0
LXdrZEBtZXRhY29kZS5iaXo+iQFUBBMBCAA+FiEEWl91rqKHUcPujP/DrF8M4bsr
md0FAlzYItQCGwMFCQPCZwAFCwkIBwIGFQoJCAsCBBYCAwECHgECF4AACgkQrF8M
4bsrmd3Ftwf+OhNoF3bq1o7QFJVt6bfIEN1Uqf2+h11pO60ZGJNjLm45rdy2Jt4r
Q86h/XUONGDfV28Pj/Gwz7/ruB4YcFL83HwuGHHh/QZsbHvmopycSS7DQp6yiiSk
M0sLBfbG5jxQpgahrsVqPDhWhvuNCGrWFqEPAmLWyz7CyvtVbglL4cB9V7W9eHFz
FsLSITLR9LJybqqIIRXerpc/cj4ZI0ll/nZbMuFsY/CWbfdxk6CsFTAQ7gegXs/c
QaKQuQJFtl46CFCjUMJJN3SSsaihOu5V3zVWJdW1GJXQWpe2Rir2MqzhSuW0Uw8g
/nd2sNwmriQRfQd7d46YOLcBqVksGiWCb7kBDQRc2CLUAQgA10E6Da2YSXL/6VKJ
YaFNgBi9p7pko6KzrSD8AGxjpDo7BV11jBNImZxP3WrmjPfFYuIET+Lt05St/fdn
tkiHkkPimKNSmH46E0lRnULO3Tmo7Eiu/CMPI5Oj9KZr8fQBvFOh2qFr+dgflIHr
WGO94tIeRq2jdZblGEtOY8kfqf7/WbzaVhIJM/zaYyeQFLv+CNkc2AMIDpsBmKPL
7wrQzGi1JK4Xn7JdRgMoEVFJJFsDkByvp6mvwjRgXkG/UKnDf75vOJzCP1i/6ESb
fu0+pz/gsiwPIcEnS+1F2LWmV2EQTf4FPz75J31bGixP2qIa+Macr+AepreugpFq
gdUQjwARAQABiQE8BBgBCAAmFiEEWl91rqKHUcPujP/DrF8M4bsrmd0FAlzYItQC
GwwFCQPCZwAACgkQrF8M4bsrmd3GZQf+OLkOd0ddebGvLgcQrUANuKASTbke+PUD
laTTpdJlhufLqXHAL3ydZjnmFXEOYQPzWr1DgaUEiEtiw4MO3lWKXj3+J200jPpg
+XEFNXneXrZEJoG/q4h2hB0icP/1k1q+FsSgc3I6kVsGBmnMasJ+j9FhUJ/JECJS
gQwP7QeE0O0oa8zQU+INc6viBkV1F3FP5PvIfVjfmw8yqlhZgeCSSavo/kEgyTlg
cItxVc8FURPk2BkmWYjZ+N0uNOYrI7FGOHdoW4j9rmuOhtYHGLRC0mAcADIRcv7p
ZlBF2eTk0HMhizTvGmOWcv5htkCqxpCSNnjHLsM6YCl+CcW6a8U7/g==
=46pe
-----END PGP PUBLIC KEY BLOCK-----
-----BEGIN PGP PUBLIC KEY BLOCK-----

mQENBF4pefQBCADjcgq0Wi7ZCDiTCnMnG5PTnTU5nWW7eg9ofEjV9SbDDiHV2SkJ
ZBynFzGgAaWs/x3FINwNffnE/Yc4iokd1wk3tlhcfvzLUMZW9ZrTPAGOioSKa621
nQjTKkln2kuU60oeG5CJocIiLroLHay9N9kVvlidH4dVbC9+jyvdcjieq3RUnXVC
zpF3vZN/aTgbjecyfQY4oeiMglpBImTdPw/7k3Xz6L7D2o8wIuVyS7KxTrIsmR1F
uTkfAWzfhI4rZHxyzWmCWZnC+N+rLVdLOo4V7op6SZE1x3Hhy2BXChBzjIZbJ1/J
eIQLMk8WaszkGc0uXFXsF/fB+g9woa7cRjT5ABEBAAG0FXRlc3Qtd2tkQG1ldGFj
b2RlLmJpeokBVAQTAQgAPhYhBLvHVoTkbvCUjTE1mZLE54QbOv90BQJeKXn0AhsD
BQkDwmcABQsJCAcCBhUKCQgLAgQWAgMBAh4BAheAAAoJEJLE54QbOv908+YH+gM4
kpkNL7IWUjRJqmuSybWT23BKtFq4/P1HhGyUKmIq/ZqjBIzR+rgmfM5qw/HYWO+l
FGPoCeusooMauWWHZ5rbNrP05cwRlRvCg+0GXJ3Yw2tzOayXq5SL3QLa//P2z4yt
Wa9pl5EXIzAWNKlGiuTmZ19tDIrNg3tJQKhdd9MNRite4ZyMvkMB9l/d8PSIIa9J
bbOaQZa0WH6lg417DHAhWIzcI8PLW9hXoeGkOy5z7ah9H7+rZJAcz/Z2Qfo0zu4+
vQnzefA9vzd+d9CRr3ExZMNxpSykH4l4PbYjMpKfLRpdsLvvLnV2H06KZEcxBsn0
czaln5Xm/0wga57IgFW5AQ0EXil59AEIAMW00JciIzastXINdy0Lx15ikpkwQe/o
BO0zxifSRwsvpgh3KdvKV2DfrEagvVXpjv3GV0li5bvdn9mKwDkpVttHddV4u4Sy
ATEN733x9EjhcZf8CQRbqDnJKjpDLI2xpUf9R5coI1je9agNeyOsppXnVs371O4L
aVYzdXLUtZ6LqMN/F0xVbDEEZsFzBI+0Z0f1b0tHuExF3xvBg6bodS7Tnel3LP0x
ZGb1EiwNMo+9GbLkpr64YkUrXvY/L7jm0eQSYmxUTD5o+EDKhizxDCD7adqCzhhK
XtpDsXH1M1N15SzJlchzbXBVY+cNC+6OCmsKFjbhGtFaEFSE/kdBMZMAEQEAAYkB
NgQYAQgAIBYhBLvHVoTkbvCUjTE1mZLE54QbOv90BQJeKXn0AhsMAAoJEJLE54Qb
Ov900VcH/RGkjO1VfyKPgm17PttvC6PtvSAERvEhSRTy3i2ds4s3DXtG3Y1N6NU/
YqolPFrY6PtFX0tTSeN4Zw1x9WckD0hI6qWsj0gcdwK05MmUn8TW0gKK2DwghLZt
3vtn25PuQtzIz/ahwMkOYM5vfJLH3ZoWt7yF/zrvuul9t4bM6ZaNA8uGJf+bYObx
CnSPBUoy8XAfrMg9YDF8djFjhGktbTMWY3feKbzPUHBfT6kii+D+Hmj/C2eb8gYx
XPk9f8zmQi8NqUMzsOQokj9iq+UB1cC3korAsuCVmC3El6cJbQvWEAMEVOFdY3pA
vpQiyk4ceuTNkUZ/qmgiMpQLxXZnDDo=
=lQQh
-----END PGP PUBLIC KEY BLOCK-----`;

    ava.default('[unit][KeyUtil.readMany] Parsing two OpenPGP armored separate keys', async t => {
      const { keys, errs } = await KeyUtil.readMany(Buf.fromUtfStr(pgpArmoredSeparate));
      expect(keys.length).to.equal(2);
      expect(errs.length).to.equal(0);
      expect(keys.some(key => key.id === '5A5F75AEA28751C3EE8CFFC3AC5F0CE1BB2B99DD')).to.equal(true);
      expect(keys.some(key => key.id === 'BBC75684E46EF0948D31359992C4E7841B3AFF74')).to.equal(true);
      expect(keys.every(key => key.type === 'openpgp')).to.equal(true);
      t.pass();
    });

    ava.default('[unit][KeyUtil.readMany] Parsing one S/MIME key', async t => {
      const { keys, errs } = await KeyUtil.readMany(Buf.fromUtfStr(smimeCert));
      expect(keys.length).to.equal(1);
      expect(errs.length).to.equal(0);
      expect(keys[0].id).to.equal('63F7025E700F3945301FB2FBA5674F84');
      expect(keys[0].type).to.equal('x509');
      t.pass();
    });

    const smimeAndPgp = smimeCert + '\r\n' + expiredPgp;

    ava.default('[unit][KeyUtil.readMany] Parsing one S/MIME and one OpenPGP armored keys', async t => {
      const { keys, errs } = await KeyUtil.readMany(Buf.fromUtfStr(smimeAndPgp));
      expect(keys.length).to.equal(2);
      expect(errs.length).to.equal(0);
      expect(keys.some(key => key.id === '63F7025E700F3945301FB2FBA5674F84')).to.equal(true);
      expect(keys.some(key => key.id === '3449178FCAAF758E24CB68BE62CB4E6F9ECA6FA1')).to.equal(true);
      expect(keys.some(key => key.type === 'openpgp')).to.equal(true);
      expect(keys.some(key => key.type === 'x509')).to.equal(true);
      t.pass();
    });

    ava.default('[unit][KeyUtil.parse] key was never usable', async t => {
      const expiredPubKey = '-----BEGIN PGP PUBLIC KEY BLOCK-----\r\nVersion: FlowCrypt Email Encryption 7.8.4\r\nComment: Seamlessly send and receive encrypted email\r\n\r\nxsBNBF8QF1cBCADFQRM0S6kJ1LxL+Y2hqz+w2PIbAKnNpV4gr1D0jEX9ygMY\r\nYxyjGP7QcK2umeBrioWBUET/5yu+KkSVFOxGwXw2m1MqJXZH6fPumgDBEAYg\r\n8afLXI/5Rh7Lp2Z3eBDog6W0I9EOHAB6iFHQgc5m+PUlehMZ23VUKxDpb4kW\r\nsIts1b8Zm0sSimUf15bz0nGxCf00bYf5lCuxBfgAQGK+FgpIAdc03a7VI4zJ\r\nc/A18PR4mlMeDfIj2yWKaL4ka8lr8d+qAP2Cu0I6GcNgBUl5yCWc/6S20J52\r\nKjoa48w1vdAYzK1hjTE7INLrB6WKOCPLoY0jRuqE+ksarw6JtNsAhNrFABEB\r\nAAHNKTxoYXMub2xkZXIua2V5Lm9uLmF0dGVzdGVyQHJlY2lwaWVudC5jb20+\r\nwsCTBBABCAAmBQJfEBpQBQkAAAACBgsJBwgDAgQVCAoCBBYCAQACGQECGwMC\r\nHgEAIQkQ0CoIfv1WLLMWIQQoKZEjISHFGWNfjmPQKgh+/VYss4EFB/9apXb/\r\nRYrf/FwK3NEeAuVAjq4sQFOC+e2sOO1Y1i74Hm5Q3YpL5FPWxg1zzQR3cKlw\r\ngwGiTBH9Re86KuB6XIIhropA94c0c5RGXf4Syb66hsp+xyb5laoazW274M26\r\nLhNou77CFgJ4UTOYPqNoDADcGPCoYzlU/tkp8q+vuIEBuizNkO+vOdFdrG9x\r\nON2n7aPVBWTHTy7PXVQr6wYfbj2c3cmH9ju5bZKoKoZ7niR3jQi+NUAHf09Z\r\nkwWGoYwD37iTtPWrn/nnMqp7nqJxpChsJvtfousgKHWUA1IsCXoSeExZuXYU\r\nVpJduSYQx5H6dy4QwmK8bzRfra/l5O6sRTbNzsBNBF8QF1cBCADL0rwgqVw3\r\nsQ6JD7j9eOkbcc0iNrxLqYWnBCu71opLWVQ0b8mw9DqT3WuXtvOVmEBkqDig\r\nq9Q78BbD2EfQhFNuvcE5GL38BvyUkpgZBC+vi9UrisQTStmLS5bSsT7aipwM\r\nGy3tXFIoHX8XQk8swbKa20fCYd5KKZr3wFBZ6mtXN3O1qgelZ4HEl/bCFz6c\r\nuvZUFLvLaMksXh7um2/bjnB6E9uktn/ts34rbYIuHxVTLs6bq4VbPiUilurz\r\n8uzAsU2HMw2QTQTaJzycJyYzdDxAIXrSmtFah2/wqSYC82r65sA17y3gtbHq\r\neP0pzbzbMQitPCV2poxIHJuiMYh4iWV9ABEBAAHCwHwEGAEIAA8FAl8QGlAF\r\nCQAAAAICGwwAIQkQ0CoIfv1WLLMWIQQoKZEjISHFGWNfjmPQKgh+/VYsswOo\r\nCAC2gkz5f7RLboxFxgbjleY/SWttf9j5pJGCfcaPzLGo8wCbnEUdhs+FqAml\r\nGDF1yZAexCQLBukVhil1yEnknaX1emeHB7d4g6cQFoKtSHeVZ0C9mmM+OJMn\r\nZoGVylTsOLMmVXM/CXyp9JUAlo/oZm1Zpb9RK5rvNJukH1f0DajQjWlC09Y9\r\nVLVDBxlJccsEdas1yojMDHMqNOMiNaAlA33mrY3ucAiKb4q3uP9IuDRuD83M\r\ncoDahY5p8xl6IbKQhnxoWtBgGJWrlwBZro83z9HzW4LmP99pPZqfLZQAevUL\r\n+oQiPqyh512p6O5usc1GkEoN9cn9b/qnvnRu5RMxC/vI\r\n=NveA\r\n-----END PGP PUBLIC KEY BLOCK-----\r\n';
      const parsed = await KeyUtil.parse(expiredPubKey);
      expect(parsed?.usableForEncryption).to.equal(false);
      expect(parsed?.expiration).to.equal(1594890073000);
      expect(parsed?.usableButExpired).to.equal(false); // because last signature was created as already expired, no intersection
      t.pass();
    });

    ava.default('[unit][MsgUtil.verifyDetached] verifies Thunderbird html signed message', async t => {
      const data = new GoogleData('flowcrypt.compatibility@gmail.com');
      const msg: GmailMsg = data.getMessage('1754cfd1b2f1d6e5')!;
      const msgText = Buf.fromBase64Str(msg!.raw!).toUtfStr();
      const sigText = msgText
        .match(/\-\-\-\-\-BEGIN PGP SIGNATURE\-\-\-\-\-.*\-\-\-\-\-END PGP SIGNATURE\-\-\-\-\-/s)![0]
        .replace(/=\r\n/g, '').replace(/=3D/g, '=');
      const plaintext = msgText
        .match(/Content\-Type: multipart\/mixed; boundary="vv8xtFOOk2SxbnIpwvxkobfET7PglPfc3".*\-\-vv8xtFOOk2SxbnIpwvxkobfET7PglPfc3\-\-\r?\n/s)![0]
        .replace(/\r?\n/g, '\r\n')!;
      const pubkey = plaintext
        .match(/\-\-\-\-\-BEGIN PGP PUBLIC KEY BLOCK\-\-\-\-\-.*\-\-\-\-\-END PGP PUBLIC KEY BLOCK\-\-\-\-\-/s)![0]
        .replace(/=\r\n/g, '').replace(/=3D/g, '=');
      const from = GmailParser.findHeader(msg, "from");
      const contact = await ContactStore.obj({ email: from, pubkey, client: 'pgp' });
      await ContactStore.save(undefined, contact);
      const result = await MsgUtil.verifyDetached({ plaintext: Buf.fromUtfStr(plaintext), sigText: Buf.fromUtfStr(sigText) });
      expect(result.match).to.be.true;
      t.pass();
    });

    ava.default('[unit][MsgUtil.verifyDetached] verifies Thunderbird text signed message', async t => {
      const data = new GoogleData('flowcrypt.compatibility@gmail.com');
      const msg: GmailMsg = data.getMessage('1754cfc37886899e')!;
      const msgText = Buf.fromBase64Str(msg!.raw!).toUtfStr();
      const sigText = msgText
        .match(/\-\-\-\-\-BEGIN PGP SIGNATURE\-\-\-\-\-.*\-\-\-\-\-END PGP SIGNATURE\-\-\-\-\-/s)![0]
        .replace(/=\r\n/g, '').replace(/=3D/g, '=');
      const plaintext = msgText
        .match(/Content\-Type: multipart\/mixed; boundary="XWwnusC4nxhk2LRvLCC6Skcb8YiKQ4Lu0".*\-\-XWwnusC4nxhk2LRvLCC6Skcb8YiKQ4Lu0\-\-\r?\n/s)![0]
        .replace(/\r?\n/g, '\r\n')!;
      const pubkey = plaintext
        .match(/\-\-\-\-\-BEGIN PGP PUBLIC KEY BLOCK\-\-\-\-\-.*\-\-\-\-\-END PGP PUBLIC KEY BLOCK\-\-\-\-\-/s)![0]
        .replace(/=\r\n/g, '').replace(/=3D/g, '=');
      const from = GmailParser.findHeader(msg, "from");
      const contact = await ContactStore.obj({ email: from, pubkey, client: 'pgp' });
      await ContactStore.save(undefined, contact);
      const result = await MsgUtil.verifyDetached({ plaintext: Buf.fromUtfStr(plaintext), sigText: Buf.fromUtfStr(sigText) });
      expect(result.match).to.be.true;
      t.pass();
    });

    ava.default('[unit][MsgUtil.getSortedKeys,matchingKeyids] must be able to find matching keys', async t => {
      const pp = 'some pass for testing';
      const key1 = await OpenPGPKey.create([{ name: 'Key1', email: 'key1@test.com' }], 'curve25519', pp, 0);
      const key2 = await OpenPGPKey.create([{ name: 'Key2', email: 'key2@test.com' }], 'curve25519', pp, 0);
      const pub1 = await KeyUtil.parse(key1.public);
      const pub2 = await KeyUtil.parse(key2.public);
      // only encrypt with pub1
      const { data } = await MsgUtil.encryptMessage({ pubkeys: [pub1], data: Buf.fromUtfStr('anything'), armor: true }) as PgpMsgMethod.EncryptPgpArmorResult;
      const m = await opgp.message.readArmored(Buf.fromUint8(data).toUtfStr());
      const kisWithPp: PrvKeyInfo[] = [ // supply both pub1 and pub2 for decrypt
        { private: key1.private, longid: OpenPGPKey.fingerprintToLongid(pub1.id), passphrase: pp },
        { private: key2.private, longid: OpenPGPKey.fingerprintToLongid(pub2.id), passphrase: pp }
      ];
      // we are testing a private method here because the outcome of this method is not directly testable from the
      //   public method that uses it. It only makes the public method faster, which is hard to test.
      // @ts-ignore - accessing private method
      const sortedKeys = await MsgUtil.getSortedKeys(kisWithPp, m);
      // point is that only one of the private keys should be used for decrypting, not two
      expect(sortedKeys.prvMatching.length).to.equal(1);
      expect(sortedKeys.signedBy.length).to.equal(0);
      expect(sortedKeys.encryptedFor.length).to.equal(1);
      expect(sortedKeys.prvForDecrypt.length).to.equal(1);
      expect(sortedKeys.prvForDecryptDecrypted.length).to.equal(1);
      // specifically the pub1
      expect(sortedKeys.prvForDecryptDecrypted[0].longid).to.equal(OpenPGPKey.fingerprintToLongid(pub1.id));
      // also test MsgUtil.matchingKeyids
      // @ts-ignore
      const matching1 = await MsgUtil.matchingKeyids(pub1, m.getEncryptionKeyIds());
      expect(matching1.length).to.equal(1);
      // @ts-ignore
      const matching2 = await MsgUtil.matchingKeyids(pub2, m.getEncryptionKeyIds());
      expect(matching2.length).to.equal(0);
      t.pass();
    });

    ava.default('[OpenPGPKey.fingerprintToLongid] for both pgp and s/mime', async t => {
      // shorten pgp fingerprint to become longid
      expect(OpenPGPKey.fingerprintToLongid('3449178FCAAF758E24CB68BE62CB4E6F9ECA6FA1')).to.equal('62CB4E6F9ECA6FA1');
      // leave s/mime id as is
      expect(OpenPGPKey.fingerprintToLongid('63F7025E700F3945301FB2FBA5674F84')).to.equal('63F7025E700F3945301FB2FBA5674F84');
      // throw on broken format
      expect(() => OpenPGPKey.fingerprintToLongid('aaxx')).to.throw('Unexpected fingerprint format (len: 4): "aaxx"');
      t.pass();
    });

    ava.default('[Att.sanitizeName] for special and unicode characters', async t => {
      // slash
      expect(Att.sanitizeName('abc/def')).to.equal('abc_def');
      // backslash
      expect(Att.sanitizeName('abc\\def')).to.equal('abc_def');
      // combinations of slashes and backslashes
      expect(Att.sanitizeName('abc\\/def')).to.equal('abc_def');
      expect(Att.sanitizeName('abc/\\def')).to.equal('abc_def');
      // trimming
      expect(Att.sanitizeName('  1  ')).to.equal('1');
      expect(Att.sanitizeName('    ')).to.equal('_');
      // empty
      expect(Att.sanitizeName('')).to.equal('_');
      // cyrillic
      const cyrillicName = '\u0410\u0411\u0412';
      expect(Att.sanitizeName(cyrillicName)).to.equal(cyrillicName);
      t.pass();
    });

    ava.default('[MsgUtil.encryptMessage] do not decrypt message when encrypted for key not meant for encryption', async t => {
      const data = Buf.fromUtfStr('hello');
      const passphrase = 'pass phrase';
      // a normal keypair
      // sec  rsa2048/F90C76AE611AFDEE
      //      created: 2020-10-15  expires: never       usage: SC
      //      trust: ultimate      validity: ultimate
      // ssb  rsa2048/4BA880ECE71397FC
      //      created: 2020-10-15  expires: never       usage: E
      const prvEncryptForSubkeyOnly = `-----BEGIN PGP PRIVATE KEY BLOCK-----\n\nlQOYBF+IL20BCACTJLnno0xB29YeNP9xV4bdkEE0zSo/UoFzRKpUupG+0El17oDw\nQDUeW2YjZwLxMJVlRyo+eongpFYFbC+d5cwiHE/YP6uQPmniiEpa3ICZw87Jk/R2\n5dTAVk9QuAlvkI1lWA0+1SDTFxuWD1LTEjcSS6so8pr2VOF6xFu5QKCkbX0/aQe5\npoHryZ/RkUW4d+B3aTC56RnXSAfeegwn1VDF+J+t0jZ0rMzKs2IaDgqX5HzBqOOI\nlIrr43ROHmceuTMZp19aoLYhFNn1lseyug/YQm4b6Hf6VVypNNUFdgbK8xrxowOq\nb2cgSajgcZVMkTF5IQuyS/IIlobJGZeqZ33nABEBAAEAB/4zgTuBlWtv8h9022A+\nsECI9aGddeM/3wVo77QfjF7Px+Cu4xlG/3KYea263qfs/PCOTua+j+4LL/rcUw4n\n2vQlTHu2WjMXfoFZxhMg0uZA7IVJkfyUUcayvINu4byLzLFxs+yO/dNLkF8bm6mG\nMG4OfWYgIyuS5gs3CdyBb9nLM/Av2vszE5vSMWzkylSkB8uo4oU3yRNxHC2iyye0\nlbhX1xLjr8RJkPTcMi7tc4zO2cJUhMvb5GI1vHCVdUJyREaWOZrC/6LW75hgvldP\nsP56dWdMQ65HxShBYNx2i6iblYIgfpah/R1bZfHmPvcG4fUxRtH40CqAqAaoyB3Q\nEcsBBADB28BDBmICC+neLgJ8YntvG3oul0zNRJVfi+O7XzCQzO/E3Pw4/vKpI2M7\nro51Sr+v4jOzZbs0itsAk10oejtO8fRRVpqSb+6CineskBP62l47TDh8A4yrskBt\nCGoOyyIVfem4G3d9JPjOFouaQjlwUD2Fiu2CavqiGA/5hRfaxwQAwk99+Iv/0Erb\nnYB7FcZV5rSPjGYIgr1JdZSZJP8hgNZEmEYo+Qab2PYFWKRW+1yxnt7A2HWEJPDf\nUH0iMy0CdQXRIT9/+y0sEBU1ET9kcI0As+LkrGzE2iMtvufXnhs+z+iUHww52hW0\nbY6Qh2gpSQwB+cVRz5+LeV9RlxdBI+ED/AyjC59SV5b/UlMAfrA+kUIWyoX5SuB2\nVBkvyDcJtSbpXtFtVvSO+bko6gq/0b9pd0RDspeOEoJ2JvPeNEyqNhoghrwAu4mJ\nOMU8FzbPoPeW6Tp2sWCN4WPBP3i6wKNftS/D7XEGOtpQj4pnWArWSk4KN9iC9bgl\n8m25asqaNihwRqG0aVRlc3QgS2V5IFdoZW4gTWVzc2FnZSBXcm9uZ2x5IGVuY3J5\ncHRlZCBmb3IgUHJpbWFyeSBLZXkgPHRlc3QuZmlsZS5lbmNyeXB0ZWQuZm9yLnBy\naW1hcnkua2V5QGV4YW1wbGUuY29tPokBTgQTAQoAOAULCQgHAgYVCgkICwIEFgID\nAQIeAQIXgBYhBL+zmJKJcURh2km3GfkMdq5hGv3uBQJfjVWYAhsDAAoJEPkMdq5h\nGv3uNY4H/jjic/McuUDaU1YMJdqJsb8AMU6j+XAw/agKu/d4BvQqeGhJvQAh7Ufo\n+2ikyPbQ51+s5AvlxW3DQ1tA0F56Si5B7ilVYwocQ55fC5TtvmcyouRujttoPqQN\nmrDvUYHwip7IBm6ITmn5yOmL9i27bAt1MgETD2Qrpn404mGkvwBCM1oPLK0QhkuX\niRqDTjm+B91Fx86EeS801UR9XChX6MqP0oNe9vVBCFzmsCPu+IYzz2NOuOHbVZ62\nBWflsoElEFiMaEx2J1gkwMAU0dTQg2KTD8M0gJG5HgmrYOPY1+q7CGzy53nGq6Wl\nzOvDRUClvpjBGcpUKDDIH/KQjzSEDRCdA5gEX4gvbQEIANUO63F2tdT4zOt8gP2X\nBZwo8fbI59AEEgBaq7o3sluujAak3mK71LyT4S4gvJLyGlAU9TV4JQxRuky6oCcy\nA1D6PNCYGiR6OJbmmzosrh34bYkfz3xjDu/dNAKPDCJz2arcVuVbE5onjQd9afja\nZh+4pVKs3lKn1UdBXIrei2LC98CemRWxUwfHG0LswvnIg24ByvFBvOzBiB7m9340\nComMnKGRpeze8uEubYNNQDexL2zCo2itUFKBuPkQbCN7jXg/vnNLk2GXFlUYt20p\nuEH4iyaJ/QFIZzzeqFRQWvI63JJ7zQZIGeokS/0MLq1udNYxUqk014TEso0jvC1e\nvX0AEQEAAQAH/jxozI0RUaEfIksqtBAy/941JdYJROEQJmJ/Uu2r2SBxrzY7DOsF\nwt3tOA2yLoWjq55FMvmEJU0G50HWMI6seZA+Q3wJhHAPT3hJzn2CKaRJyhT1NglY\ntOWB3LtU/+XM30y4yNKjLj2pNS2Ie8GZexdHbWixpx/cgnZ/q9OcIf1QMaUt3pda\ngeRaMT+H/CQNG0q000+2xpQBjEDfXGRJsMTlYZROoHV7HzBW4IxdeolDU/gjdGeB\nhC+O8BTpuMCb7qq5UXckeXII+4DzqCkDePdqkBmDkns+2L1WV2xNVyT0Xu2r7ZCm\nGGeparwuxttmdgrLfiRbDyHeYXZbVPZ2C2kEANWwabDtkuQ1+5Rs9GWD21JaX0Go\n69lUhZVWVSrdfbCXKFjZySiilzvv5W+GRhfmm5Tzv3UgfKEIU7wbRYlCZ+yhmNWC\n6fy0xMjOGskpNZvfSmYqDA8MgExluHapaEO/QOivhkdGmIRhHV0bIJU5fN56XvbZ\nwtDPw2dwLsmuXBh7BAD/PofmvBD4N5quBVFXCkkCWTS8Ma9vHXQufHjRgnUXCeuZ\n6sX4s3UyQIc5LxCYj0ZNFQdObHqyovESY0O9n0wDRzxpsLu8VXF8bKJ+JA02Yj7x\n7bM+5bEK8ILYmw2EFjCJsdG9rK25OG93QCHywGL6VUxFKdUBbnmEzNH2r+dsZwQA\n+aYSgMASH2uxWuK33rFDL+NFZC3tpaRCcm2t17ssRAGJ/xQdG+HrPREJTSCtA+xd\niF//rFnucl4apc2HE6s2CK/Oparov1+NWzd5MATtXAA5Cu04UBN16Em4/yFf+jY7\nqwJD8NwELoDH5p11ymK4/Z+5N4/uFBEGMG4EkQEnUbQ2VYkBNgQYAQoAIBYhBL+z\nmJKJcURh2km3GfkMdq5hGv3uBQJfiC9tAhsMAAoJEPkMdq5hGv3usZ4H/1N12NiL\nOVwQ3ZeqVxUocwC/UjZX6JlAPg0h1Spx0RGdNuu4WMLnlF/1yzK+LE84WFYkvXXI\nzNi1LIyXPh3YCPGFEec82MkLQFkLm7sjE4Xc3APYZJK2s5LSjyloZkprb7sbVjdW\noBwAPClvQsgAlHBeCrlWcLo7fzZdxmpvmJFHd/J7ajKsMCn5f9DXFCoCNdrv+s5Q\nf4jo6KaEhZrQ75+T52Iq9R5Z2gS5G4jY3eW+iK2/xW5Q0x0UeoJG7u8WR56LSl0j\nS9lufuOSyFkO3XIWLzDfz51EVy7ApK33D3GQTfOQ8tJEqW2p17rQTcXuhmg4Dgcf\n1b0dyVac7jV1Tgs=\n=4Jfy\n-----END PGP PRIVATE KEY BLOCK-----\n`;
      const tmpPrv = await KeyUtil.parse(prvEncryptForSubkeyOnly);
      await KeyUtil.encrypt(tmpPrv, passphrase);
      expect(tmpPrv.fullyEncrypted).to.equal(true);
      const prvEncryptForSubkeyOnlyProtected = KeyUtil.armor(tmpPrv);
      // const pubEncryptForSubkeyOnly = `-----BEGIN PGP PUBLIC KEY BLOCK-----\n\nmQENBF+IL20BCACTJLnno0xB29YeNP9xV4bdkEE0zSo/UoFzRKpUupG+0El17oDw\nQDUeW2YjZwLxMJVlRyo+eongpFYFbC+d5cwiHE/YP6uQPmniiEpa3ICZw87Jk/R2\n5dTAVk9QuAlvkI1lWA0+1SDTFxuWD1LTEjcSS6so8pr2VOF6xFu5QKCkbX0/aQe5\npoHryZ/RkUW4d+B3aTC56RnXSAfeegwn1VDF+J+t0jZ0rMzKs2IaDgqX5HzBqOOI\nlIrr43ROHmceuTMZp19aoLYhFNn1lseyug/YQm4b6Hf6VVypNNUFdgbK8xrxowOq\nb2cgSajgcZVMkTF5IQuyS/IIlobJGZeqZ33nABEBAAG0aVRlc3QgS2V5IFdoZW4g\nTWVzc2FnZSBXcm9uZ2x5IGVuY3J5cHRlZCBmb3IgUHJpbWFyeSBLZXkgPHRlc3Qu\nZmlsZS5lbmNyeXB0ZWQuZm9yLnByaW1hcnkua2V5QGV4YW1wbGUuY29tPokBTgQT\nAQoAOAULCQgHAgYVCgkICwIEFgIDAQIeAQIXgBYhBL+zmJKJcURh2km3GfkMdq5h\nGv3uBQJfjVWYAhsDAAoJEPkMdq5hGv3uNY4H/jjic/McuUDaU1YMJdqJsb8AMU6j\n+XAw/agKu/d4BvQqeGhJvQAh7Ufo+2ikyPbQ51+s5AvlxW3DQ1tA0F56Si5B7ilV\nYwocQ55fC5TtvmcyouRujttoPqQNmrDvUYHwip7IBm6ITmn5yOmL9i27bAt1MgET\nD2Qrpn404mGkvwBCM1oPLK0QhkuXiRqDTjm+B91Fx86EeS801UR9XChX6MqP0oNe\n9vVBCFzmsCPu+IYzz2NOuOHbVZ62BWflsoElEFiMaEx2J1gkwMAU0dTQg2KTD8M0\ngJG5HgmrYOPY1+q7CGzy53nGq6WlzOvDRUClvpjBGcpUKDDIH/KQjzSEDRC5AQ0E\nX4gvbQEIANUO63F2tdT4zOt8gP2XBZwo8fbI59AEEgBaq7o3sluujAak3mK71LyT\n4S4gvJLyGlAU9TV4JQxRuky6oCcyA1D6PNCYGiR6OJbmmzosrh34bYkfz3xjDu/d\nNAKPDCJz2arcVuVbE5onjQd9afjaZh+4pVKs3lKn1UdBXIrei2LC98CemRWxUwfH\nG0LswvnIg24ByvFBvOzBiB7m9340ComMnKGRpeze8uEubYNNQDexL2zCo2itUFKB\nuPkQbCN7jXg/vnNLk2GXFlUYt20puEH4iyaJ/QFIZzzeqFRQWvI63JJ7zQZIGeok\nS/0MLq1udNYxUqk014TEso0jvC1evX0AEQEAAYkBNgQYAQoAIBYhBL+zmJKJcURh\n2km3GfkMdq5hGv3uBQJfiC9tAhsMAAoJEPkMdq5hGv3usZ4H/1N12NiLOVwQ3Zeq\nVxUocwC/UjZX6JlAPg0h1Spx0RGdNuu4WMLnlF/1yzK+LE84WFYkvXXIzNi1LIyX\nPh3YCPGFEec82MkLQFkLm7sjE4Xc3APYZJK2s5LSjyloZkprb7sbVjdWoBwAPClv\nQsgAlHBeCrlWcLo7fzZdxmpvmJFHd/J7ajKsMCn5f9DXFCoCNdrv+s5Qf4jo6KaE\nhZrQ75+T52Iq9R5Z2gS5G4jY3eW+iK2/xW5Q0x0UeoJG7u8WR56LSl0jS9lufuOS\nyFkO3XIWLzDfz51EVy7ApK33D3GQTfOQ8tJEqW2p17rQTcXuhmg4Dgcf1b0dyVac\n7jV1Tgs=\n=APwK\n-----END PGP PUBLIC KEY BLOCK-----\n`;
      // public key that allows to encrypt for primary key - to simulate a bug in other implementation that wrongly encrypts for primary when it shouldn't
      // sec  rsa2048/F90C76AE611AFDEE
      //      created: 2020-10-15  expires: never       usage: SCE
      //      trust: ultimate      validity: ultimate
      // ssb  rsa2048/4BA880ECE71397FC
      //      created: 2020-10-15  expires: never       usage: E
      // const prvEncryptForPrimaryIsFine = `-----BEGIN PGP PRIVATE KEY BLOCK-----\n\n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\n1b0dyVac7jV1Tgs=\n=s/pD\n-----END PGP PRIVATE KEY BLOCK-----`;
      const pubEncryptForPrimaryIsFine = `-----BEGIN PGP PUBLIC KEY BLOCK-----\n\nmQENBF+IL20BCACTJLnno0xB29YeNP9xV4bdkEE0zSo/UoFzRKpUupG+0El17oDw\nQDUeW2YjZwLxMJVlRyo+eongpFYFbC+d5cwiHE/YP6uQPmniiEpa3ICZw87Jk/R2\n5dTAVk9QuAlvkI1lWA0+1SDTFxuWD1LTEjcSS6so8pr2VOF6xFu5QKCkbX0/aQe5\npoHryZ/RkUW4d+B3aTC56RnXSAfeegwn1VDF+J+t0jZ0rMzKs2IaDgqX5HzBqOOI\nlIrr43ROHmceuTMZp19aoLYhFNn1lseyug/YQm4b6Hf6VVypNNUFdgbK8xrxowOq\nb2cgSajgcZVMkTF5IQuyS/IIlobJGZeqZ33nABEBAAG0aVRlc3QgS2V5IFdoZW4g\nTWVzc2FnZSBXcm9uZ2x5IGVuY3J5cHRlZCBmb3IgUHJpbWFyeSBLZXkgPHRlc3Qu\nZmlsZS5lbmNyeXB0ZWQuZm9yLnByaW1hcnkua2V5QGV4YW1wbGUuY29tPokBTgQT\nAQoAOAULCQgHAgYVCgkICwIEFgIDAQIeAQIXgBYhBL+zmJKJcURh2km3GfkMdq5h\nGv3uBQJfjVbfAhsPAAoJEPkMdq5hGv3uqCEH/3gbq7JwKQf0NV0muZysc0aNt000\nG3NtZkuYi83l8JMwlDq50lOMgL7gCngTB9ed822d27ClMsj8eP9XuKtw6e7gpvMc\njMF2rACiQKYuZ0iVUK23Zi0fb17zN0BJ0gJ9BpEv5MjaYJ1G4QZDOKG23a/hVUUv\nfRmwbBynSFMgVWQJHGQ9KcY2Jt8M3sLcxpuPO3QLWGivitbZDB2QrL/fALRQpc1Y\nnNkgdUxpZE5dkos01IR5GjZeSmrYpP7UaHa/O3lCdLiskjtCNwWcTr1yJZdzmbZ4\npw6Hu+kEIiYgmwPNodJpRYxZ8rR6ChJ4q1SE6J3iJ4SlGVdU0TM4L5nuJxy5AQ0E\nX4gvbQEIANUO63F2tdT4zOt8gP2XBZwo8fbI59AEEgBaq7o3sluujAak3mK71LyT\n4S4gvJLyGlAU9TV4JQxRuky6oCcyA1D6PNCYGiR6OJbmmzosrh34bYkfz3xjDu/d\nNAKPDCJz2arcVuVbE5onjQd9afjaZh+4pVKs3lKn1UdBXIrei2LC98CemRWxUwfH\nG0LswvnIg24ByvFBvOzBiB7m9340ComMnKGRpeze8uEubYNNQDexL2zCo2itUFKB\nuPkQbCN7jXg/vnNLk2GXFlUYt20puEH4iyaJ/QFIZzzeqFRQWvI63JJ7zQZIGeok\nS/0MLq1udNYxUqk014TEso0jvC1evX0AEQEAAYkBNgQYAQoAIBYhBL+zmJKJcURh\n2km3GfkMdq5hGv3uBQJfiC9tAhsMAAoJEPkMdq5hGv3usZ4H/1N12NiLOVwQ3Zeq\nVxUocwC/UjZX6JlAPg0h1Spx0RGdNuu4WMLnlF/1yzK+LE84WFYkvXXIzNi1LIyX\nPh3YCPGFEec82MkLQFkLm7sjE4Xc3APYZJK2s5LSjyloZkprb7sbVjdWoBwAPClv\nQsgAlHBeCrlWcLo7fzZdxmpvmJFHd/J7ajKsMCn5f9DXFCoCNdrv+s5Qf4jo6KaE\nhZrQ75+T52Iq9R5Z2gS5G4jY3eW+iK2/xW5Q0x0UeoJG7u8WR56LSl0jS9lufuOS\nyFkO3XIWLzDfz51EVy7ApK33D3GQTfOQ8tJEqW2p17rQTcXuhmg4Dgcf1b0dyVac\n7jV1Tgs=\n=4gfr\n-----END PGP PUBLIC KEY BLOCK-----\n`;
      const { keys: [tmpPub] } = await opgp.key.readArmored(pubEncryptForPrimaryIsFine);
      tmpPub.subKeys = [];
      // removed subkey from the pubkey, which makes the structure into this - forcing opgp to encrypt for the primary
      // sec  rsa2048/F90C76AE611AFDEE
      //      created: 2020-10-15  expires: never       usage: SCE
      //      trust: ultimate      validity: ultimate
      const justPrimaryPub = tmpPub.armor();
      const pubkeys = [await KeyUtil.parse(justPrimaryPub)];
      const encrypted = await MsgUtil.encryptMessage({ pubkeys, data, armor: true }) as PgpMsgMethod.EncryptPgpArmorResult;
      const kisWithPp: PrvKeyInfo[] = [{ private: prvEncryptForSubkeyOnlyProtected, longid: 'F90C76AE611AFDEE', passphrase }];
      const decrypted = await MsgUtil.decryptMessage({ kisWithPp, encryptedData: encrypted.data });
      // todo - later we'll have an org rule for ignoring this, and then it will be expected to pass as follows:
      // expect(decrypted.success).to.equal(true);
      // expect(decrypted.content!.toUtfStr()).to.equal(data.toUtfStr());
      expect(decrypted.success).to.equal(false);
      expect((decrypted as DecryptError).error.type).to.equal('key_mismatch');
      t.pass();
    });

  }
};
