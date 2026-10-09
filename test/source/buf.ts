/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import './node-runtime-polyfills';
import test from 'ava';
import { Buf } from '../../extension/js/common/core/buf.js';
import { equals } from './tests/unit-node.js';

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

test(`1000x Buf.fromUint8(data).toBase64Str() = Buffer.from(data).toString('base64')`, async t => {
  withThousandRandomInputs(data => {
    equals(Buf.fromUint8(data).toBase64Str(), Buffer.from(data).toString('base64'));
  });
  t.pass();
});

test(`1000x Buf.fromUint8(data).toRawBytesStr() = Buffer.from(data).toString('binary')`, async t => {
  withThousandRandomInputs(data => {
    equals(Buf.fromUint8(data).toRawBytesStr(), Buffer.from(data).toString('binary'));
  });
  t.pass();
});

test('1000x Buf.fromBase64UrlStr(Buf.fromUint8(data).toBase64UrlStr()) = data', async t => {
  withThousandRandomInputs(data => {
    equals(Buf.fromBase64UrlStr(Buf.fromUint8(data).toBase64UrlStr()), data);
  });
  t.pass();
});

test('1000x Buf.fromRawBytesStr(Buf.fromUint8(data).toRawBytesStr()) = data', async t => {
  withThousandRandomInputs(data => {
    equals(Buf.fromRawBytesStr(Buf.fromUint8(data).toRawBytesStr()), data);
  });
  t.pass();
});

test('1000x Buf.fromBase64Str(Buf.fromUint8(data).toBase64Str()) = data', async t => {
  withThousandRandomInputs(data => {
    equals(Buf.fromBase64Str(Buf.fromUint8(data).toBase64Str()), data);
  });
  t.pass();
});

test('Buf Base64 input handling', t => {
  for (const encoded of ['', 'Zg', 'Zg==', 'Zh==', 'Zm9v', ' Zm9v\n']) {
    const expected = Uint8Array.from(atob(encoded), char => char.charCodeAt(0));
    const decoded = Buf.fromBase64Str(encoded);
    t.true(decoded instanceof Buf);
    equals(decoded, expected);
  }
  for (const encoded of ['Z', 'Zg=', 'Zm$v']) {
    t.throws(() => Buf.fromBase64Str(encoded), { instanceOf: SyntaxError });
  }
});

test('Buf Base64URL decoding accepts standard and URL-safe alphabets', t => {
  const expected = new Uint8Array([251, 255]);
  equals(Buf.fromBase64UrlStr('+/8='), expected);
  equals(Buf.fromBase64UrlStr('-_8'), expected);
  t.is(Buf.fromUint8(expected).toBase64UrlStr(), '-_8');
});

test('Buf hex encoding preserves uppercase-by-default behavior', t => {
  const bytes = Buf.fromUint8(new Uint8Array([0, 10, 171, 255]));
  t.is(bytes.toHexStr(), '000AABFF');
  t.is(bytes.toHexStr(false), '000aabff');
});

test('Buf.fromUtfStr(UTF8) = UTF8_AS_BYTES', async t => {
  equals(Buf.fromUtfStr(UTF8), UTF8_AS_BYTES);
  equals(Buf.fromUtfStr('\ud800\ud800'), Buffer.from('\ufffd\ufffd'));
  t.pass();
});

test('Buf.concat returns a Buf containing all input bytes', async t => {
  const concatenated = Buf.concat([new Uint8Array([1, 2]), new Uint8Array(), new Uint8Array([3, 4])]);
  t.true(concatenated instanceof Buf);
  equals(concatenated, new Uint8Array([1, 2, 3, 4]));
});

test('Buf.fromUint8(UTF8_AS_BYTES).toUtfStr() = UTF8', async t => {
  equals(Buf.fromUint8(UTF8_AS_BYTES).toUtfStr(), UTF8);
  t.pass();
});

test('Buf.fromRawBytesStr(UTF8_AS_RAW_STRING).toUtfStr() = UTF8', async t => {
  equals(Buf.fromRawBytesStr(UTF8_AS_RAW_STRING).toUtfStr(), UTF8);
  t.pass();
});

test('Buf.fromUtfStr(UTF8).toRawBytesStr() = UTF8_AS_RAW_STRING', async t => {
  equals(Buf.fromUtfStr(UTF8).toRawBytesStr(), UTF8_AS_RAW_STRING);
  t.pass();
});

test('Buf.fromRawBytesStr(UTF8_AS_RAW_STRING) = UTF8_AS_BYTES', async t => {
  equals(Buf.fromRawBytesStr(UTF8_AS_RAW_STRING), UTF8_AS_BYTES);
  t.pass();
});

test('Buf.fromUint8(UTF8_AS_BYTES) = UTF8_AS_RAW_STRING', async t => {
  equals(Buf.fromUint8(UTF8_AS_BYTES).toRawBytesStr(), UTF8_AS_RAW_STRING);
  t.pass();
});
