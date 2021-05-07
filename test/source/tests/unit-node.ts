/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import * as ava from 'ava';

import { MsgBlock } from '../core/msg-block';
import { MsgBlockParser } from '../core/msg-block-parser';
import { PgpHash } from '../core/crypto/pgp/pgp-hash';
import { TestVariant } from '../util';
import chai = require('chai');
import chaiAsPromised = require('chai-as-promised');
import { KeyUtil, KeyInfoWithOptionalPp } from '../core/crypto/key';
import { UnreportableError } from '../platform/catch.js';
import { Buf } from '../core/buf';
import { OpenPGPKey } from '../core/crypto/pgp/openpgp-key';
import { DecryptError, DecryptSuccess, MsgUtil, PgpMsgMethod } from '../core/crypto/pgp/msg-util';
import { opgp } from '../core/crypto/pgp/openpgpjs-custom';
import { Attachment } from '../core/attachment.js';
import { ContactStore } from '../platform/store/contact-store.js';
import { GoogleData, GmailParser, GmailMsg } from '../mock/google/google-data';
import { testConstants } from './tooling/consts';
import { PgpArmor } from '../core/crypto/pgp/pgp-armor';
import { equals } from '../buf.js';
import * as forge from 'node-forge';

chai.use(chaiAsPromised);
const expect = chai.expect;
// tslint:disable:no-blank-lines-func
/* eslint-disable max-len */
// tslint:disable:no-unused-expression
/* eslint-disable no-unused-expressions */

export let defineUnitNodeTests = (testVariant: TestVariant) => {

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
          "id" : "1,email-key-manager,evaluation.org,pgp-key-public,ekm%40ekm-org-rules-test.flowcrypt.test",
          "content" : "-----BEGIN PGP PUBLIC KEY BLOCK-----\r\nVersion: FlowCrypt 7.6.9 Gmail Encryption\r\nComment: Seamlessly send and receive encrypted email\r\n\r\nxsBNBF5mRKEBCADX62s0p6mI6yrxB/ui/LqxfG4RcQzZJf8ah52Ynu1n8V7Y\r\n7143LmT3MfCDw1bfHu2k1OK7hT+BOi6sXas1D/fVtjz5WwuoBvwf1DBZ7eq8\r\ntMQbLqQ7m/A8uwrVFOhWfuxulM7RuzIPIgv4HqtKKEugprUd80bPus45+f80\r\nH6ZSgEpmZD6t9JShY6f8pU1OHcnPqFsFF0sLyOk7WcCG5Li3WjkwU/lIu18q\r\nR26oLb5UM8z6vv6JD29GmqCj+OLYaPk8b00kdpGEvTjw3VzGM+tXOgUf2y1T\r\nK9UfhMNkyswxUZw543CMTdw9V0+AzM0q70T/p0fP9nlJCv6M3bQm6D/vABEB\r\nAAHNL0VrbSBVc2VyIDxla21AZWttLW9yZy1ydWxlcy10ZXN0LmZsb3djcnlw\r\ndC5jb20+wsB1BBABCAAfBQJeZkShBgsJBwgDAgQVCAoCAxYCAQIZAQIbAwIe\r\nAQAKCRDESadeBea4P0KvCACD5uOgGxwGEmUWfH8EXPK7npDKulmoZnSWYrfC\r\nX3ctUKXjwPBWRXYid7LChnQAR6SRcyxyD1Eoel5ZVrJyKHqRkxcanFHeqRU1\r\nOyOgtsQyPIGtLipmOgc6i5JYhqbQ4mNu10CGS6ZKhjf6rFIqLl/8f4lnBc28\r\nUqVuP20Ru6KJZTVVQRF28FweMByR/3LyAWfObMwXJ0+uFEV941VEDv5MGdId\r\nfePTP2cHRSJxPqVhpPWtfzYLStUzLFvtLfE45hympok4lZeKfLVtZVVQEgT+\r\nojEImdiZQJ0dT+jeJhmuTjzURQcLapXv2GLBUZaY2zfoAXR31QNYjADOxlrO\r\nutSUzsBNBF5mRKEBCACVNQTzI2Cf1+G3q38OtXO89tuBI/a5TjcHh/sFIJB6\r\nPPuEg/uW+EsjkgI3yk+UZZd6iYohO2mJcJ7MnaFHOu7tmOEaaHSiYsA0RTnV\r\nqUBlbHbsl2oSlQJ/mjJ4cWq5ateuLHhx2RV0t1bm2anHJnqKGkqYqXA72m5g\r\nrLzRSJ9M43wQRheGWGNoNdg4kPxU+PjYwfk2ARX5SCUKoG0qp0RhRMplX74u\r\nYi+Ek/9qSyZevmhK55sXIUNwLsuEhejlr0iucOt2vcIybQ9EbMXz62yYMRjY\r\ngy4SxW5aQJxXFeWkSo6wzMqQ1ZiSArRCezBk+mftxNrmwmtCcJajQt2uAQQV\r\nABEBAAHCwF8EGAEIAAkFAl5mRKECGwwACgkQxEmnXgXmuD/7VAf+IMJMoADc\r\ndWNhn45AvkwbzSmYt4i2aRGe+qojswwYzvFBFZtyZ/FKV2+LHfKUBI18FRmH\r\nmKEba1UUetflytxiAwZxSJSf7Yz/NDiWaVn0eOLopmFMiPb02a5i3CjbLsDe\r\nex2y/69R0+fQc+rE3HZ04C8H/YAqFV0VOv3L+2EztOGK7KOZOx4toR05oDqb\r\nZbiDzwhsa2MugHLPLZuGl3eGk+n/EcINhopHg+HU8MHQE6rADvrok6QiYVhp\r\nGqi8ksD3kBAk43hGRSD2m/WDPWa/h2sh5rVswTKUDtv1fd1H6Ff5FnK21LHj\r\nEk0f+P9DgunMb5OtkDwm6WWxpzV150LJcA==\r\n=Hcoc\r\n-----END PGP PUBLIC KEY BLOCK-----\r\n"
        }, {
          "id" : "1,email-key-manager,evaluation.org,pgp-key-fingerprint,C05803F40E0B9FE4FE9B4822C449A75E05E6B83F",
          "content" : "1,email-key-manager,evaluation.org,pgp-key-private,106988520142055188323\n1,email-key-manager,evaluation.org,pgp-key-public,ekm%40ekm-org-rules-test.flowcrypt.test"
        } ]
      }`;
      const { blocks, normalized } = MsgBlockParser.detectBlocks(input);
      expect(normalized).to.equal(input);
      expect(blocks).to.have.property('length').that.equals(1);
      expect(blocks[0]).to.deep.equal(MsgBlock.fromContent("plainText", input));
      t.pass();
    });

    ava.default(`[unit][MsgBlockParser.detectBlocks] replaces intended blocks`, async t => {
      const prv = `-----BEGIN PGP PRIVATE KEY BLOCK-----\r\nVersion: FlowCrypt 7.6.9 Gmail Encryption\r\nComment: Seamlessly send and receive encrypted email\r\n\r\nxcLYBF5mRKEBCADX62s0p6mI6yrxB/ui/LqxfG4RcQzZJf8ah52Ynu1n8V7Y\r\n7143LmT3MfCDw1bfHu2k1OK7hT+BOi6sXas1D/fVtjz5WwuoBvwf1DBZ7eq8\r\ntMQbLqQ7m/A8uwrVFOhWfuxulM7RuzIPIgv4HqtKKEugprUd80bPus45+f80\r\nH6ZSgEpmZD6t9JShY6f8pU1OHcnPqFsFF0sLyOk7WcCG5Li3WjkwU/lIu18q\r\nR26oLb5UM8z6vv6JD29GmqCj+OLYaPk8b00kdpGEvTjw3VzGM+tXOgUf2y1T\r\nK9UfhMNkyswxUZw543CMTdw9V0+AzM0q70T/p0fP9nlJCv6M3bQm6D/vABEB\r\nAAEAB/sG3UWhvWjO4QcS9ZmC43z98oI/TLRHXQVgrwoMFZVflhVZWTbKE1AD\r\nadOHJNkoq7+LW3c/1esgbRyZvzqXq8PJyArlNIdI1rwCOQk2erFZQXfwk0mG\r\nWZ1IGPwtrQX75foXQ+TVVxmu0HrH7xWr/F73IwWkB51rMjmnLzL1UcJEYh/I\r\nVS5a4+KhCHf4k7GNewLdTd74ERNfL/BPRS2vye4oxJCr9Qx2nwB9a8WMk7X4\r\nIYIH0zpo5/Eu5nXUZyZ2D/72UlOmsox376J8B4lkoRMQPmIvfLBqyX4w7EG6\r\ngwBF+gib/hyHm8aAgkwPs931CDDJNf0wq17dqbDN0Uk8q1SRBADtHbjT2Utl\r\ns6R0g8BRakCh4FT1t/fvlFXO14T0O28vfGroWtbd0q/2XJF1WcRU9NXdo2DG\r\n3z5dQJzKz/nb8G9/LDpWcuBfYWXT3YZVOSiIUSp9SwYGTHIXCxqYev+ALc1b\r\nO3PYpbYgadnPeu/7qRTIzN9Wrnplp5PO7RcBGGWY/wQA6R2L8IEz1wZuiUqd\r\nFsb7Rzpe2bp4sQNsCdaX69Ci0fHsIOltku52K4A1hEqCaPZBGh7gnYGYSx2w\r\nF3UklJxaaxh3EjaxJT0R6+fHpkdhjnsKIgyhjwnuZSHQYINah00jupIZRjn7\r\n67XnOKKnWajodAojfgsdZqAbZ/WHSq8X6RED/i5Q4xaoa72VT3hMTYRkR6R9\r\nhBVjmR6NsUq9cIZoV6txFbpijj79qzrlY7yAl1NA7bkuHxvE+uHVBqFtBo2I\r\n3f9cINbCWWdgsAvNtYEwUnpgzDoL5UF0TCZvtmF2r0R7zVniuDTeKyEoUZYF\r\nJA1o6k3hnwCQDFLfWchcVPIra2pVPZrNL0VrbSBVc2VyIDxla21AZWttLW9y\r\nZy1ydWxlcy10ZXN0LmZsb3djcnlwdC5jb20+wsB1BBABCAAfBQJeZkShBgsJ\r\nBwgDAgQVCAoCAxYCAQIZAQIbAwIeAQAKCRDESadeBea4P0KvCACD5uOgGxwG\r\nEmUWfH8EXPK7npDKulmoZnSWYrfCX3ctUKXjwPBWRXYid7LChnQAR6SRcyxy\r\nD1Eoel5ZVrJyKHqRkxcanFHeqRU1OyOgtsQyPIGtLipmOgc6i5JYhqbQ4mNu\r\n10CGS6ZKhjf6rFIqLl/8f4lnBc28UqVuP20Ru6KJZTVVQRF28FweMByR/3Ly\r\nAWfObMwXJ0+uFEV941VEDv5MGdIdfePTP2cHRSJxPqVhpPWtfzYLStUzLFvt\r\nLfE45hympok4lZeKfLVtZVVQEgT+ojEImdiZQJ0dT+jeJhmuTjzURQcLapXv\r\n2GLBUZaY2zfoAXR31QNYjADOxlrOutSUx8LYBF5mRKEBCACVNQTzI2Cf1+G3\r\nq38OtXO89tuBI/a5TjcHh/sFIJB6PPuEg/uW+EsjkgI3yk+UZZd6iYohO2mJ\r\ncJ7MnaFHOu7tmOEaaHSiYsA0RTnVqUBlbHbsl2oSlQJ/mjJ4cWq5ateuLHhx\r\n2RV0t1bm2anHJnqKGkqYqXA72m5grLzRSJ9M43wQRheGWGNoNdg4kPxU+PjY\r\nwfk2ARX5SCUKoG0qp0RhRMplX74uYi+Ek/9qSyZevmhK55sXIUNwLsuEhejl\r\nr0iucOt2vcIybQ9EbMXz62yYMRjYgy4SxW5aQJxXFeWkSo6wzMqQ1ZiSArRC\r\nezBk+mftxNrmwmtCcJajQt2uAQQVABEBAAEAB/sFz/fuZM1pzKYdWo/ricQF\r\nc3RfloAQ/ewE3hY4P+mA6Yk+w0l0ux1qOFDfzYDGHiMFggAghUj6Mqns/KMA\r\nvFn8ZX03YyRQAxrLrnqvSRWaHdyQIOHf8XAUenRG3twydugJ/+99N+CvGElJ\r\nWudTO7uAT7/iLI+TtVGhcHk2ieayvwaleWfQd9eVw37xi58hMWV/NSBOIZhW\r\n2Lv/aldPr8ld8vlWYN4xbTCLF45FoetBrGjDkXb3BCELHSj/ot7I+wZ1uGIF\r\n33wh8Q0EWFgqQtMBnyL6m/XO0U1sOrJADVGQsOQ1/5+3AnpUJOHnP9rnhy8A\r\n2glYg3+2sRRupRG4n/6NBADJKA4RsHwvOeRx1pnuOD8B2fP0r5qJ4gi+tsRq\r\nIXOY1dpPbhzo4AAn+RVwo6JC3aUWtt2yUsJ9eTyWG432LkM9eUwL4Z//ymXf\r\nVFIfl4ySyEvbSujNfreEYM7FUr7kxpBfGE1c86J+AX6MZpfw9hIGs+8IHr/j\r\ngoZe8+CD+1xBuwQAveMZgrB+CoGjQMaVa6/GoWagV20KjHKXDhI/Aogjnu/B\r\nlwHemh1pJucI5kvnq+SaupFO8dgDt+bhwJxsH6d/Wj/J80+TR7pvYFSkk3LV\r\nP3IGRUy7U11LKEqno5n9/4/EuXvV/lixalIGNOGgpnoHgwPIkT9AYGxOlF21\r\n8T4nTG8D/R/URs9vxc9nmTDm9ykw0cHDMmSqLl1a5Dzl2VpQitFBgmaCEo5L\r\ne+QN/nX0KWMFttKXo++N/sU988sOhxQyEzeTq6B+9YJVnaaxAZByDRzrMgG+\r\nq/5XGxzbwsCta5NxE3iY9CWDrPm20KUkBF3ZKoDrlV0Uck6wX+XLipoDc4AX\r\nRfHCwF8EGAEIAAkFAl5mRKECGwwACgkQxEmnXgXmuD/7VAf+IMJMoADcdWNh\r\nn45AvkwbzSmYt4i2aRGe+qojswwYzvFBFZtyZ/FKV2+LHfKUBI18FRmHmKEb\r\na1UUetflytxiAwZxSJSf7Yz/NDiWaVn0eOLopmFMiPb02a5i3CjbLsDeex2y\r\n/69R0+fQc+rE3HZ04C8H/YAqFV0VOv3L+2EztOGK7KOZOx4toR05oDqbZbiD\r\nzwhsa2MugHLPLZuGl3eGk+n/EcINhopHg+HU8MHQE6rADvrok6QiYVhpGqi8\r\nksD3kBAk43hGRSD2m/WDPWa/h2sh5rVswTKUDtv1fd1H6Ff5FnK21LHjEk0f\r\n+P9DgunMb5OtkDwm6WWxpzV150LJcA==\r\n=FAco\r\n-----END PGP PRIVATE KEY BLOCK-----`;
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

    ava.default(`[unit][PgpKey.usableForEncryptionButExpired] recognizes usable expired key`, async t => {
      const armored = "-----BEGIN PGP PRIVATE KEY BLOCK-----\nVersion: FlowCrypt 7.0.1 Gmail Encryption\nComment: Seamlessly send and receive encrypted email\n\nxcTGBF1ucG0BDACuiQEGA1E4SDwqzy9p5acu6BORl51/6y1LpY63mmlkKpS9\n+v12GPzu2d5/YiFmwoXHd4Bz6GPsAGe+j0a4X5m7u9yFjnoODoXkR7XLrisd\nftf+gSkaQc9J4D/JHlAlqXFp+2OC6C25xmo7SFqiL+743gvAFE4AVSAMWW0b\nFHQlvbYSLcOdIr7s+jmnLhcAkC2GQZ5kcy0x44T77hWp3QpsB8ReZq9LgiaD\npcaaaxC+gLQrmlvUAL61TE0clm2/SWiZ2DpDT4PCLZXdBnUJ1/ofWC59YZzQ\nY7JcIs2Pt1BLEU3j3+NT9kuTcsBDA8mqQnhitqoKrs7n0JX7lzlstLEHUbjT\nWy7gogjisXExGEmu4ebGq65iJd+6z52Ir//vQnHEvT4S9L+XbnH6X0X1eD3Q\nMprgCeBSr307x2je2eqClHlngCLEqapoYhRnjbAQYaSkmJ0fi/eZB++62mBy\nZn9N018mc7o8yCHuC81E8axg/6ryrxN5+/cIs8plr1NWqDcAEQEAAf4HAwLO\nbzM6RH+nqv/unflTOVA4znH5G/CaobPIG4zSQ6JS9xRnulL3q/3Lw59wLp4R\nZWfRaC9XgSwDomdmD1nJAOTE6Lpg73DM6KazRmalwifZgxmA2rQAhMr2JY3r\nLC+mG1GySmD83JjjLAxztEnONAZNwI+zSLMmGixF1+fEvDcnC1+cMkI0trq4\n2MsSDZHjMDHBupD1Bh04UDKySHIKZGfjWHU+IEVi3MI0QJX/nfsPg/KJumoA\nG2Ru4RSIBfX3w2X9tdbyK8qwqKTUUv64uR+R7mTtgAZ+y3RIAr0Ver/We9r9\n6PlDUkwboI8D5gOVU17iLuuJSWP/JBqemjkkbU57SR+YVj7TZfVbkiflvVt0\nAS4t+Uv1FcL+yXmL/zxuzAYexbflOB8Oh/M88APJVvliOIEynmHfvONtOdxE\njN1joUol/UkKJNUwC+fufsn7UZQxlsdef8RwuRRqQlbFLqMjyeK9s99sRIRT\nCyEUhUVKh3OBGb5NWBOWmAF7d95QmtT0kX/0aLMgzBqs75apS4l060OoIbqr\nGuaui4gLJHVFzv/795pN13sI9ZQFN30Z+m1NxtDZsgEX4F2W6WrZ/Guzv+QZ\nEBvE2Bgs0QYuzzT/ygFFCXd4o2nYDXJKzPiFQdYVFZXLjQkS6/CK059rqAyD\nMgobSMOw5L1rRnjVkr0UpyGc98aiISiaXb+/CrSiyVt4g6hVHQ1W5hWRm+xL\n3x2A9jv7+6WAVA6wI2gUQ5vM7ZIhI/MVXOdU09F5GH1M6McS9SLC/5b1LS0L\ng6rolH5/JqgU/vGbboc9DdOBmR1W76oFZby0aqLiptN7GSgtHGz5r4y42kC/\nEHwQs6I2XNPzGqIJbBUo9BE3D8DJm0pqj4tVp4siPXle5kxoUhJ3e24BHnv5\nK5W0L4jlRjsBKnVv5nzHyU9XYfGTXqpnUa1dYwbOQ522KhlixNsBFMuar0no\n/bJRFhxVAJ0nfngZa+yJvcWjAD+Iaq9clJnowLa8pZNt/aRKM1eW1S5f+6rB\nv3hVccYcUaiBAJ0JFX5URDEreCb4vNcuBHcXd/5zStTMrh9aWEnr7f9SMA5D\nt5hGNwmKFmsR4CppeQ5wfJMrVI7dpRT5a/W1ZCEhYMJkRpVRQWdVbxlgc+/o\nnc/pFSQpvvcrdY4VARiIW31v8RxZsweLYzvpyoe5vxZxLe4wpfVgoObDISR/\ngf7mENhBYaUjvzOSJROp4wnZgsGUyKRcFS+Fusod22WYEiBP4woQBmCA0KMB\nRsme0XvX30ME1pcVLUfelXFBy+Fkh2eJA8XePcc65/zsSYM1zyCRYcyBOqXl\nVbgmC7CT1OIyi5WcmNmE3le32AyWhc0mTWljaGFlbCA8bWljaGFlbC5mbG93\nY3J5cHQyQGdtYWlsLmNvbT7CwSsEEwEIAD4CGwMFCwkIBwIGFQoJCAsCBBYC\nAwECHgECF4AWIQSt71SyyjyBMojzR8ChBwCUDtu4ZQUCXW5w3wUJAAFR8gAh\nCRChBwCUDtu4ZRYhBK3vVLLKPIEyiPNHwKEHAJQO27hl5ggL/RYvyfblxqdf\nU7KOaBMkRiUkZunGeB7sTipHKh7me+80kAkn1nVe2DBhuFw03UEk3s5kW80h\nITH5Nl2J9kkidQ39s8W4N9ZDLW0ccQ6HBqxF5moxESMahTIX2qVDSeDi61fm\nHzHILg1F3IEidE1UQI8+oW5H2d/J33CORDXRK3dndH0GdmMjsOhSNMEJ8zuM\ntvgAoy+2zVf70apmDTA/svY6nMMQ/5ZGSmoRScH1CfbuXum20ExOaAPp0FWT\ndPIkoA9mH/FgENcrQ6E44ZPV3wvnqFVWCFrOnNGqtNIaa1EdakGsy5FMwRvh\nyedrMJzXlCiziYp/DpwZ6742O/WNvPTJaDfjQ+1Hhm/FnJVK1MF/O+yO4UgI\nPdGMSgWo389wdhZl4dmOTrAVi3xePb3gYtIYRQjzdl+TdNnm+4Ccj01fptKk\n9I6jKozYaYvWMrFhE6tB+V+aifkfyPd5DJigb5sX5tSKGY8iA4b4JCZXzlnO\nhjaFtE0vFT/Fg8zdPnhgWcfExgRdbnBtAQwA02yK9sosJjiV7sdx374xidZu\nnMRfp0Dp8xsSZdALGLS1rnjZfGzNgNA4s/uQt5MZt7Zx6m7MU0XgADIjGox3\naalhmucH6hUXYEJfvM/UiuD/Ow7/UzzJe6UfVlS6p1iKGlrvwf7LBtM2PDH0\nzmPn4NU7QSHBa+i+Cm8fnhq/OBdI3vb0AHjtn401PDn7vUL6Uypuy+NFK9IM\nUOKVmLKrIukGaCj0jUmb10fc1hjoT7Ful/DPy33RRjw3hV06xCCYspeSJcIu\n78EGtrbG0kRVtbaeE2IjdAfx224h6fvy0WkIpUa2MbWLD6NtWiI00b2MbCBK\n8XyyODx4/QY8Aw0q7lXQcapdkeqHwFXvu3exZmh+lRmP1JaxHdEF/qhPwCv9\ntEohhWs1JAGTOqsFZymxvcQ6vrTp+KdSLsvgj5Z+3EvFWhcBvX76Iwz5T78w\nzxtihuXxMGBPsYuoVf+i4tfq+Uy8F5HFtyfE8aL62bF2ped+rYLp50oBF7NN\nyYEVnRNzABEBAAH+BwMCV+eL972MM+b/giD+MUqD5NIH699wSEZswSo3xwIf\nXy3SNDABAijZ/Z1rkagGyo41/icF/CUllCPU5S1yv5DnFCkjcXNDDv8ZbxIN\nHw53SuPNMPolnHE7bhytwKRIulNOpaIxp6eQN+q+dXrRw0TRbp2fKtlsPHsE\nCnw1kei8UD/mKXd+HjuuK+TEgEN0GB0/cjRZ2tKg+fez+SSmeOExu9AoNJKK\nxizKw4pcQAaGM/DMPzcIDd/2IyZKJtmiH6wG3KdF9LHDmUnykHlkbKf7MsAR\nMCzn9hB3OhiP6dNNRz0AI1qNfPcRvB8DcNXfFKj6MUZxGkxGJGZ3GBhtq1Zr\nH/wSjow+8ijm/C5lbd6byog54qaq2YfjTed8IGcvvdo5sfb5rLZEicKlir6I\n2wUUKgLambmc3FXHVJ/7RSSnlyia92ffWyBIohnq8YFDz9iPHHqVLAvfqWi0\nu9EynfsoIsynVkreC2GUobHNaN3h6N+ObsEZhnmfjmokCiTd5x2oHZMzIpQP\nKTmTHH7v3/UTSVJSwmgoL3kDYjWI/ECGJrqXfFXCTpKbrHzdvQz/Ust4NBAS\n1YcrxOBeY2qKzGnv47WppXJaO6SetMMzkHWzYn3V2ebtug0RQeKbBzWUjlqU\nInl5R3GzkDVzEDfmcm9sCbz6y/QFwMU9gqtd75rsPXm5Rhnz62sDMhMb4XlE\n2EKY+aMDdQvxkESj2aZ75cJv2VMqDFDv/X+sqSLk0zVTce6ancPAzjVpTV5O\nN44Tn7pQPFNWSdGgAOpZDWZo7bgQQm/oBFQeW/tzpcMeGv/v8WxaztPsNpDS\nq6AublbT5i+wx+X+gD5m5wvRnlCzaVNoZOaSdE0EB72wE/yofWBGkv1U0oaY\nqD9kg4x7U3xuALLcQiJpQEGO45DdglxvCHQcwKNpeZ3rNIYRmszkTT6Ckz7H\nLHMYjbBF+rYEe7GbKeEZOJRB+FSAsuzNutHu3R112GylGWpjDQoaUqEoy+L+\ngXhTcpLE0mV4MMrwOv2enfsVN9mYY92yDjte+/QtrIdiL95ZnUnsXmpgZCq3\nA8xaCKLMbO6jYqoKvCLPPHDN6OFJPovevjFYxEhFTfAabsY3L9wdAjUhlyqt\nCA4q7rpq1O/dReLgVwlcgLC4pVv3OPCSaXr7lcnklyJaBfD72liMVykev/s5\nG3hV1Z6pJ7Gm6GbHicGFGPqdMRWq+kHmlvNqMDsOYLTd+O3eK3ZmgGYJAtRj\n956+h81OYm3+tLuY6LJsIw4PF0EQeLRvJjma1qulkIvjkkhvrrht8ErNK8XF\n3tWY4ME53TQ//j8k9DuNBApcJpd3CG/J+o963oWgtzQwVx+5XnHCwRMEGAEI\nACYCGwwWIQSt71SyyjyBMojzR8ChBwCUDtu4ZQUCXW5xCAUJAAFSGwAhCRCh\nBwCUDtu4ZRYhBK3vVLLKPIEyiPNHwKEHAJQO27hlQr0L/A1Q8/a1U19tpSB+\nB/KabpW1ljD/GwaGjn0rs+OpPoB/fDcbJ9EYTqqn3sgDpe8kO/vwHT2fBjyD\nHiOECfeWoz2a80PGALkGJycQKyhuWw/DUtaEF3IP6crxt1wPtO5u0hAKxDq9\ne/I/3hZAbHNgVy03F5B+Jdz7+YO63GDfAcgR57b87utmueDagt3o3NR1P5SH\n6PpiP9kqz14NYEc4noisiL8WnVvYhl3i+Uw3n/rRJmB7jGn0XFo2ADSfwHhT\n+SSU2drcKKjYtU03SrXBy0zdipwvD83cA/FSeYteT/kdX7Mf1uKhSgWcQNMv\nNB/B5PK9mwBGu75rifD4784UgNhUo7BnJAYVLZ9O2dgYR05Lv+zW52RHflNL\nn0IHmqViZE1RfefQde5lk10ld+GjL8+6uIitUEKLLhpe8qHohbwpp1AbxV4B\nRyLIpKy7/iqRcMDLhmc4XRLtrPVAh2c7AXy5M2VKUIRjfFbHHWxZfDl3Nqrg\n+gib+vSxHvLhC6oDBA==\n=RIPF\n-----END PGP PRIVATE KEY BLOCK-----"; // eslint-disable-line max-len
      const expiredKey = await KeyUtil.parse(armored);
      expect(expiredKey.usableForEncryptionButExpired).to.equal(true);
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
      expect(key.usableForEncryptionButExpired).to.equal(false);
      expect(key.usableForSigningButExpired).to.equal(false);
      expect(key.emails.length).to.equal(1);
      expect(key.emails[0]).to.equal('actalis@meta.33mail.com');
      expect(key.identities.length).to.equal(1);
      expect(key.identities[0]).to.equal('actalis@meta.33mail.com');
      expect(key.isPublic).to.equal(true);
      expect(key.isPrivate).to.equal(false);
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
      await t.throwsAsync(() => KeyUtil.parse(httpsCert), { instanceOf: UnreportableError, message: 'This S/MIME x.509 certificate has an invalid recipient email: news.ycombinator.com' });
    });

    ava.default('[unit][KeyUtil.parse] Unknown key type parsing fails', async t => {
      await t.throwsAsync(() => KeyUtil.parse('dummy string for unknown key'), { instanceOf: Error, message: 'Key type is unknown, expecting OpenPGP or x509 S/MIME' });
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
      expect(key.usableForEncryptionButExpired).equal(true);
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

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
cmKFmmDYm+rrWuAv6Q==
=oWPu
-----END PGP PRIVATE KEY BLOCK-----`;

    ava.default('[unit][KeyUtil.parse] OpenPGP parsing of not-expired key', async t => {
      const key = await KeyUtil.parse(notExpiredPgp);
      expect(key.id).to.equal('7C3B38BB2C8A7E693C29DF455C08033166AF91E3');
      expect(key.allIds.length).to.equal(2);
      expect(key.allIds[0]).to.equal('7C3B38BB2C8A7E693C29DF455C08033166AF91E3');
      expect(key.allIds[1]).to.equal('28A4CCBFA1AF056C3B73EA4DECF8F9D42D8DFED8');
      expect(key.type).to.equal('openpgp');
      expect(key.usableForEncryption).equal(true);
      expect(key.usableForSigning).equal(true);
      expect(key.usableForEncryptionButExpired).equal(false);
      expect(key.usableForSigningButExpired).equal(false);
      expect(key.emails.length).to.equal(1);
      expect(key.emails[0]).to.equal('expiration_100years@test.com');
      expect(key.identities.length).to.equal(1);
      expect(key.identities[0]).to.equal('Testing <expiration_100years@test.com>');
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

    ava.default('[unit][KeyUtil.readMany] Parsing unarmored S/MIME certificate', async t => {
      const pem = forge.pem.decode(smimeCert)[0];
      const { keys, errs } = await KeyUtil.readMany(Buf.fromRawBytesStr(pem.body));
      expect(keys.length).to.equal(1);
      expect(errs.length).to.equal(0);
      expect(keys[0].id).to.equal('63F7025E700F3945301FB2FBA5674F84');
      expect(keys[0].type).to.equal('x509');
      t.pass();
    });

    ava.default('[unit][KeyUtil.parse] Correctly extracting email from SubjectAltName of S/MIME certificate', async t => {
      /*
            // generate a key pair
            const keys = forge.pki.rsa.generateKeyPair(2048);
            // create a certification request (CSR)
            const csr = forge.pki.createCertificationRequest();
            csr.publicKey = keys.publicKey;
            csr.setSubject([{
              name: 'commonName',
              value: 'Jack Doe'
            }]);
            // set (optional) attributes
            const subjectAltName = {
              name: 'subjectAltName',
              altNames: [{
                // 1 is RFC822Name type
                type: 1,
                value: 'email@embedded.in.subj.alt.name'
              }]
            }
            const extensions = [subjectAltName];
            (csr as any).setAttributes([{
              name: 'extensionRequest',
              extensions
            }]);
            csr.sign(keys.privateKey);
            // issue a certificate based on the csr
            const cert = forge.pki.createCertificate();
            cert.serialNumber = '1';
            cert.validity.notBefore = new Date();
            cert.validity.notAfter = new Date();
            cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 30);
            cert.setSubject(csr.subject.attributes);
            const caCertPem = fs.readFileSync("./ca.crt", 'utf8');
            const caKeyPem = fs.readFileSync("./ca.key", 'utf8');
            const caCert = forge.pki.certificateFromPem(caCertPem);
            const caKey = forge.pki.decryptRsaPrivateKey(caKeyPem, '1234');
            cert.setIssuer(caCert.subject.attributes);
            cert.setExtensions([{
              name: 'basicConstraints',
              cA: true
            }, {
              name: 'keyUsage',
              keyCertSign: true,
              digitalSignature: true,
              nonRepudiation: true,
              keyEncipherment: true,
              dataEncipherment: true
            }, subjectAltName
            ]);
            cert.publicKey = csr.publicKey;
            cert.sign(caKey);
            const pem = forge.pki.certificateToPem(cert);
      */
      const pem = `-----BEGIN CERTIFICATE-----
MIIETTCCAjWgAwIBAgIBATANBgkqhkiG9w0BAQUFADB0MRMwEQYDVQQIDApTb21l
LVN0YXRlMSEwHwYDVQQKDBhJbnRlcm5ldCBXaWRnaXRzIFB0eSBMdGQxFzAVBgNV
BAMMDlNvbWUgQXV0aG9yaXR5MSEwHwYJKoZIhvcNAQkBFhJhdXRob3JpdHlAdGVz
dC5jb20wIBcNMjEwNDE3MTIyMTMxWhgPMjA1MTA0MTcxMjIxMzFaMBMxETAPBgNV
BAMTCEphY2sgRG9lMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAyKOw
VX51bduPdwSLR4u1O4HuOrELZjlOx8SWlOdU2yDZmp9iTZ/jP318xUs7XL1gIMDF
mXuDZB+KU9rwvECOecazWp8vpfLV/Tn/lp5lDLz+QqwlSWruzz0Z49F6zCWfBMQQ
Y475a03pd0oo6Soxt89A5PXuQhIBgdniyxUeQe0Okd7MC5/w0R+95aqZB47ui7ur
R7HcyGzkvfADXvdeZQsKSjja0lVFUJAJ6Uj2o0R9Z1YHtZKH9/D75IiYY3gqYJtt
BZoZPOMpl7Jam5Hz7PVWV3aeeMsAAHALWK7qvfaNx3IOCVh5KYQZ544P7cGGgpuw
UamKkF+wR7H4d7OYPwIDAQABo0kwRzAMBgNVHRMEBTADAQH/MAsGA1UdDwQEAwIC
9DAqBgNVHREEIzAhgR9lbWFpbEBlbWJlZGRlZC5pbi5zdWJqLmFsdC5uYW1lMA0G
CSqGSIb3DQEBBQUAA4ICAQCeGSsJNYsyQXnRal3L0HDF8PTj5zBa2jCSVAuwMe9Z
LWSJEXetF6uwH3yJzCxe/ZGNheEUAMGnMC1lYwsZ8x/hO8WcnzGxC1kqS71jV0us
rYZGsSb6dOoSigUfrzEcImx33n5yKYS8cHN/tUMvPiULX9RlSWnKlAfQClQeIxEA
6Y1Jeu0AVP3ugMajxqHoA10JOOrqjKuvkkM3gha9iS+q0w0mqhJ8GzZfOTdFJj/G
/erHQ/HWL7mqJoGh+i6I9N5qBNmdNEZazXJ/ACfR46Zav7nOXBF9CZ4k4g3mr/Po
1L3FXotxDQaTITY4xrse/GNCd92Q2Pc3ASS1SWRozpefyY414qfDP4x7IYwFOnK/
swVjxFEyniiliYOiUV7tEm5FYRkAaQIAMiAXsZQB5LwatJN7WCQMh3xfPiuW91wL
Qmq47Rku8zPVsmQ5oBF9Ip4RraLOapoL09abmhyS9CFiT+bqZYSa9erT81eZnEfY
p07CH3yZBVSw7nRTIS8ScDHRvTt+FzrcchVcPfXMfYeydosmgQdDFFy/fm2alb8B
JKEHXc4KK04f6Fa90Uo+1hVInMziuLRWN6vubkHUDSXY4jhGm84OksTyW3AFKigC
jLwe8W9IMt765T5x5oux9MmPDXF05xHfm4qfH/BMO3a802x5u2gJjJjuknrFdgXY
9Q==
-----END CERTIFICATE-----`;
      const key = await KeyUtil.parse(pem);
      expect(key.emails.length).to.equal(1);
      expect(key.emails[0]).to.equal('email@embedded.in.subj.alt.name');
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
      expect(parsed?.usableForEncryptionButExpired).to.equal(false); // because last signature was created as already expired, no intersection
      t.pass();
    });

    ava.default('[unit][MsgUtil.decryptMessage] extracts Primary User ID from key', async t => {
      const data = await GoogleData.withInitializedData('ci.tests.gmail@flowcrypt.test');
      const msg: GmailMsg = data.getMessage('1766644f13510f58')!;
      const enc = Buf.fromBase64Str(msg!.raw!).toUtfStr()
        .match(/\-\-\-\-\-BEGIN PGP SIGNED MESSAGE\-\-\-\-\-.*\-\-\-\-\-END PGP SIGNATURE\-\-\-\-\-/s)![0];
      const encryptedData = Buf.fromUtfStr(enc);
      const pubkey = await KeyUtil.parse(testConstants.pubkey2864E326A5BE488A);
      await ContactStore.update(undefined, 'president@forged.com', { name: 'President', pubkey });
      const decrypted = await MsgUtil.decryptMessage({ kisWithPp: [], encryptedData });
      expect(decrypted.success).to.equal(true);
      const verifyRes = (decrypted as DecryptSuccess).signature!;
      expect(verifyRes.match).to.be.true;
      expect(verifyRes.signer?.primaryUserId).to.equal('A50 Sam <sams50sams50sept@gmail.com>');
      t.pass();
    });

    ava.default('[unit][MsgUtil.verifyDetached] verifies Thunderbird html signed message', async t => {
      const data = await GoogleData.withInitializedData('flowcrypt.compatibility@gmail.com');
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
      const contact = await ContactStore.obj({ email: from, pubkey });
      await ContactStore.save(undefined, contact);
      const result = await MsgUtil.verifyDetached({ plaintext: Buf.fromUtfStr(plaintext), sigText: Buf.fromUtfStr(sigText) });
      expect(result.match).to.be.true;
      t.pass();
    });

    ava.default('[unit][MsgUtil.verifyDetached] verifies Thunderbird text signed message', async t => {
      const data = await GoogleData.withInitializedData('flowcrypt.compatibility@gmail.com');
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
      const contact = await ContactStore.obj({ email: from, pubkey });
      await ContactStore.save(undefined, contact);
      const result = await MsgUtil.verifyDetached({ plaintext: Buf.fromUtfStr(plaintext), sigText: Buf.fromUtfStr(sigText) });
      expect(result.match).to.be.true;
      t.pass();
    });

    ava.default('[unit][MsgUtil.verifyDetached] verifies Firefox rich text signed message', async t => {
      const data = await GoogleData.withInitializedData('flowcrypt.compatibility@gmail.com');
      const msg: GmailMsg = data.getMessage('175ccd8755eab85f')!;
      const msgText = Buf.fromBase64Str(msg!.raw!).toUtfStr();
      const sigBase64 = msgText
        .match(/Content\-Type: application\/pgp\-signature;.*\r\n\r\n(.*)\r\n\-\-/s)![1];
      const sigText = Buf.fromBase64Str(sigBase64);
      const plaintext = msgText
        .match(/Content\-Type: multipart\/mixed;\r?\n? boundary="\-\-\-\-sinikael\-\?=_2\-16054595384320\.6487848448108896".*\-\-\-\-\-\-sinikael\-\?=_2\-16054595384320\.6487848448108896\-\-\r?\n/s)![0]
        .replace(/\r?\n/g, '\r\n')!;
      if ((await ContactStore.get(undefined, ['7FDE685548AEA788'])).length === 0) {
        const contact = await ContactStore.obj({
          email: 'flowcrypt.compatibility@gmail.com',
          pubkey: testConstants.flowcryptcompatibilityPublicKey7FDE685548AEA788
        });
        await ContactStore.save(undefined, contact);
      }
      const result = await MsgUtil.verifyDetached({ plaintext: Buf.fromUtfStr(plaintext), sigText });
      expect(result.match).to.be.true;
      t.pass();
    });

    ava.default('[unit][MsgUtil.getSortedKeys,matchingKeyids] must be able to find matching keys', async t => {
      const passphrase = 'some pass for testing';
      const key1 = await OpenPGPKey.create([{ name: 'Key1', email: 'key1@test.com' }], 'curve25519', passphrase, 0);
      const key2 = await OpenPGPKey.create([{ name: 'Key2', email: 'key2@test.com' }], 'curve25519', passphrase, 0);
      const pub1 = await KeyUtil.parse(key1.public);
      const pub2 = await KeyUtil.parse(key2.public);
      // only encrypt with pub1
      const { data } = await MsgUtil.encryptMessage({ pubkeys: [pub1], data: Buf.fromUtfStr('anything'), armor: true }) as PgpMsgMethod.EncryptPgpArmorResult;
      const m = await opgp.message.readArmored(Buf.fromUint8(data).toUtfStr());
      const kisWithPp: KeyInfoWithOptionalPp[] = [ // supply both key1 and key2 for decrypt
        { ... await KeyUtil.keyInfoObj(await KeyUtil.parse(key1.private)), passphrase },
        { ... await KeyUtil.keyInfoObj(await KeyUtil.parse(key2.private)), passphrase },
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
      expect(sortedKeys.prvForDecryptDecrypted[0].ki.longid).to.equal(OpenPGPKey.fingerprintToLongid(pub1.id));
      // also test MsgUtil.matchingKeyids
      // @ts-ignore
      const matching1 = await MsgUtil.matchingKeyids(pub1.allIds, m.getEncryptionKeyIds());
      expect(matching1.length).to.equal(1);
      // @ts-ignore
      const matching2 = await MsgUtil.matchingKeyids(pub2.allIds, m.getEncryptionKeyIds());
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

    ava.default('[Attachment.sanitizeName] for special and unicode characters', async t => {
      // slash
      expect(Attachment.sanitizeName('abc/def')).to.equal('abc_def');
      // backslash
      expect(Attachment.sanitizeName('abc\\def')).to.equal('abc_def');
      // combinations of slashes and backslashes
      expect(Attachment.sanitizeName('abc\\/def')).to.equal('abc_def');
      expect(Attachment.sanitizeName('abc/\\def')).to.equal('abc_def');
      // trimming
      expect(Attachment.sanitizeName('  1  ')).to.equal('1');
      expect(Attachment.sanitizeName('    ')).to.equal('_');
      // empty
      expect(Attachment.sanitizeName('')).to.equal('_');
      // cyrillic
      const cyrillicName = '\u0410\u0411\u0412';
      expect(Attachment.sanitizeName(cyrillicName)).to.equal(cyrillicName);
      t.pass();
    });

    // public key that allows to encrypt for primary key - to simulate a bug in other implementation that wrongly encrypts for primary when it shouldn't
    // sec  rsa2048/F90C76AE611AFDEE
    //      created: 2020-10-15  expires: never       usage: SCE
    //      trust: ultimate      validity: ultimate
    // ssb  rsa2048/4BA880ECE71397FC
    //      created: 2020-10-15  expires: never       usage: E
    const pubEncryptForPrimaryIsFine = `-----BEGIN PGP PUBLIC KEY BLOCK-----\n\nmQENBF+IL20BCACTJLnno0xB29YeNP9xV4bdkEE0zSo/UoFzRKpUupG+0El17oDw\nQDUeW2YjZwLxMJVlRyo+eongpFYFbC+d5cwiHE/YP6uQPmniiEpa3ICZw87Jk/R2\n5dTAVk9QuAlvkI1lWA0+1SDTFxuWD1LTEjcSS6so8pr2VOF6xFu5QKCkbX0/aQe5\npoHryZ/RkUW4d+B3aTC56RnXSAfeegwn1VDF+J+t0jZ0rMzKs2IaDgqX5HzBqOOI\nlIrr43ROHmceuTMZp19aoLYhFNn1lseyug/YQm4b6Hf6VVypNNUFdgbK8xrxowOq\nb2cgSajgcZVMkTF5IQuyS/IIlobJGZeqZ33nABEBAAG0aVRlc3QgS2V5IFdoZW4g\nTWVzc2FnZSBXcm9uZ2x5IGVuY3J5cHRlZCBmb3IgUHJpbWFyeSBLZXkgPHRlc3Qu\nZmlsZS5lbmNyeXB0ZWQuZm9yLnByaW1hcnkua2V5QGV4YW1wbGUuY29tPokBTgQT\nAQoAOAULCQgHAgYVCgkICwIEFgIDAQIeAQIXgBYhBL+zmJKJcURh2km3GfkMdq5h\nGv3uBQJfjVbfAhsPAAoJEPkMdq5hGv3uqCEH/3gbq7JwKQf0NV0muZysc0aNt000\nG3NtZkuYi83l8JMwlDq50lOMgL7gCngTB9ed822d27ClMsj8eP9XuKtw6e7gpvMc\njMF2rACiQKYuZ0iVUK23Zi0fb17zN0BJ0gJ9BpEv5MjaYJ1G4QZDOKG23a/hVUUv\nfRmwbBynSFMgVWQJHGQ9KcY2Jt8M3sLcxpuPO3QLWGivitbZDB2QrL/fALRQpc1Y\nnNkgdUxpZE5dkos01IR5GjZeSmrYpP7UaHa/O3lCdLiskjtCNwWcTr1yJZdzmbZ4\npw6Hu+kEIiYgmwPNodJpRYxZ8rR6ChJ4q1SE6J3iJ4SlGVdU0TM4L5nuJxy5AQ0E\nX4gvbQEIANUO63F2tdT4zOt8gP2XBZwo8fbI59AEEgBaq7o3sluujAak3mK71LyT\n4S4gvJLyGlAU9TV4JQxRuky6oCcyA1D6PNCYGiR6OJbmmzosrh34bYkfz3xjDu/d\nNAKPDCJz2arcVuVbE5onjQd9afjaZh+4pVKs3lKn1UdBXIrei2LC98CemRWxUwfH\nG0LswvnIg24ByvFBvOzBiB7m9340ComMnKGRpeze8uEubYNNQDexL2zCo2itUFKB\nuPkQbCN7jXg/vnNLk2GXFlUYt20puEH4iyaJ/QFIZzzeqFRQWvI63JJ7zQZIGeok\nS/0MLq1udNYxUqk014TEso0jvC1evX0AEQEAAYkBNgQYAQoAIBYhBL+zmJKJcURh\n2km3GfkMdq5hGv3uBQJfiC9tAhsMAAoJEPkMdq5hGv3usZ4H/1N12NiLOVwQ3Zeq\nVxUocwC/UjZX6JlAPg0h1Spx0RGdNuu4WMLnlF/1yzK+LE84WFYkvXXIzNi1LIyX\nPh3YCPGFEec82MkLQFkLm7sjE4Xc3APYZJK2s5LSjyloZkprb7sbVjdWoBwAPClv\nQsgAlHBeCrlWcLo7fzZdxmpvmJFHd/J7ajKsMCn5f9DXFCoCNdrv+s5Qf4jo6KaE\nhZrQ75+T52Iq9R5Z2gS5G4jY3eW+iK2/xW5Q0x0UeoJG7u8WR56LSl0jS9lufuOS\nyFkO3XIWLzDfz51EVy7ApK33D3GQTfOQ8tJEqW2p17rQTcXuhmg4Dgcf1b0dyVac\n7jV1Tgs=\n=4gfr\n-----END PGP PUBLIC KEY BLOCK-----\n`;
    // a normal keypair
    // sec  rsa2048/F90C76AE611AFDEE
    //      created: 2020-10-15  expires: never       usage: SC
    //      trust: ultimate      validity: ultimate
    // ssb  rsa2048/4BA880ECE71397FC
    //      created: 2020-10-15  expires: never       usage: E
    const prvEncryptForSubkeyOnly = `-----BEGIN PGP PRIVATE KEY BLOCK-----\n\n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\n1b0dyVac7jV1Tgs=\n=4Jfy\n-----END PGP PRIVATE KEY BLOCK-----\n`;

    ava.default('[MsgUtil.encryptMessage] do not decrypt message when encrypted for key not meant for encryption', async t => {
      const data = Buf.fromUtfStr('hello');
      const passphrase = 'pass phrase';
      const tmpPrv = await KeyUtil.parse(prvEncryptForSubkeyOnly);
      await KeyUtil.encrypt(tmpPrv, passphrase);
      expect(tmpPrv.fullyEncrypted).to.equal(true);
      const prvEncryptForSubkeyOnlyProtected = KeyUtil.armor(tmpPrv);
      const { keys: [tmpPub] } = await opgp.key.readArmored(pubEncryptForPrimaryIsFine);
      tmpPub.subKeys = [];
      // removed subkey from the pubkey, which makes the structure into this - forcing opgp to encrypt for the primary
      // sec  rsa2048/F90C76AE611AFDEE
      //      created: 2020-10-15  expires: never       usage: SCE
      //      trust: ultimate      validity: ultimate
      const justPrimaryPub = tmpPub.armor();
      const pubkeys = [await KeyUtil.parse(justPrimaryPub)];
      const encrypted = await MsgUtil.encryptMessage({ pubkeys, data, armor: true }) as PgpMsgMethod.EncryptPgpArmorResult;
      const kisWithPp: KeyInfoWithOptionalPp[] = [{ ... await KeyUtil.keyInfoObj(await KeyUtil.parse(prvEncryptForSubkeyOnlyProtected)), passphrase }];
      const decrypted = await MsgUtil.decryptMessage({ kisWithPp, encryptedData: encrypted.data });
      // todo - later we'll have an org rule for ignoring this, and then it will be expected to pass as follows:
      // expect(decrypted.success).to.equal(true);
      // expect(decrypted.content!.toUtfStr()).to.equal(data.toUtfStr());
      expect(decrypted.success).to.equal(false);
      expect((decrypted as DecryptError).error.type).to.equal('key_mismatch');
      t.pass();
    });

    ava.default('[KeyUtil.diagnose] displays PK and SK usage', async t => {
      const usageRegex = /\[\-\] \[(.*)\]/;
      const result1 = await KeyUtil.diagnose(await KeyUtil.parse(pubEncryptForPrimaryIsFine), '');
      {
        const pk0UsageStr = result1.get('Usage flags')!;
        const sk0UsageStr = result1.get('SK 0 > Usage flags')!;
        const pk0Usage = pk0UsageStr.match(usageRegex)![1].split(', ');
        expect(pk0Usage).to.include('certify_keys');
        expect(pk0Usage).to.include('sign_data');
        expect(pk0Usage).to.include('encrypt_storage');
        expect(pk0Usage).to.include('encrypt_communication');
        const sk0Usage = sk0UsageStr.match(usageRegex)![1].split(', ');
        expect(sk0Usage).to.not.include('certify_keys');
        expect(sk0Usage).to.not.include('sign_data');
        expect(sk0Usage).to.include('encrypt_storage');
        expect(sk0Usage).to.include('encrypt_communication');
      }
      const result2 = await KeyUtil.diagnose(await KeyUtil.parse(prvEncryptForSubkeyOnly), '');
      {
        const pk0UsageStr = result2.get('Usage flags')!;
        const sk0UsageStr = result2.get('SK 0 > Usage flags')!;
        const pk0Usage = pk0UsageStr.match(usageRegex)![1].split(', ');
        expect(pk0Usage).to.include('certify_keys');
        expect(pk0Usage).to.include('sign_data');
        expect(pk0Usage).to.not.include('encrypt_storage');
        expect(pk0Usage).to.not.include('encrypt_communication');
        const sk0Usage = sk0UsageStr.match(usageRegex)![1].split(', ');
        expect(sk0Usage).to.not.include('certify_keys');
        expect(sk0Usage).to.not.include('sign_data');
        expect(sk0Usage).to.include('encrypt_storage');
        expect(sk0Usage).to.include('encrypt_communication');
      }
      t.pass();
    });

    const dsaPrimaryKeyAndSubkeyBothHavePrivateKey = `-----BEGIN PGP PRIVATE KEY BLOCK-----

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
JW/1mKoBRBfyKzP8ibuUyur7X6rryVL/dctxoA==
=Pmsz
-----END PGP PRIVATE KEY BLOCK-----`;

    const rsaPrimaryKeyAndSubkeyBothHavePrivateKey = `-----BEGIN PGP PRIVATE KEY BLOCK-----

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
=/3Ew
-----END PGP PRIVATE KEY BLOCK-----`;

    ava.default('[KeyUtil.diagnose] handles incorrect passphrase', async t => {
      const result = await KeyUtil.diagnose(await KeyUtil.parse(rsaPrimaryKeyAndSubkeyBothHavePrivateKey), '4321');
      expect(result.get('Is Private?')).to.equal('[-] true');
      expect(result.get('User id 0')).to.equal('Test1 (rsa) <flowcrypt.test.key.imported@gmail.com>');
      expect(result.get('Primary User')).to.equal('Test1 (rsa) <flowcrypt.test.key.imported@gmail.com>');
      expect(result.get('Fingerprint')).to.equal('6628 5F84 B985 71BD 01C0 18EE 8B3B B9CF C476 EE16');
      expect(result.get('Subkeys')).to.equal('[-] 1');
      expect(result.get('Primary key algo')).to.equal('[-] rsa_encrypt_sign');
      expect(result.get('key decrypt')).to.equal('[-] false');
      expect(result.get('isFullyDecrypted')).to.equal('[-] false');
      expect(result.get('isFullyEncrypted')).to.equal('[-] true');
      expect(result.get('Primary key verify')).to.equal('[-] valid');
      expect(result.get('Primary key creation?')).to.equal('[-] 1606140328 or 2020-11-23T14:05:28.000Z');
      expect(result.get('Primary key expiration?')).to.equal('[-] -');
      expect(result.has('Encrypt/Decrypt test: Encryption with key was successful')).to.be.true;
      expect(result.has('Encrypt/Decrypt test: Skipping decryption because isPrivate:true isFullyDecrypted:false')).to.be.true;
      expect(result.get('Sign/Verify test')).to.equal('[-] skipped, not fully decrypted');
      expect(result.get('SK 0 > LongId')).to.equal('[-] 0485D618EAA64B05');
      expect(result.get('SK 0 > Created')).to.equal('[-] 1606140328 or 2020-11-23T14:05:28.000Z');
      expect(result.get('SK 0 > Algo')).to.equal('[-] rsa_encrypt_sign');
      expect(result.get('SK 0 > Verify')).to.equal('[-] OK');
      expect(result.get('SK 0 > Subkey tag')).to.equal('[-] 7');
      expect(result.get('SK 0 > Subkey getBitSize')).to.equal('[-] 3072');
      expect(result.get('SK 0 > Subkey decrypted')).to.equal('[-] false');
      expect(result.get('SK 0 > Binding signature length')).to.equal('[-] 1');
      expect(result.get('SK 0 > SIG 0 > Key flags')).to.equal('[-] 12');
      expect(result.get('SK 0 > SIG 0 > Tag')).to.equal('[-] 2');
      expect(result.get('SK 0 > SIG 0 > Version')).to.equal('[-] 4');
      expect(result.get('SK 0 > SIG 0 > Public key algorithm')).to.equal('[-] 1');
      expect(result.get('SK 0 > SIG 0 > Sig creation time')).to.equal('[-] 1606140328 or 2020-11-23T14:05:28.000Z');
      expect(result.get('SK 0 > SIG 0 > Sig expiration time')).to.equal('[-] -');
      expect(result.get('SK 0 > SIG 0 > Verified')).to.equal('[-] true');
      expect(result.get('expiration')).to.equal('[-] undefined');
      expect(result.get('internal dateBeforeExpiration')).to.equal('[-] undefined');
      expect(result.get('internal usableForEncryptionButExpired')).to.equal('[-] false');
      expect(result.get('internal usableForSigningButExpired')).to.equal('[-] false');
      t.pass();
    });

    ava.default('[KeyUtil.diagnose] decrypts and successfully tests PK sign and SK encrypt', async t => {
      const result = await KeyUtil.diagnose(await KeyUtil.parse(rsaPrimaryKeyAndSubkeyBothHavePrivateKey), '1234');
      expect(result.get('Is Private?')).to.equal('[-] true');
      expect(result.get('User id 0')).to.equal('Test1 (rsa) <flowcrypt.test.key.imported@gmail.com>');
      expect(result.get('Primary User')).to.equal('Test1 (rsa) <flowcrypt.test.key.imported@gmail.com>');
      expect(result.get('Fingerprint')).to.equal('6628 5F84 B985 71BD 01C0 18EE 8B3B B9CF C476 EE16');
      expect(result.get('Subkeys')).to.equal('[-] 1');
      expect(result.get('Primary key algo')).to.equal('[-] rsa_encrypt_sign');
      expect(result.get('key decrypt')).to.equal('[-] true');
      expect(result.get('isFullyDecrypted')).to.equal('[-] true');
      expect(result.get('isFullyEncrypted')).to.equal('[-] false');
      expect(result.get('Primary key verify')).to.equal('[-] valid');
      expect(result.get('Primary key creation?')).to.equal('[-] 1606140328 or 2020-11-23T14:05:28.000Z');
      expect(result.get('Primary key expiration?')).to.equal('[-] -');
      expect(result.has('Encrypt/Decrypt test: Encryption with key was successful')).to.be.true;
      expect(result.has('Encrypt/Decrypt test: Decryption with key succeeded')).to.be.true;
      expect(result.get('Sign/Verify test')).to.equal('[-] sign msg ok|verify ok');
      expect(result.get('SK 0 > LongId')).to.equal('[-] 0485D618EAA64B05');
      expect(result.get('SK 0 > Created')).to.equal('[-] 1606140328 or 2020-11-23T14:05:28.000Z');
      expect(result.get('SK 0 > Algo')).to.equal('[-] rsa_encrypt_sign');
      expect(result.get('SK 0 > Verify')).to.equal('[-] OK');
      expect(result.get('SK 0 > Subkey tag')).to.equal('[-] 7');
      expect(result.get('SK 0 > Subkey getBitSize')).to.equal('[-] 3072');
      expect(result.get('SK 0 > Subkey decrypted')).to.equal('[-] true');
      expect(result.get('SK 0 > Binding signature length')).to.equal('[-] 1');
      expect(result.get('SK 0 > SIG 0 > Key flags')).to.equal('[-] 12');
      expect(result.get('SK 0 > SIG 0 > Tag')).to.equal('[-] 2');
      expect(result.get('SK 0 > SIG 0 > Version')).to.equal('[-] 4');
      expect(result.get('SK 0 > SIG 0 > Public key algorithm')).to.equal('[-] 1');
      expect(result.get('SK 0 > SIG 0 > Sig creation time')).to.equal('[-] 1606140328 or 2020-11-23T14:05:28.000Z');
      expect(result.get('SK 0 > SIG 0 > Sig expiration time')).to.equal('[-] -');
      expect(result.get('SK 0 > SIG 0 > Verified')).to.equal('[-] true');
      expect(result.get('expiration')).to.equal('[-] undefined');
      expect(result.get('internal dateBeforeExpiration')).to.equal('[-] undefined');
      expect(result.get('internal usableForEncryptionButExpired')).to.equal('[-] false');
      expect(result.get('internal usableForSigningButExpired')).to.equal('[-] false');
      t.pass();
    });

    const dsaPrimaryKeyIsMissingPrivateKey = `-----BEGIN PGP PRIVATE KEY BLOCK-----

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
oA==
=e6+m
-----END PGP PRIVATE KEY BLOCK-----`;

    const rsaPrimaryKeyIsMissingPrivateKey = `-----BEGIN PGP PRIVATE KEY BLOCK-----

lQGVBF+7wagBDADHQ/DNEc16xAUAu6mYzMiNCG5IyzheXtEP2QUtPxEDrxNlOhv3
YyqyJadp5+ycIctVquwmzGRNolfFKDdVR1f7KAr0wpU5gRfH8OyneaHeGFopUpbI
Mk0zjlw9jNtxL6UwXhx6Z50A1mBTdB55ttaLSG+A2FTlCOTN0RV+vX79EFRHNFku
m5xhDQWRH3DVvso20eR7vcHwXSwdNALxPWtzQhmTdri+ThgCZ+uWvn++e98xw/k0
X/uvMoz4ccIqZo5PJgBfSpC8vt8ufCIAtrmb5JXghnxx/dlvL+Z6ebp9vwA7OFML
EV1VBRx5H343TMtQ0rC8U5qW6DMyZ+iSeb2toFYraw2zlTr3XaK5tfHCstsU8EFn
OopISKe32OVKgsEwZdUqdGTERMW6eYf97wRpE3X4Q8kFp5KkAmeDaDL7wPio/F1R
LmbAhr9ZNpFqaIGxJsqy0rzvPrTINOjtuThanmbXDVdj90o9VyyrRABqWM/UB6y7
rhCnVtJ8uTWpImkAEQEAAf8AZQBHTlUBtDNUZXN0MSAocnNhKSA8Zmxvd2NyeXB0
LnRlc3Qua2V5LmltcG9ydGVkQGdtYWlsLmNvbT6JAc4EEwEIADgWIQRmKF+EuYVx
vQHAGO6LO7nPxHbuFgUCX7vBqAIbAwULCQgHAgYVCgkICwIEFgIDAQIeAQIXgAAK
CRCLO7nPxHbuFtwsC/0RtBl6z9QZupZ4jozZ4EuGQRs9dDVkgHmYF9H9Oy1bZRQf
Di72uRzukAaSvfTgiTYC9toa1jwAdDU2CgEzrMp3F+u2IckUd7yof1TtiBE/SVJx
Vd9zeRn6Oo5sQ8fvwMGvGPZ8TDfsXnwvDJyw16ILVUF/fX44kx51HrQNUaKnen96
dawrpzGw5O7Uu+/Jeiup2Fj8KHZ4V0BlWa3HaGLWpL1gxElLvBVrX5BxNXo0C/WI
LLg1cp731CROQSRI4LSSnzhNCMPLdMgNgIDWAJKAK/Fm9717ar30hqPJ/pg5T2G9
ttm2JKQB1wYTgQ7j0l7jrnJ2OY6UjXZn0M592fKj0Le4R/6cjmVAez9Hkc92oKIF
7TLPVGQkNEzt/LKCMx9xTLQw8oRo+tvcbW+ZX8yTgZXDrpqsDKhiQrpa7AiCbUvt
DgXULFAYnjD8dI/44lcyVel4m5nrwfGjEcGTwwqtPHirXgk7Er/0FVST/BbIFu0T
MYCInvRy8I56WcyhFj2dBYYEX7vBqAEMANYJv49i4OvEr1IWvQqijKcwfGcnZf/y
6lTdSwzQYhW9IspC4PSpkoZayj1ei0CZnZti/nFR/uTWYtnDx0DEveY7yBmyNMLX
5g++GLjBXBAGO061uaO9SA1lbo1eUOoV6pRzrtxBH7ZVFf9Gup8+NvGUEUOU3D8j
VKinb+Chjao1vmANufDwqUdKi8c39GRedjgt2GzJcT+uh2AQqn1AZAJaRDfZGtol
kujgq1oD6zQtUPaf//mc7kiy53cZ79/zMzC2U1asMc0QEZd7pEeJY2kHVqiNL4Yb
Hv1xpeBJr+JeIwZu0JHwIWfRbroiVc068y9C8cHe7Ar45WVGtZD8zEYPK+1fN0Vr
BCstpT03hIuJA2tWAjKrfkxG5wer+RIgWWAATGXnBRbq2GSTop09ESI7xVqMYCaP
YpyFGgeMxR/KiX5pGBD4pz5oviMXp9KxjLpoC+hc3QYGHHDvRrvcal0wOVfssTrC
uZDJ5yBGvGLuRGFpSipGxtJ6HIb1G8HXMwARAQAB/gcDAmgzvdmrIbhv7i/K9K3G
yeqEMx/on70KF1Uoy0khXm/k2TQtcJbCB3IXD2+mTIS1yzhuCTPIt9gPT0dHRGRJ
dPoKW1QIsch8dLJMFSsx8AR/DdPA0OUHr/gsCotY929R+vgwDStxyeYWoSg2yc76
p8B8dT525zplDT4Uz+pu+rImO224NdkrrxS9Dz9pbdGaYLwAesfzbj2UO4qZnZeA
FeA0JYyHdvvc24kwvJ4eg1ZuNhdSZfEX4TqvGrZyVtA+b4t0/vH3TBgyzYumIF9M
lm1Gy2bMaQOhpV7I9OM4/HMT6Mgzb8Br5DOsv4XeE2kS0lnfkezbUg1hv7ZqfaVW
IqQT9ynwxBr7UHKDY0yZFTgKkqtw1htVYX50bcCfEfB+DGV4tTMu3sNasOKQMkwn
98FV4cDa1IbxEqSxi/iPwm2MrfAs554mV6uP+3HWNCo2+1lU6/5ZhG/xFS/l51DU
j4aRE30NLKl6RJD1bC3H0XZ/kWbj5EY8aK5qKSW/xeFErZGeQthWlbPr6as2jf7/
2PbgfzleFxFUsYFrDV64SYR7OKlTOT2b+WfXjlXm5lTgeS7xCd5vwudw2HxeeqZc
ujN6UxqMNawBue+mQOXFaXs1/x+r/xc0Pmx6KxUwG0JS3lB4R/XeIWJlTyaP8jGB
ALlMRgqRnWkEnHTHxD76QvRHZnO4SIklXH0EpGNwKA1bOLCROY1zss7jIWUmuGQR
gGZwr2i0qBkihpMHuwav9QmjoLWTSAdGkVTZbqPDVK8yICgMAwGTNjcPFg0VwwaT
rc66eEq9+c3V2Lkkhpt80mpzel9NvO6i1k6rI8G5D2hS/HZbN746HxhLgJfMmaNP
lcfdvr4L3oFUuMuSEypBqKAdLvZbOJJRPxiHDjCi7ftrwKpnySO7vyg3nh15Q+kd
sYsx2QMGDwTj1npH5X47USFPJ2EQ3zMN23Yd/h2AKy+V7YYkCvm4eZzPU6pvad2Z
e0CN7Yb+TcO9cEJ0yy/0mWV9R3sDy+DWc848KlBQinvD3sszH6HgUWjfo+3KKqlD
K5bLWkq+SjhchuuCi3xHXYG1Vl0ZmGxqFURqAr2K7OrmfY0ZzIHHRvPBKuGAGXtZ
yLUfxwS4A/h7unuGCAgD/AjV4ONjqkuKuuiAtlgxseQQjofGfXcPkj1cX3hnuLGH
/ZTl/Q9oFHHOPHXl32Fh7K8OVDyo0khWHpm6FnS+Ix04cYRXOX4A58hIOyVFgRNg
kc8haQMJDRWB7ftk6gcEawZGPUMvfPNTHDs+SllPhskcb8yGV1SX7T6b0BXd77jQ
Qnmp66RoB1KBy5Uv5F8DWvca6hq/EOZZ0mePzTFUwMqiEE4oyw8xiQG2BBgBCAAg
FiEEZihfhLmFcb0BwBjuizu5z8R27hYFAl+7wagCGwwACgkQizu5z8R27hbgjwv+
IV4aA+UyMgrENYbOV57TJde65wH8PRLptSX2FUudhYDemt5ePiKH0A65uWTsNKlo
xOcHioS6E5Q0i5ShD1PXHekAtPwc3BVBWOLi/f4KmPwhGt91NdHMQHSCYPOT3EBH
RNjzlQevW0WoSzsakBiKCo6AA/E5GloKORXMsGIOEkTIHMi+08yRS1cZkmalYlRZ
GriWiq1nFAfDBYhOrzBoRA2D+M2AXENgV8yeAp4VRwhdkcWyjxx4aM3rpUoEEWRP
Exgw6RqT8St8oQl0NZVORgyf8hWI1+4SGMbK9CmRyXDgua5gzUyf00NsLRheRQHm
ZAvn6PBX7vsaReOVa2zsnuY5g70xCxvzHIwR94POu5cENwRtCkrppFnISALpQ1kA
648mPMRkXUOCAfqKrQb6ANWnMHOdtvAo/GCil97MprUTiJpwKYuhKcanVMTXewzZ
3YPiV3VO3n30KQDDVSc5BUdGuphu48qQh/5BQoKOiVVL2451m7VJTMREmB/YRmSg
=OeNi
-----END PGP PRIVATE KEY BLOCK-----`;

    const dsaExpiredPubkeysOnly = `-----BEGIN PGP PUBLIC KEY BLOCK-----

mQMuBF+32zERCACS4joBHUWYAKIMZ39mK6NXc7wgaRP4fz2cm8YL6NHgWAwKTjcp
Ik+VBOAQWGdDq9/iuQwDQNzX2jXAj+i+Ycsx8Ro59DlUexN1kmGyUoE4EVFU6tm4
IwpPiye9b+xboCUYcdTug/KXTgk1znzcmxy31h9sZvkjOin0IHUQTkNYbYJV1GzL
ZeUaF5axdjXmdz7aBH+/Z+FL4KA6ec6/0Thb4o3ls9eYz1lq8axhp7ZLww0fwO5F
gXKwEQC3xjeco4V2YfDFXWbjPqYEw/OujvuBm3Sk+ezbztcFeqU9DiaDRWA8CzUC
ZzUku0+0yaWSEhw/MXZ1/ggcngfdDoOHD3RvAQC0d5heEQOXI/LrBrMLwhGTRMQ5
WuzadW6qmSzZl7PaKwf+KT87eUkHQLfVHxKzN2OHkfnZaXkg9uKSPXtbTzKpiWBO
pRBb42iRZsoyRz4j177SKHA9354J7uOuxaB9Tpj8a4tYbirnMkD3vdW3bxyFfytR
cPPk69gVzRBE/LvgUXmzn8F1E92FyeomNQriPgbwaxcIxZhh7zf64tDzXeqyjavt
qeCIEz1pUzTkHpBAGPqxxPfiilKj675r4+2C4ELM7hroAw8SGWhEY52cdQ/h7+sD
GFdxiwo4NXrGnnj8YUtnL4XytEsDTaa8x2jyB+4wL3y90G+89onj2jiQJmFy7VMz
Oql9qfNLH9WU95UaPnETnM6Qdopb2xhr54FLxwJHJQf+ICuftpIaTZrlrSQ3QwAr
BtPRNDAouCsF9yOV1IVg0M6oH1IO149WlSJ+DSj6mdVW+3mh9MR+LEqsLBsc+kpu
VMvBkYnkxQLeKMnn5OAYdy2/w4+wLGHW6Zk0g1+41uNiX/TD40Rbals4AOwS/Cfv
hMyYlEFFHWzc3Gd3oFWAnH4HlBkex+Vj9Z+mnugr5evNzJUjp/zysgyCQLpO5qR1
X9n7+ccxShpQVkeoj34PCT2YAgxoozdEICL6fyPHLmAAU4s2JJpcFj9Hpr05eBN3
f1K5wCzIgBu7Y0QXPubPp+MeVhQCvYczHr9sMh8EuU7LeuadS97p6ao/DHr9DRl+
YbQ4RFNBIGV4cGlyZWQgVGVzdCA8Zmxvd2NyeXB0LnRlc3Qua2V5LmltcG9ydGVk
QGdtYWlsLmNvbT6IlgQTEQgAPhYhBNKQyfMICB8GxBIEtv59tSXBN1FbBQJft9sx
AhsDBQkAAVGABQsJCAcCBhUKCQgLAgQWAgMBAh4BAheAAAoJEP59tSXBN1FbBqUA
/jcJMWGvBv9SaMBW1zhzwGpJm5jEpt3oPGNMTccCX+7nAQCWTdmehp4yYZnGkGRc
Y75OpvAHHJ6VouBO76vFiRDx9LkCDQRft9sxEAgAm6CMWettPQ2elDOaGSAxsf+x
aCuOZk5w6wgDOIc5YilYlZ+rZ68Aj3mPk9ZGyLhxP4FPZ9GExw/CbbqJ3r3n4ODD
yz9tCsnkzdgOIIEiihB4GGz3NetE94RQBS/bW2MQC5G74uBhKDU00kzVSdlk1KW4
9gkYmIF22AGf+kr2/H6idijSc13M1jzm6kyzkOdVEnLiDXEZH7Qr9Kr3gqA7UqY6
wl1zoJj4SJdUetj9uemK2gSaoh3BIlW7vRVoa8khhWNF/WJdwNV5UcBX1HyoIzxt
353JQSplv4MJKl8HusO7HpF7oxiRyTgG5vJUnHH8tIONFiY8XENlsMbE7EKaTwAD
BQgAlT6U5z95raOQe4uQEymCpcER1kaZjRKvu85FqKMX41+gdEGQZKCB31FDVg7a
/xplZBPYsA6ihCbExPkP7pyusOhQIShh77QXlIWUli5DWSTJH8SbvzOP1Hg+GHlI
ysBmhdbaB2h42Rsrro9VLLqq+m8X8sSiUnBh4BUjRS5fLkdZ9E9AjDeff0jW0HUK
9vLAtkvRy7UtGabMfCHBokEHQSvN2NfSPJbhoFcgZXI7lqt9z+CYUT0H5jHJb45k
1QjLdGfZiP2WwUfS5mP4cmuIUXZ9UYQatUlReRmM0fXmsGZQDFUSqc7YEFaaPJSP
VrYJTH3cgSYPB+zPHA3CeWrQa4h+BBgRCAAmFiEE0pDJ8wgIHwbEEgS2/n21JcE3
UVsFAl+32zECGwwFCQABUYAACgkQ/n21JcE3UVtmdAD/cwfwJUquz6WQtolRb1RI
kSoBm4IgVS+PkLG2wt1GHVMA/1nhkJ6Veumyy4ldoSRdomImB9gjwHoCqWT+qXqe
h4nt
=lETP
-----END PGP PUBLIC KEY BLOCK-----`;

    const rsaExpiredPubkeysOnly = `-----BEGIN PGP PUBLIC KEY BLOCK-----

mQENBF+323wBCADulm2pzzTL0gY/fMbYNHgq72j6XvNic4WncU8WDxytfnPNKqFI
fJcWXPq8QBQIK8pwBRm4vHu5q7fDpId+c8pdZ3kVG2JQvWEFO83q4YJGEWPnLYYY
6le9vSXTWQ7la24aTAEHfH17BdMIGET/so+owRzkBpUl72JuSuarQJJl3ePmu2Iv
KaD2xSc0G2wm++ywZa255PHC4VmZ0lQ2xlZdGZPEWfSDVTchpHvPLQe0vSI/Eg4Q
tRQYlYfLCQuOmkrCV+jqAsbDMHTNF2yE//CnlPA8unjLNdmw6DVhO85F3TIWR5NI
1LOvxEc9MDsWqMuMizzHnnSAnPdLo/sm/fHtABEBAAG0OFJTQSBleHBpcmVkIFRl
c3QgPGZsb3djcnlwdC50ZXN0LmtleS5pbXBvcnRlZEBnbWFpbC5jb20+iQFUBBMB
CAA+FiEEQUF/y80YjGYEme19zhZF0KSimP0FAl+323wCGwMFCQABUYAFCwkIBwIG
FQoJCAsCBBYCAwECHgECF4AACgkQzhZF0KSimP1rGAgAw/GI6PbRstEBiZs9udv0
GttgIU4KnZh9jkr77JWRIH/MGrg2mTXazNt6LdlzOYPUdqB9bYo6tZnLox4x6tQK
8y9TOOXgGcqdiridnEmb2W4eDGN9bfbbDf2c702u+EpITEiSwOi/ResDSsnqFpHJ
sPf4wRrcPpwuecruDaEzPMAyziamWboCgpOzczjod935rhGXsCTcR6BausslmkOW
pUGWtpHw0QZWaHCxt3uUL9gMNNpn5Xmb2Qas2sJQPpSm441fgY7UUig7IoEp5tsp
QZYG85PeUSV8387h3HUjwRsePxcyAZlkAlexC6Hj9w8LrTLMEQsyoFY2D/dSRSCx
e7kBDQRft9t8AQgAwZUUmA8/e18vMWWiaNDhDro7g5XaETe/bCJfxBwmOtig8oin
ghJuDxejzK4B63VoQ3c4VDdl0rQb3utjS1bBZz0piJadtDAefbGIJL5yp6QT2bq7
DCDWuNssrmbBe3SksgqGSehY5SPQD6juKtbPdeD17QsfuBolsh1yQgqW0S5tbB5i
YUCrIJupbdKITR6dtgSOcDntIrktPk26iAq/9PdVQ218dM79SPgxzUugEsyTlUJe
7CFrkNLrIVuHRAycHGZniIAnw0MWZBtTPY3XYkVyt2TXrE97A854HLP1lvhL0/py
q/bfBXvrFONdlep03ZKNraY6BdrCnaSxHPI53QARAQABiQE8BBgBCAAmFiEEQUF/
y80YjGYEme19zhZF0KSimP0FAl+323wCGwwFCQABUYAACgkQzhZF0KSimP0btQgA
qH4mtWTOtanrs3zS+ORrZzlZacydNfX7BFqbrWBNx3Qn4ZUMYzroyXXrBKU2a0Ek
Wtn6JZO+3KF7NLjDKbPTP9oKA0RnBCxcEqd+Zt28+3g413RVOg/3GZ6cwctpmZId
PzBbLiMWVh9yhWNXKhwCNcjRNRiEp5eMsMo7xrvIMwT1dZWo3B1SU8ojcadRAQpB
jzIGNwXIlC7ENE5V8LyvJmFlI3Y54EiylEkXbycrAtaCtcOc8VI97dcej0A5vx+B
sGZik43btY7ooSmvfw154LBqk6j9bps8KS++T3ng2m62kWFelbR8ybjJmFkeDIdM
31rxxiAYCGthro8UvpKojA==
=AZcU
-----END PGP PUBLIC KEY BLOCK-----`;

    const dsaExpiredPrimaryKeyIsMissingPrivateKey = `-----BEGIN PGP PRIVATE KEY BLOCK-----

lQM2BF+32zERCACS4joBHUWYAKIMZ39mK6NXc7wgaRP4fz2cm8YL6NHgWAwKTjcp
Ik+VBOAQWGdDq9/iuQwDQNzX2jXAj+i+Ycsx8Ro59DlUexN1kmGyUoE4EVFU6tm4
IwpPiye9b+xboCUYcdTug/KXTgk1znzcmxy31h9sZvkjOin0IHUQTkNYbYJV1GzL
ZeUaF5axdjXmdz7aBH+/Z+FL4KA6ec6/0Thb4o3ls9eYz1lq8axhp7ZLww0fwO5F
gXKwEQC3xjeco4V2YfDFXWbjPqYEw/OujvuBm3Sk+ezbztcFeqU9DiaDRWA8CzUC
ZzUku0+0yaWSEhw/MXZ1/ggcngfdDoOHD3RvAQC0d5heEQOXI/LrBrMLwhGTRMQ5
WuzadW6qmSzZl7PaKwf+KT87eUkHQLfVHxKzN2OHkfnZaXkg9uKSPXtbTzKpiWBO
pRBb42iRZsoyRz4j177SKHA9354J7uOuxaB9Tpj8a4tYbirnMkD3vdW3bxyFfytR
cPPk69gVzRBE/LvgUXmzn8F1E92FyeomNQriPgbwaxcIxZhh7zf64tDzXeqyjavt
qeCIEz1pUzTkHpBAGPqxxPfiilKj675r4+2C4ELM7hroAw8SGWhEY52cdQ/h7+sD
GFdxiwo4NXrGnnj8YUtnL4XytEsDTaa8x2jyB+4wL3y90G+89onj2jiQJmFy7VMz
Oql9qfNLH9WU95UaPnETnM6Qdopb2xhr54FLxwJHJQf+ICuftpIaTZrlrSQ3QwAr
BtPRNDAouCsF9yOV1IVg0M6oH1IO149WlSJ+DSj6mdVW+3mh9MR+LEqsLBsc+kpu
VMvBkYnkxQLeKMnn5OAYdy2/w4+wLGHW6Zk0g1+41uNiX/TD40Rbals4AOwS/Cfv
hMyYlEFFHWzc3Gd3oFWAnH4HlBkex+Vj9Z+mnugr5evNzJUjp/zysgyCQLpO5qR1
X9n7+ccxShpQVkeoj34PCT2YAgxoozdEICL6fyPHLmAAU4s2JJpcFj9Hpr05eBN3
f1K5wCzIgBu7Y0QXPubPp+MeVhQCvYczHr9sMh8EuU7LeuadS97p6ao/DHr9DRl+
Yf8AZQBHTlUBtDhEU0EgZXhwaXJlZCBUZXN0IDxmbG93Y3J5cHQudGVzdC5rZXku
aW1wb3J0ZWRAZ21haWwuY29tPoiWBBMRCAA+FiEE0pDJ8wgIHwbEEgS2/n21JcE3
UVsFAl+32zECGwMFCQABUYAFCwkIBwIGFQoJCAsCBBYCAwECHgECF4AACgkQ/n21
JcE3UVsGpQD+NwkxYa8G/1JowFbXOHPAakmbmMSm3eg8Y0xNxwJf7ucBAJZN2Z6G
njJhmcaQZFxjvk6m8AccnpWi4E7vq8WJEPH0nQJrBF+32zEQCACboIxZ6209DZ6U
M5oZIDGx/7FoK45mTnDrCAM4hzliKViVn6tnrwCPeY+T1kbIuHE/gU9n0YTHD8Jt
uonevefg4MPLP20KyeTN2A4ggSKKEHgYbPc160T3hFAFL9tbYxALkbvi4GEoNTTS
TNVJ2WTUpbj2CRiYgXbYAZ/6Svb8fqJ2KNJzXczWPObqTLOQ51UScuINcRkftCv0
qveCoDtSpjrCXXOgmPhIl1R62P256YraBJqiHcEiVbu9FWhrySGFY0X9Yl3A1XlR
wFfUfKgjPG3fnclBKmW/gwkqXwe6w7sekXujGJHJOAbm8lSccfy0g40WJjxcQ2Ww
xsTsQppPAAMFCACVPpTnP3mto5B7i5ATKYKlwRHWRpmNEq+7zkWooxfjX6B0QZBk
oIHfUUNWDtr/GmVkE9iwDqKEJsTE+Q/unK6w6FAhKGHvtBeUhZSWLkNZJMkfxJu/
M4/UeD4YeUjKwGaF1toHaHjZGyuuj1Usuqr6bxfyxKJScGHgFSNFLl8uR1n0T0CM
N59/SNbQdQr28sC2S9HLtS0Zpsx8IcGiQQdBK83Y19I8luGgVyBlcjuWq33P4JhR
PQfmMclvjmTVCMt0Z9mI/ZbBR9LmY/hya4hRdn1RhBq1SVF5GYzR9eawZlAMVRKp
ztgQVpo8lI9WtglMfdyBJg8H7M8cDcJ5atBr/gcDAgGd+Pft47SSxbjINbh1coRW
Pew08VWATw7EFXj4o+csNhP6wp76Z8XCz9kOpTtiERbrhM41Pj1KPnuyDcT/m9CL
mfXszkVBgGVAXpI9TLJ6Ofo1sHYsYxQGo4h+BBgRCAAmFiEE0pDJ8wgIHwbEEgS2
/n21JcE3UVsFAl+32zECGwwFCQABUYAACgkQ/n21JcE3UVtmdAD/cwfwJUquz6WQ
tolRb1RIkSoBm4IgVS+PkLG2wt1GHVMA/1nhkJ6Veumyy4ldoSRdomImB9gjwHoC
qWT+qXqeh4nt
=/Vbx
-----END PGP PRIVATE KEY BLOCK-----`;

    const rsaExpiredPrimaryKeyIsMissingPrivateKey = `-----BEGIN PGP PRIVATE KEY BLOCK-----

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
jA==
=lAqt
-----END PGP PRIVATE KEY BLOCK-----`;

    ava.default('[KeyUtil.diagnose] decrypts and tests PK missing private key and SK with private key', async t => {
      const result = await KeyUtil.diagnose(await KeyUtil.parse(rsaPrimaryKeyIsMissingPrivateKey), '1234');
      expect(result.get('Is Private?')).to.equal('[-] true');
      expect(result.get('User id 0')).to.equal('Test1 (rsa) <flowcrypt.test.key.imported@gmail.com>');
      expect(result.get('Primary User')).to.equal('Test1 (rsa) <flowcrypt.test.key.imported@gmail.com>');
      expect(result.get('Fingerprint')).to.equal('6628 5F84 B985 71BD 01C0 18EE 8B3B B9CF C476 EE16');
      expect(result.get('Subkeys')).to.equal('[-] 1');
      expect(result.get('Primary key algo')).to.equal('[-] rsa_encrypt_sign');
      expect(result.get('key decrypt')).to.equal('[-] true');
      expect(result.get('isFullyDecrypted')).to.equal('[-] true');
      expect(result.get('isFullyEncrypted')).to.equal('[-] false');
      expect(result.get('Primary key verify')).to.equal('[-] valid');
      expect(result.get('Primary key creation?')).to.equal('[-] 1606140328 or 2020-11-23T14:05:28.000Z');
      expect(result.get('Primary key expiration?')).to.equal('[-] -');
      expect(result.has('Encrypt/Decrypt test: Encryption with key was successful')).to.be.true;
      expect(result.has('Encrypt/Decrypt test: Decryption with key succeeded')).to.be.true;
      expect(result.get('Sign/Verify test')).to.equal('[-] Exception: Error: Missing private key parameters');
      expect(result.get('SK 0 > LongId')).to.equal('[-] 0485D618EAA64B05');
      expect(result.get('SK 0 > Created')).to.equal('[-] 1606140328 or 2020-11-23T14:05:28.000Z');
      expect(result.get('SK 0 > Algo')).to.equal('[-] rsa_encrypt_sign');
      expect(result.get('SK 0 > Verify')).to.equal('[-] OK');
      expect(result.get('SK 0 > Subkey tag')).to.equal('[-] 7');
      expect(result.get('SK 0 > Subkey getBitSize')).to.equal('[-] 3072');
      expect(result.get('SK 0 > Subkey decrypted')).to.equal('[-] true');
      expect(result.get('SK 0 > Binding signature length')).to.equal('[-] 1');
      expect(result.get('SK 0 > SIG 0 > Key flags')).to.equal('[-] 12');
      expect(result.get('SK 0 > SIG 0 > Tag')).to.equal('[-] 2');
      expect(result.get('SK 0 > SIG 0 > Version')).to.equal('[-] 4');
      expect(result.get('SK 0 > SIG 0 > Public key algorithm')).to.equal('[-] 1');
      expect(result.get('SK 0 > SIG 0 > Sig creation time')).to.equal('[-] 1606140328 or 2020-11-23T14:05:28.000Z');
      expect(result.get('SK 0 > SIG 0 > Sig expiration time')).to.equal('[-] -');
      expect(result.get('SK 0 > SIG 0 > Verified')).to.equal('[-] true');
      expect(result.get('expiration')).to.equal('[-] undefined');
      expect(result.get('internal dateBeforeExpiration')).to.equal('[-] undefined');
      expect(result.get('internal usableForEncryptionButExpired')).to.equal('[-] false');
      expect(result.get('internal usableForSigningButExpired')).to.equal('[-] false');
      t.pass();
    });

    ava.default('[KeyUtil.diagnose] decrypts and tests secure PK and insecure SK', async t => {
      const result = await KeyUtil.diagnose(await KeyUtil.parse(testConstants.rsa1024subkeyOnly), '');
      expect(result.get('Is Private?')).to.equal('[-] true');
      expect(result.get('User id 0')).to.equal('rsa1024subkey@test');
      expect(result.get('Primary User')).to.equal('rsa1024subkey@test');
      expect(result.get('Fingerprint')).to.equal('B804 AF5A 259A 6673 F853 BEB2 B655 50F5 77CF 5CC5');
      expect(result.get('Subkeys')).to.equal('[-] 1');
      expect(result.get('Primary key algo')).to.equal('[-] rsa_encrypt_sign');
      expect(result.get('Primary key verify')).to.equal('[-] valid');
      expect(result.get('Primary key creation?')).to.equal('[-] 1611500681 or 2021-01-24T15:04:41.000Z');
      expect(result.get('Primary key expiration?')).to.equal('[-] -');
      expect(result.has('Encrypt/Decrypt test: Got error performing encryption/decryption test: Error: Error encrypting message: Could not find valid encryption key packet in key b65550f577cf5cc5')).to.be.true;
      expect(result.get('Sign/Verify test')).to.equal('[-] sign msg ok|verify ok');
      expect(result.get('SK 0 > LongId')).to.equal('[-] 1453C9506DBF5B6A');
      expect(result.get('SK 0 > Created')).to.equal('[-] 1611500698 or 2021-01-24T15:04:58.000Z');
      expect(result.get('SK 0 > Algo')).to.equal('[-] rsa_encrypt_sign');
      expect(result.get('SK 0 > Verify')).to.equal('[-] OK');
      expect(result.get('SK 0 > Subkey tag')).to.equal('[-] 7');
      expect(result.get('SK 0 > Subkey getBitSize')).to.equal('[-] 1024');
      expect(result.get('SK 0 > Subkey decrypted')).to.equal('[-] true');
      expect(result.get('SK 0 > Binding signature length')).to.equal('[-] 1');
      expect(result.get('SK 0 > SIG 0 > Key flags')).to.equal('[-] 12');
      expect(result.get('SK 0 > SIG 0 > Tag')).to.equal('[-] 2');
      expect(result.get('SK 0 > SIG 0 > Version')).to.equal('[-] 4');
      expect(result.get('SK 0 > SIG 0 > Public key algorithm')).to.equal('[-] 1');
      expect(result.get('SK 0 > SIG 0 > Sig creation time')).to.equal('[-] 1611500699 or 2021-01-24T15:04:59.000Z');
      expect(result.get('SK 0 > SIG 0 > Sig expiration time')).to.equal('[-] -');
      expect(result.get('SK 0 > SIG 0 > Verified')).to.equal('[-] true');
      expect(result.get('expiration')).to.equal('[-] undefined');
      expect(result.get('internal dateBeforeExpiration')).to.equal('[-] undefined');
      expect(result.get('internal usableForEncryptionButExpired')).to.equal('[-] false');
      expect(result.get('internal usableForSigningButExpired')).to.equal('[-] false');
      t.pass();
    });

    ava.default('[unit][KeyUtil.parse] correctly handles signing/encryption detection for PKSK with private keys', async t => {
      // testing encrypted key
      const encryptedKey = await KeyUtil.parse(rsaPrimaryKeyAndSubkeyBothHavePrivateKey);
      expect(encryptedKey.usableForSigning).to.be.true;
      expect(encryptedKey.missingPrivateKeyForSigning).to.be.false;
      expect(encryptedKey.usableForEncryption).to.be.true;
      expect(encryptedKey.missingPrivateKeyForDecryption).to.be.false;
      expect(await KeyUtil.decrypt(encryptedKey, '1234')).to.be.true;
      const armoredKey = KeyUtil.armor(encryptedKey);
      // testing decrypted key
      const key = await KeyUtil.parse(armoredKey);
      expect(key.usableForSigning).to.be.true;
      expect(key.missingPrivateKeyForSigning).to.be.false;
      expect(key.usableForEncryption).to.be.true;
      expect(key.missingPrivateKeyForDecryption).to.be.false;
      t.pass();
    });

    ava.default('[unit][KeyUtil.decrypt] correctly handles signing/encryption detection for PKSK with private keys', async t => {
      const dsakey = await KeyUtil.parse(dsaPrimaryKeyAndSubkeyBothHavePrivateKey);
      expect(await KeyUtil.decrypt(dsakey, '1234')).to.be.true;
      expect(dsakey.usableForSigning).to.be.true;
      expect(dsakey.missingPrivateKeyForSigning).to.be.false;
      expect(dsakey.usableForEncryption).to.be.true;
      expect(dsakey.missingPrivateKeyForDecryption).to.be.false;
      const rsakey = await KeyUtil.parse(rsaPrimaryKeyAndSubkeyBothHavePrivateKey);
      expect(await KeyUtil.decrypt(rsakey, '1234')).to.be.true;
      expect(rsakey.usableForSigning).to.be.true;
      expect(rsakey.missingPrivateKeyForSigning).to.be.false;
      expect(rsakey.usableForEncryption).to.be.true;
      expect(rsakey.missingPrivateKeyForDecryption).to.be.false;
      t.pass();
    });

    ava.default('[unit][KeyUtil.parse] determines PK missing private key for signing', async t => {
      // testing encrypted key
      const encryptedKey = await KeyUtil.parse(rsaPrimaryKeyIsMissingPrivateKey);
      expect(encryptedKey.usableForSigning).to.be.true;
      expect(encryptedKey.missingPrivateKeyForSigning).to.be.true;
      expect(encryptedKey.usableForEncryption).to.be.true;
      expect(encryptedKey.missingPrivateKeyForDecryption).to.be.false;
      expect(await KeyUtil.decrypt(encryptedKey, '1234')).to.be.true;
      const armoredKey = KeyUtil.armor(encryptedKey);
      // testing decrypted key
      const key = await KeyUtil.parse(armoredKey);
      expect(key.usableForSigning).to.be.true;
      expect(key.missingPrivateKeyForSigning).to.be.true;
      expect(key.usableForEncryption).to.be.true;
      expect(key.missingPrivateKeyForDecryption).to.be.false;
      t.pass();
    });

    ava.default('[unit][KeyUtil.decrypt] determines PK missing private key for signing', async t => {
      const dsakey = await KeyUtil.parse(dsaPrimaryKeyIsMissingPrivateKey);
      expect(await KeyUtil.decrypt(dsakey, '1234')).to.be.true;
      expect(dsakey.usableForSigning).to.be.true;
      expect(dsakey.missingPrivateKeyForSigning).to.be.true;
      expect(dsakey.usableForEncryption).to.be.true;
      expect(dsakey.missingPrivateKeyForDecryption).to.be.false;
      const rsakey = await KeyUtil.parse(rsaPrimaryKeyIsMissingPrivateKey);
      expect(await KeyUtil.decrypt(rsakey, '1234')).to.be.true;
      expect(rsakey.usableForSigning).to.be.true;
      expect(rsakey.missingPrivateKeyForSigning).to.be.true;
      expect(rsakey.usableForEncryption).to.be.true;
      expect(rsakey.missingPrivateKeyForDecryption).to.be.false;
      t.pass();
    });

    ava.default('[unit][KeyUtil.parse] determines missing private key for encryption in expired key', async t => {
      const dsakey = await KeyUtil.parse(dsaExpiredPubkeysOnly);
      expect(dsakey.usableForEncryptionButExpired).to.be.true;
      expect(dsakey.usableForSigningButExpired).to.be.true;
      expect(dsakey.usableForSigning).to.be.false;
      expect(dsakey.usableForEncryption).to.be.false;
      expect(dsakey.missingPrivateKeyForSigning).to.be.true;
      expect(dsakey.missingPrivateKeyForDecryption).to.be.true;
      const rsakey = await KeyUtil.parse(rsaExpiredPubkeysOnly);
      expect(rsakey.usableForEncryptionButExpired).to.be.true;
      expect(rsakey.usableForSigningButExpired).to.be.true;
      expect(rsakey.usableForSigning).to.be.false;
      expect(rsakey.usableForEncryption).to.be.false;
      expect(rsakey.missingPrivateKeyForSigning).to.be.true;
      expect(rsakey.missingPrivateKeyForDecryption).to.be.true;
      t.pass();
    });

    ava.default('[unit][KeyUtil.decrypt] handles PK missing private key for signing in expired key', async t => {
      const dsakey = await KeyUtil.parse(dsaExpiredPrimaryKeyIsMissingPrivateKey);
      expect(await KeyUtil.decrypt(dsakey, '1234')).to.be.true;
      expect(dsakey.usableForEncryptionButExpired).to.be.true;
      expect(dsakey.usableForSigningButExpired).to.be.true;
      expect(dsakey.usableForSigning).to.be.false;
      expect(dsakey.usableForEncryption).to.be.false;
      expect(dsakey.missingPrivateKeyForSigning).to.be.true;
      expect(dsakey.missingPrivateKeyForDecryption).to.be.false;
      const rsakey = await KeyUtil.parse(rsaExpiredPrimaryKeyIsMissingPrivateKey);
      expect(await KeyUtil.decrypt(rsakey, '1234')).to.be.true;
      expect(rsakey.usableForEncryptionButExpired).to.be.true;
      expect(rsakey.usableForSigningButExpired).to.be.true;
      expect(rsakey.usableForSigning).to.be.false;
      expect(rsakey.usableForEncryption).to.be.false;
      expect(rsakey.missingPrivateKeyForSigning).to.be.true;
      expect(rsakey.missingPrivateKeyForDecryption).to.be.false;
      t.pass();
    });

    ava.default('[unit][KeyUtil.parseBinary] handles OpenPGP binary key', async t => {
      const key = Buffer.from('mDMEX7JGnBYJKwYBBAHaRw8BAQdA8L8ZDEHJ3N8fojA1P0n9Tc2E0BTCl6AXq/b2ZoS5Evy0BlRl' +
        'c3QgMYiQBBMWCAA4FiEExOEH3ZJIrCG1lTnB5pbLkt3W1hMFAl+yRpwCGwMFCwkIBwIGFQoJCAsC' +
        'BBYCAwECHgECF4AACgkQ5pbLkt3W1hOHzAEAj3hiPLsaCeRGjLaYNvKNTetdfGLVSu2+cGMsHh8r' +
        '+pgBANNxQyqE5+3LjHhecVVNErbgr1n6vTurE5Jhc1Go3x8F', 'base64');
      const parsed = await KeyUtil.parseBinary(key, '');
      expect(parsed.length).to.be.equal(1);
      expect(parsed[0].id).to.be.equal('C4E107DD9248AC21B59539C1E696CB92DDD6D613');
      t.pass();
    });

    ava.default('[unit][KeyUtil.parseBinary] handles PKCS#12 binary key', async t => {
      const key = Buffer.from(`MIIQqQIBAzCCEG8GCSqGSIb3DQEHAaCCEGAEghBcMIIQWDCCBo8GCSqGSIb3DQEHBqCCBoAwggZ8AgEAMIIGdQYJKoZIhvcNAQcBMBwGCiqGSIb3DQEMAQYwDgQIRH4NrqNQHA4CAggAgIIGSJW1vMxm5bcaOvPk7hoCKw3YTD+HBOI8LJ8YTYlFMHquJ9NvV0Ib/N0Y7NXP/KYERjaHwjy5cPvAtOWjyNRgVAe/r74TubRSVsizBWNbBKcpi8+Ani4jLCQ+zUeYKYqCYFfld/3NL/Ge0gB6K3TPacuWRdfGXk20htpyGbjZPuCXs1eYHQ6ekUvlpDaEA6n87Tkl4jF3xkz5nr8rfkvmZphvrLH/L6KiJX9wK6VqeTvowYukWQrdkklLVfxBWUdNHRxDqbUXZXkfCdixyKUlD4S9NbBqSbfgx9s951G23lUHnCBqdOzUqSFcLA7o0v0VrD5fYwuVk6tR8S63P3PJD5IrWgZV0hg4k8SVVZd++5khO61J6qBg8gGmYFclwc7itr8LxUCgSZUzJs0u+GGe9vM4IV2l3p/ywuimui21R9rWHExtvjJYkkpjkEcoqws40mQHQ6c8RLYmqGjC+WdqanJHBh8dFWQtZYISfLV2cFtg7ZOUot2LEIr9fZ1By+D+YudRUhzhk2/SPnQAay1zteXVPIzHqBjXIxR2LPd1YMadckEqTSlEz/9y0qukH2UE2RmW/GnjWVMSKZATfk7C1n4vSrw/7M+mVT0F7rjo3f1MObwzblkK9As96atdF/WWMyVZrN+xfltQscP+cCexpGSQi1I18lqTzcgIRye9dW1O3sCi7ygVQWfcweXq1f5CoknN76zxruiHFhOaqDKM1txcKdZJkQ6Lfmj1M6N+Hw3secHoOU/K21PNVLO+3/uRh04ebW9uweJA7aIHnypqzim47EBDCoquz0SMluYrEbSJKkNrjnAIadJ0s4UaYRV+dwh6ENY6lH8nWrYw54WMMxxIE80cpNoaf0lO6QDTdxY1mkFyNRQO5fbdsltMaemgyzct66UB38MkOawtRa0smd6MUuwaJlQ1tgBOpuuFX2ztojdeTmDQPgta3UPYv+rj3O1ePKBGBxsaq/aodIasLwYVCkpCtHJbzF+ILr3/a9h3QPbTrC5ysxfp8vteJFEBaU7UU2+LvY5tT+LI9YqBIxWOF4N+VnV+WFAv9WsrgfIE4VWYGxjDX6J8aw3Z/qGdqz7z7DcpcrDUKGo8/xQPogsA0x8QudWTEWdKhwdf+31UFoZiArrH5t4NPzsPikZzE+bCVZYwsKeE9nMfjNDxR+47G9lpOPfaX5fyryXWGofT19HMHbshBMtHoE80e7DSVrJr1odeN9iiOMC8EBr3l+HRaQ9JV90fylCvrempDGEWB/czljpWH+ud0pkHy5AT74zDp4OtwsisBsHI8x0kzA1pGnNhSGDOMdZ4cwC4N+GgfZ6/OIHpeDyiSvD5Xk2dT31U0CVrOK6KicaUwuLRkE+zSZNwnT/dNyawC61dhL1v2sAxGYti3pZ2sxHuEfdnassLQkkUEWXuS0WKgRc9q8oS296rsyD5wIrpU+jgUSNvrN1RLE879qT4MwKhOXI6StyVKtm9msVgrxe9bfOIeqHlK7emS/6dagR5kYoEECsOIDU7LfKnj+zXe6GzlxxIafN7h/g0HnPXfiGfM+z4spq95d7IBCMvI0of3+uFgACXN00l1iGm32NC0ZQ39+ZdQ//rSgxmZdSZhe6oKrgwJfxCjnaRPj7ky+T4Q2QQt4TLcDqrheEoc19rL8ueEo1rHMYbu9zwThPfswng7ZfWY5Fh1zxdhE2eUQA6pd2QRuzcW5o3cPS29dK9Yi4K3cwu/wUegkQJW2ON50K7bjMKt/3h0R0Zwi+lAx81NKvBNc2r7SI9dpGhpM2qkCQT0YMu+ZwlYXHfPjs2yCjL0vc3fWYSxRmmMEsLGIwSJHBbg6RCcJvlMxVOVK1v4GP70sga/gHRW8/+2HCwiVkmMkFqesNP/7GFYfbRvOzM8H6uooYicpFmeCSQxlK3beRHaO8EQo+iuwUDZQWz/4aQt4uOpUg6mt/cOD81BZ33TD9ttPynk5favdKMEzibL1QyIuZ54sGlBpTgGgHUHA9TmqdaNfVkGbAUXpoGRm7LjOZ3M+jNnHLG4TPOX7qyaYcHxoT+RSGEFvjXSvZXUsbbF0MGy3iAawAUHbqP6aiN1joeQ5duzqvlV5yswCStwCaXuuFkj1//BZn304aG5RUPw//5CAEIo7XQIvLoqjCCCcEGCSqGSIb3DQEHAaCCCbIEggmuMIIJqjCCCaYGCyqGSIb3DQEMCgECoIIJbjCCCWowHAYKKoZIhvcNAQwBAzAOBAgow96Pb9dRqgICCAAEgglIw41Sx1K7v1GHSdXd00xK6UlPnmO9fQcQACWq3Qp869er/ssLxXciqJ4Td4DUjh6utUF7Y9oh2gceUaYzmj4/6A1hV90ARBTlGnhw+xEBjKybti1pE7zdOG6TwOUDK02mLlwjaVLMLVx93P34etM0q7jroIWcmNrkwpGqjidc88CbV2N0dNhJxn6v0qgpZetMyjqNYfK/45nJxT4J1Xcldd2q7117eyYoLgc6Cu4py74S8ENtxjmT3zfreYanP35Ms6o/11i+cnvcNmIDqf9k1Qz3hlNd6bqTGghL11Mmc5CYjm7iCyY3lLlHixE4/QeKL6uZrqdK2uMYiRkbkLkGy85+AKrducNC09eXDAhyYRUZo5uSOnvLS/DcK/R27eXNZKnFHCiVmeZ4u5Z/vTmI3TcbmbZKFPvVJWcLYGeJXR67IiaEc9Up5YArr55fqHbMQWR4zBCWfuY/Xm26TKgI3yQiVIrXT4FnxMg29jQWt44y/BLsn1A/PrqtfkRci9Kn5MrAXfkN4/Dxkjw2Hyr9QUjJOxbPOFc3Er4/fzNImL4/3ESadRtQGqeZc6Ph/wXEC1wSU9IyP9MnWz9R8w/JaLbPIaviPnmT+TbZhO883a7EpugTReJRzFLwUKORTFBvB1qry8cH03ZouIUnjKjEKWTNaQSUuYiNCtR+tEAXWeBX/RwfIKpADeCJ1015bK2UXjV24FuShKZvyfGfMeWuTHOQ8a6Ugh5d8uhhYtDU081RS1dyaMRmRyLZz0f/Vzwbd6PfTRthd7v4WIueJKrqbgjMmf56s1nCiRqS614nHUXZ+U62qxn4DnIlYSpBBPpAfucUyZ4fxepb5qj3S3ZsmhF9CCK03RZtvY/s3w+aJXs4qq3d4h8oVozL1qeGszzu6OjpKAbGbaR8SsWb8GkRRfA4WEw6pWaxgSWNSro3YvwjljQ1Ab1oQTs/9F0VGWwDzA3k0meNfxtv4UfReWaUuMyqD2riRG9TW49tYNpRNDpsKXIEj+msZPvG5B9qvjj0Dg4OLVa5oI3oJkPC+X6jP+Ovm0m/N5KgDnPf3SCUrYwE8IJxIq3LiY4v4R0XJbLTGstfxrnKZ21wDzBZfrGTFWbRPoh/3SchmlC/v59/cLWY+VLzBT7vkQ+8PHnDj7tJZa47U/gibvDc4JgRbdkvlAJrA6Z8a1pEWcEJpxSLdQbuJ+ahA/sJvoPkGZ45jVhXAUn1HKeRsykwSNOZwkzhIKQ6deXOi12nTbY9EkPP2J3NMJkwoPlbVUEH+/IEJ/63qOQf+ihv0TwVBE48tl3WzuqlpDt23f/b617Lp7g6nUB9TGafBvUZCK08tJM4V9J8drtAN7hwMxSrr2Rpyy4na5ZweJv1j8XanSdP+X9qicBv1iNNj7wrr55MoGqCjse8WNqUZtdIRQ+k8cjlYPYs/ADCyXx0l2DEAczqSL15r/OnO5K3qYgfOE6o73cfZcWpJhyIDoshWV+EK9YWlxOmlYWUE+Zcx7+UsQs21xNqiVBzVJK+6Ax4GJmwDUYarMK1Cz02HgInIaGpP7DOtI//LcLh7sECP+moT/6KXIo60KNvMJEJlh3vrpl8AEK8nZ5xxPucyHX/XHo3o4PErfICHwaw7t5PQQ690PlAsa2bIrD4n5Aw6MKK23mx4KRYHBYWwRLXze6AmOHl6sHZ9sIO8w0IWGZtD3WU5wwAaXmgcjrIeUvaqpoLQZAiXIbgwfetPgjQI9NlLjaw6UK42NhYlg6e+Cr3HvcLRv/pJVS7HZZDPyBfJ0GYpkBzO0eze0OQR3+JvDKAxaQFVq/cb7Lf0aia0+a1bxnO+fh+cHHMnOVcUPlN7RPprF65vENjDzwPd4RRfT5ypQd0QqyMm2EzdXY9qzfcxmxh417vYEolXosmnyCY778dNSmJJIhXLfnqUNmyUBISjgidgH6Wl2L04HDCPjryybQz4JO6Dz8em80hG84spu2iSw56h7QaAesYj9tQhok4UX12MXsY1dl1bmTesukDXcfJjfv2BkDHVzlEncFffYoNKQaViABX+cgzJvAS6sGJPicUUl55et0AOsTDPZvvySbi3X5+Y+vvI1cwozEFbZkXdptWlmbIXRWuDtcDOsSTGMIhd2gJW4UyuJmc2UztuIa5x28YJGNPxYoG4TCcPd2V9gg1jL9tAUTwq9Jrel4Zp0Z8RY5uSRudso83Ap7a2WspvkDkHgIZ3p6DASkd+dzoVPObz5TLrNSioVU0p+bPPzI+Z0tavho9phqZq6g7HysETb5wVndoZOs78E9/kwHjyVibLI4ghB0EQSmkOxgT0RhQcNaMWCfbgTetZrtSEDFjTI3hmGRQ7T6ALicpiOE1T8m9IAwKkmC2n1vIZBfp/qSUa/B+SLZugoTKFcxbsXxqRvdgQJepF8F9qqNXXbtnXg7PX0TsEvRMjfOa7uPw+vlIc4g//svNU9XwYSC10J1KG3y1YUArbaJXXZGU+Mbliwe4n+kzQYbTpiUwX8WfSeZiFbCQgK0Qoqc1lMZ4tuJXfZyG2x+BtVsYIOLcnnxVIcM7FBdZ1fqRMuwxV2leiwqXFiCaAmh9dXZYz41FkD25UzAxwVlbvxskerehhDuEVlajY1py3f7dOKM3jwWF5Ftbvs50zlscyDNSjQtaDmBwx1TfR8kWwQjOI/zHu+gJOBxlm+SjxIEILOipaLEfq9/rV4AXIhyKq8fc2IkEYLKG89gPwAqi8dYDYpAWM/WjZjKwx3x31xwA7DLZycEzbl77favLfhDFOhsgZqFiG/4OhSk7/7en44Dyr/NXD/t4mRxAuhTajUt5V9SK6VuaquPNT7LJGQ8EnAYC74gE1IVIdR1KrDddNFocoq6GAlC7xoI62noYeEwcEfbzkTRKvu1b7+q+NS/0l/v8/iGmSPOPQ47BwbTGK/Tq2HnA8QYx4f2gi3X43ox7cy+GfGm7xOPmGbqJz1HDx3oCrDz0LiFXt0JKJ8XsfnbHHgD6P/TR19oQbVbhESt7OdftqwHTiBd7Cz+yg9nGp6znhGK/LOZlhFrb/E8dXPZOsj3s4/yf6ry8l/isKyfiBw5Y6i/aB9tSXrZ0sZ8NPSmyaSJbzolDfSV7MqSWZfwt7jv5P0RdOOy6G2knmXUcF3ys6uRKSNAlo3iC20kjRVbyPgZqBzi2MSUwIwYJKoZIhvcNAQkVMRYEFJ2NnbXtly3Wm4JXdJHjiCwHmr89MDEwITAJBgUrDgMCGgUABBSDibEh/MQX3YVQrTUgcjUCFtzaoQQIeNCS6r7MZ+wCAggA`, 'base64');
      const parsed = await KeyUtil.parseBinary(key, 'test');
      expect(parsed.length).to.be.equal(1);
      expect(parsed[0].id).to.be.equal('25639FA393D577A074F9E4146F74195213042417');
      expect(parsed[0].type).to.be.equal('x509');
      expect(parsed[0].emails.length).to.be.equal(1);
      expect(parsed[0].emails[0]).to.be.equal('test@example.com');
      expect(parsed[0].isPrivate).to.be.equal(false);
      expect(parsed[0].isPublic).to.be.equal(true);
      t.pass();
    });

    ava.default(`[unit][OpenPGPKey.parse] sets usableForEncryption and usableForSigning to false for RSA key less than 2048`, async t => {
      const rsa1024secret = `-----BEGIN PGP PRIVATE KEY BLOCK-----

xcEYBGAID1EBBACypl5K0IoqFjfpSrIhbhT5H5MjQg4MKRlgMfqXjo8pEeB6Yf88wvBni36iRdSn
ovc7mbuOSPc+Z8ABqGPdW5AWs6K/gchWyIzuDQ32pRfUKc9SAAs0Ddyv/+S4XKUCLdX88yUsjnnK
8beHnju57bIsiamo19HqsfZKJUQb4ZS33wARAQABAAP+M5ZH/ymV5A5Tadnocy/S/ZcpCVLfNJK/
oZ/9ATuoyk6/uAdJSVXvTq8gy6IHhLrR0pOTbcRTJOGXt8LUx4xToEcHw1uTIVmtw7EtDQdMPyKC
HjFbIAhWGXbefQItohKBEDfucXgwI0YpNdIjk6mFc0IO6/XUIQg1bMg/UK0HA80CANEI9OQDNgAR
caikGHAl672KWBwTBM8XgytF7D+Bzt41eElKswMFYyMlRzZlSmkx3sJ+XdCHuC0skQIluV181EsC
ANrJwSfyOsPhqQ+GjNdg8uPEdLvIK6CLdMwEelvGPkXuyq58ACCgiFKlir2taNqfQfD+V1XGWqLy
rzSplwgZJj0B/3EIZSiM8oC9eBsq9Eo29d/wEkspz14qsQsvl6IEAQzk6utsmWRViLrkijVPOTgb
ZbQm646+Japkh+lC1uz4F7WXK80McnNhMTAyNEB0ZXN0wsAIBBMBCAAzFiEE6aCtchH+fjctzmKs
Zywk4TigN/QFAmAID1ICGwMFCwkIBwIGFQgJCgsCBRYCAwEAAAoJEGcsJOE4oDf0LCwD+My9gLrB
B3bjq694Yx5H6aLayc79fm6aL3bEBJGD6EQMqGTbN+Gfz6JcpCzOBW7Jn9Jc5PC+4d0JxK7TzBXE
SxM2ViraS5ScW3GuqVoAw00/0NRYrXr7iTkzT8gAdEBNXdn/ozlCrNkR8JxOmcyqJtTwPkzMRy9D
MtbTz6xoGaPHwRgEYAgPUgEEAN5qHMlEB1uwxr/bEL4ZWcSvEFRP7hSC2isB9JlomACDPHRQAi5q
dOXaP3BD81mVm3FRKtc6UuLao641+RNmiTrDSKpmB7MIPRS4tO4DIBDj4g7xz0AXHs+OYqBi2+iU
Hy0dclP6TP2dWE1fT7bgfD3GaaKri6Zgfb5ZLQ+bGL03ABEBAAEAA/9uU5q1563yuKzOLJ+QfMi/
vMtP11pVCFeqb8zicDS+RFsvoySB28Li5bEEQmCrNoAl5MpoewD0kNoSp6lHC1zUQQymouefK/W3
pD8bNcFRzpQ1m4iVkEG1o6Joq1wxQe+OHbxDxil8VluAGMWdXSzPUFH/JYu7z819E8C3NO0ZcQIA
3nnloE/O6k382CLYEkEu2aXownXlhtuCNslif4vUMRePZvPTD93lUHnFZ0ZZcJTMq4YdFcuXlyZI
2XlnHfe3nwIA/+3WRADntAcFFp/3HMSl1Jua9ic89rABgXXZqvxhy2cu+9wZR+GpHjZy9Pm/kOHS
wjl+nI4Q6pQcdxCYn75zaQIAi8KOAoDDeNC8wjUS2FN84/2Asc78D0MQc442CqCQ70It8csDTanH
xamPFeub/1JW7H0hkma1C5CEi2coHjeAbambwrYEGAEIACAWIQTpoK1yEf5+Ny3OYqxnLCThOKA3
9AUCYAgPUwIbDAAKCRBnLCThOKA39O3dA/0RALQ6Sp35YWvHN4iYvInO9DZIEvaSBjpzNNDThRvp
XfiBZBgRV34sZ8IjBXWnHmnJOioXG0LnZ7V37Zpa1PnPcqKd5kXg649NS+jXqyd7yjgIhyhB54VC
r7V4UalYBHeiwKQhzrU8KfaVfVaYu7ctfitV5Ba/8SqxrblMAZAV6A==
=pcI4
-----END PGP PRIVATE KEY BLOCK-----`;
      const key1 = await KeyUtil.parse(rsa1024secret);
      expect(key1.usableForEncryption).to.equal(false);
      expect(key1.usableForSigning).to.equal(false);
      expect(key1.usableForEncryptionButExpired).to.equal(false);
      expect(key1.usableForSigningButExpired).to.equal(false);
      const rsa1024public = `-----BEGIN PGP PUBLIC KEY BLOCK-----

xo0EYAgPUQEEALKmXkrQiioWN+lKsiFuFPkfkyNCDgwpGWAx+peOjykR4Hph/zzC8GeLfqJF1Kei
9zuZu45I9z5nwAGoY91bkBazor+ByFbIjO4NDfalF9Qpz1IACzQN3K//5LhcpQIt1fzzJSyOecrx
t4eeO7ntsiyJqajX0eqx9kolRBvhlLffABEBAAHNDHJzYTEwMjRAdGVzdMLACAQTAQgAMxYhBOmg
rXIR/n43Lc5irGcsJOE4oDf0BQJgCA9SAhsDBQsJCAcCBhUICQoLAgUWAgMBAAAKCRBnLCThOKA3
9CwsA/jMvYC6wQd246uveGMeR+mi2snO/X5umi92xASRg+hEDKhk2zfhn8+iXKQszgVuyZ/SXOTw
vuHdCcSu08wVxEsTNlYq2kuUnFtxrqlaAMNNP9DUWK16+4k5M0/IAHRATV3Z/6M5QqzZEfCcTpnM
qibU8D5MzEcvQzLW08+saBmjzo0EYAgPUgEEAN5qHMlEB1uwxr/bEL4ZWcSvEFRP7hSC2isB9Jlo
mACDPHRQAi5qdOXaP3BD81mVm3FRKtc6UuLao641+RNmiTrDSKpmB7MIPRS4tO4DIBDj4g7xz0AX
Hs+OYqBi2+iUHy0dclP6TP2dWE1fT7bgfD3GaaKri6Zgfb5ZLQ+bGL03ABEBAAHCtgQYAQgAIBYh
BOmgrXIR/n43Lc5irGcsJOE4oDf0BQJgCA9TAhsMAAoJEGcsJOE4oDf07d0D/REAtDpKnflha8c3
iJi8ic70NkgS9pIGOnM00NOFG+ld+IFkGBFXfixnwiMFdaceack6KhcbQudntXftmlrU+c9yop3m
ReDrj01L6NerJ3vKOAiHKEHnhUKvtXhRqVgEd6LApCHOtTwp9pV9Vpi7ty1+K1XkFr/xKrGtuUwB
kBXo
=PeOs
-----END PGP PUBLIC KEY BLOCK-----`;
      const key2 = await KeyUtil.parse(rsa1024public);
      expect(key2.usableForEncryption).to.equal(false);
      expect(key2.usableForSigning).to.equal(false);
      expect(key2.usableForEncryptionButExpired).to.equal(false);
      expect(key2.usableForSigningButExpired).to.equal(false);
      t.pass();
    });

    ava.default(`[unit][OpenPGPKey.parse] sets usableForEncryption to false and usableForSigning to true for 2048/RSA PK and 1024/RSA SK`, async t => {
      const key = await KeyUtil.parse(testConstants.rsa1024subkeyOnly);
      expect(key.usableForEncryption).to.equal(false);
      expect(key.usableForSigning).to.equal(true);
      expect(key.usableForEncryptionButExpired).to.equal(false);
      expect(key.usableForSigningButExpired).to.equal(false);
      t.pass();
    });

    ava.default(`[unit][OpenPGPKey.decrypt] sets usableForEncryption to false and usableForSigning to true for 2048/RSA PK and 1024/RSA SK`, async t => {
      const key = await KeyUtil.parse(testConstants.rsa1024subkeyOnlyEncrypted);
      expect(key.usableForEncryption).to.equal(false);
      expect(key.usableForSigning).to.equal(true);
      expect(key.usableForEncryptionButExpired).to.equal(false);
      expect(key.usableForSigningButExpired).to.equal(false);
      expect(await KeyUtil.decrypt(key, '1234')).to.be.true;
      expect(key.usableForEncryption).to.equal(false);
      expect(key.usableForSigning).to.equal(true);
      expect(key.usableForEncryptionButExpired).to.equal(false);
      expect(key.usableForSigningButExpired).to.equal(false);
      t.pass();
    });

    ava.default(`[unit][PgpArmor.dearmor] throws on incorrect sequence`, async t => {
      await expect(PgpArmor.dearmor(`-----BEGIN PGP MESSAGE-----

AAAAAAAAAAAAAAAAzzzzzzzzzzzzzzzzzzzzzzzzzzzz.....`)).to.eventually.be.rejectedWith('Misformed armored text');
      t.pass();
    });

    ava.default(`[unit][PgpArmor.dearmor] correctly handles long string`, async t => {
      const source = Buffer.from('The test string concatenated many times to produce large output'.repeat(100000));
      const type = 3;
      const armored = PgpArmor.armor(type, source);
      const dearmored = await PgpArmor.dearmor(armored);
      expect(dearmored.type).to.equal(type);
      equals(
        dearmored.data,
        source
      );
      t.pass();
    });

  }
};
