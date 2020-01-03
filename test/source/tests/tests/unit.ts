/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import * as ava from 'ava';

import { MsgBlock } from '../../core/msg-block';
import { MsgBlockParser } from '../../core/msg-block-parser';
import { PgpHash } from '../../core/pgp-hash';
import { TestVariant } from '../../util';
import { TestWithBrowser } from '../../test';
import { expect } from 'chai';

// tslint:disable:no-blank-lines-func
/* eslint-disable max-len */

export let defineUnitTests = (testVariant: TestVariant, testWithBrowser: TestWithBrowser) => {

  if (testVariant !== 'CONSUMER-LIVE-GMAIL') {

    ava.default.only(`[unit][MsgBlockParser.detectBlocks] will not run into infinite loop with multiple passwordMsg`, async t => {
      expect(MsgBlockParser.detectBlocks("Office\n---------- Forwarded message ----------\nBlablabla\n\nhttps://flowcrypt.com/IFgvrSVR8b\n\nqwertyuiop\n\n---------- Forwarded message ----------\nblabla2\n\n\n-----BEGIN\nThis message is encrypted: Open Message\n\nAlternatively copy and paste the following link: https://flowcrypt.com/IFgvrSVR8b\n\n")).to.deep.equal({
        "blocks": [
          MsgBlock.fromContent("plainText", "Office\n---------- Forwarded message ----------\nBlablabla\n\nhttps://flowcrypt.com/IFgvrSVR8b\n\nqwertyuiop\n\n---------- Forwarded message ----------\nblabla2"),
          MsgBlock.fromContent("encryptedMsgLink", "IFgvrSVR8b"),
        ],
        "normalized": "Office\n---------- Forwarded message ----------\nBlablabla\n\nhttps://flowcrypt.com/IFgvrSVR8b\n\nqwertyuiop\n\n---------- Forwarded message ----------\nblabla2\n\n\n-----BEGIN\nThis message is encrypted: Open Message\n\nAlternatively copy and paste the following link: https://flowcrypt.com/IFgvrSVR8b\n\n"
      });
      t.pass();
    });

    ava.default(`[unit][MsgBlockParser.detectBlocks] does not get tripped on non-pgp certs`, async t => {
      expect(MsgBlockParser.detectBlocks("This text breaks email and Gmail web app.\n\n-----BEGIN CERTIFICATE-----\n\nEven though it's not a vaild PGP m\n\nMuhahah")).to.deep.equal({
        "blocks": [
          MsgBlock.fromContent("plainText", "This text breaks email and Gmail web app.\n\n-----BEGIN CERTIFICATE-----\n\nEven though it's not a vaild PGP m\n\nMuhahah"),
        ],
        "normalized": "This text breaks email and Gmail web app.\n\n-----BEGIN CERTIFICATE-----\n\nEven though it's not a vaild PGP m\n\nMuhahah"
      });
      t.pass();
    });

    ava.default(`[unit][Pgp.hash.sha1] hello`, async t => {
      expect(await PgpHash.sha1UtfStr("hello")).to.equal("aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d");
      t.pass();
    });

    ava.default(`[unit][Pgp.hash.sha256] hello`, async t => {
      expect(await PgpHash.sha256UtfStr("hello")).to.equal('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
      t.pass();
    });

    ava.default(`[unit][Pgp.hash.doubleSha1Upper] hello`, async t => {
      expect(await PgpHash.doubleSha1Upper("hello")).to.equal("9CF5CAF6C36F5CCCDE8C73FAD8894C958F4983DA");
      t.pass();
    });

    ava.default(`[unit][Pgp.hash.challengeAnswer] hello`, async t => {
      expect(await PgpHash.challengeAnswer("hello")).to.equal('3b2d9ab4b38fe0bc24c1b5f094a45910b9d4539e8963ae8c79c8d76c5fb24978');
      t.pass();
    });

  }
};
