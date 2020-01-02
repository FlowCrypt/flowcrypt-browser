/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import * as ava from 'ava';
import { Buf } from '../../extension/js/common/core/buf.js';
import { expect } from 'chai';

// @ts-ignore
global['btoa'] = (binary: string): string => Buffer.from(binary, 'binary').toString('base64'); // tslint:disable-line:no-string-literal
// @ts-ignore
global['atob'] = (b64tr: string): string => Buffer.from(b64tr, 'base64').toString('binary'); // tslint:disable-line:no-string-literal

const lousyRandomBytes = (len = 30): Uint8Array => {
  const a = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    a[i] = Math.floor(Math.random() * 256);
  }
  return a;
};

const withThousandRandomInputs = (cb: (data: Uint8Array) => void) => {
  for (let i = 0; i < 1000; i++) {
    const input = lousyRandomBytes();
    cb(input);
  }
};

const UTF8 = `გამარჯობა.\nこんにちは。\nЗдравствуй.\nChào bạn.\nDobrý deň!\n여보세요?\n你好。\r\n\t。 `;
const UTF8_AS_BYTES = Buffer.from(UTF8);
const UTF8_AS_RAW_STRING = Buffer.from(UTF8).toString('binary');

const equals = (a: string | Uint8Array, b: string | Uint8Array) => {
  expect(typeof a).to.equal(typeof b, `types dont match`);
  if (typeof a === 'string' && typeof b === 'string') {
    expect(a).to.equal(b, 'string result mismatch');
    return;
  }
  if (a instanceof Uint8Array && b instanceof Uint8Array) {
    expect(Array.from(a).join('|')).to.equal(Array.from(b).join('|'), 'buffers dont match');
    return;
  }
  throw new Error(`unknown test state [${typeof a},${typeof b}] [${a instanceof Uint8Array},${b instanceof Uint8Array}]`);
};

ava.default(`1000x Buf.fromUint8(data).toBase64Str() = Buffer.from(data).toString('base64')`, async t => {
  withThousandRandomInputs(data => {
    equals(
      Buf.fromUint8(data).toBase64Str(),
      Buffer.from(data).toString('base64'),
    );
  });
  t.pass();
});

ava.default(`1000x Buf.fromUint8(data).toRawBytesStr() = Buffer.from(data).toString('binary')`, async t => {
  withThousandRandomInputs(data => {
    equals(
      Buf.fromUint8(data).toRawBytesStr(),
      Buffer.from(data).toString('binary'),
    );
  });
  t.pass();
});

ava.default('1000x Buf.fromBase64UrlStr(Buf.fromUint8(data).toBase64UrlStr()) = data', async t => {
  withThousandRandomInputs(data => {
    equals(
      Buf.fromBase64UrlStr(Buf.fromUint8(data).toBase64UrlStr()),
      data,
    );
  });
  t.pass();
});

ava.default('1000x Buf.fromRawBytesStr(Buf.fromUint8(data).toRawBytesStr()) = data', async t => {
  withThousandRandomInputs(data => {
    equals(
      Buf.fromRawBytesStr(Buf.fromUint8(data).toRawBytesStr()),
      data,
    );
  });
  t.pass();
});

ava.default('1000x Buf.fromBase64Str(Buf.fromUint8(data).toBase64Str()) = data', async t => {
  withThousandRandomInputs(data => {
    equals(
      Buf.fromBase64Str(Buf.fromUint8(data).toBase64Str()),
      data,
    );
  });
  t.pass();
});

ava.default('Buf.fromUtfStr(UTF8) = UTF8_AS_BYTES', async t => {
  equals(
    Buf.fromUtfStr(UTF8),
    UTF8_AS_BYTES,
  );
  t.pass();
});

ava.default('Buf.fromUint8(UTF8_AS_BYTES).toUtfStr() = UTF8', async t => {
  equals(
    Buf.fromUint8(UTF8_AS_BYTES).toUtfStr(),
    UTF8,
  );
  t.pass();
});

ava.default('Buf.fromRawBytesStr(UTF8_AS_RAW_STRING).toUtfStr() = UTF8', async t => {
  equals(
    Buf.fromRawBytesStr(UTF8_AS_RAW_STRING).toUtfStr(),
    UTF8,
  );
  t.pass();
});

ava.default('Buf.fromUtfStr(UTF8).toRawBytesStr() = UTF8_AS_RAW_STRING', async t => {
  equals(
    Buf.fromUtfStr(UTF8).toRawBytesStr(),
    UTF8_AS_RAW_STRING,
  );
  t.pass();
});

ava.default('Buf.fromRawBytesStr(UTF8_AS_RAW_STRING) = UTF8_AS_BYTES', async t => {
  equals(
    Buf.fromRawBytesStr(UTF8_AS_RAW_STRING),
    UTF8_AS_BYTES,
  );
  t.pass();
});

ava.default('Buf.fromUint8(UTF8_AS_BYTES) = UTF8_AS_RAW_STRING', async t => {
  equals(
    Buf.fromUint8(UTF8_AS_BYTES).toRawBytesStr(),
    UTF8_AS_RAW_STRING,
  );
  t.pass();
});
