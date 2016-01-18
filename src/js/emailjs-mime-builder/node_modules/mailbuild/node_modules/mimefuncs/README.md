# MIME Functions

`mimefuncs` allows you to encode and decode between different MIME related encodings. Quoted-Printable, Base64 etc.

All input can use any charset (in this case, the value must not be a string but an arraybuffer of Uint8Array) but output is always unicode.

[![Build Status](https://travis-ci.org/whiteout-io/mimefuncs.png)](https://travis-ci.org/whiteout-io/mimefuncs)

## StringEncoding API

This module requires `TextEncoder` and `TextDecoder` to exist as part of the StringEncoding API (see: [MDN](https://developer.mozilla.org/en-US/docs/WebAPI/Encoding_API) [whatwg.org](http://encoding.spec.whatwg.org/#api)). Firefox 19+ is basically the only browser that supports this at the time of writing, while [Chromium in canary, not stable](https://code.google.com/p/chromium/issues/detail?id=243354). Luckily, [there is a polyfill](https://github.com/whiteout-io/stringencoding)!

## Installation

### [npm](https://www.npmjs.org/):

    npm install --save mimefuncs

## Usage

### AMD

Require [mimefuncs.js](src/mimefuncs.js) as `mimefuncs`

### Global context

Include file [mimefuncs.js](src/mimefuncs.js) on the page.

```html
<script src="mimefuncs.js"></script>
```

This exposes global variable `mimefuncs`

## Methods

### foldLines

Folds a long line according to the RFC 5322 <http://tools.ietf.org/html/rfc5322#section-2.1.1>

    mimefuncs.foldLines(str [, lineLengthMax[, afterSpace]]) -> String

  * **str** - String to be folded
  * **lineLengthMax** - Maximum length of a line (defaults to 76)
  * **afterSpace** - If true, leave a space in th end of a line

For example:

    mimefuncs.foldLines('Content-Type: multipart/alternative; boundary="----zzzz----"')

results in

    Content-Type: multipart/alternative;
         boundary="----zzzz----"

### mimeWordEncode

Encodes a string into mime encoded word format <http://en.wikipedia.org/wiki/MIME#Encoded-Word>  (see also `mimeWordDecode`)

    mimefuncs.mimeWordEncode(str [, mimeWordEncoding[, maxLength[, fromCharset]]]) -> String

  * **str** - String or Uint8Array to be encoded
  * **mimeWordEncoding** - Encoding for the mime word, either Q or B (default is 'Q')
  * **maxLength** - If set, split mime words into several chunks if needed
  * **fromCharset** - If the first parameter is a typed array, use this encoding to decode the value to unicode

For example:

    mimefuncs.mimeWordEncode('See on õhin test', 'Q');

Becomes with UTF-8 and Quoted-printable encoding

    =?UTF-8?Q?See_on_=C3=B5hin_test?=

### mimeWordDecode

Decodes a string from mime encoded word format (see also `mimeWordEncode`)

    mimefuncs.mimeWordDecode(str) -> String

  * **str** - String to be decoded

For example

    mimefuncs.mimeWordDecode('=?UTF-8?Q?See_on_=C3=B5hin_test?=');

will become

    See on õhin test

### continuationEncode

Encodes and splits a header param value according to [RFC2231](https://tools.ietf.org/html/rfc2231#section-3) Parameter Value Continuations.

    mimefuncs.continuationEncode(key, str, maxLength [, fromCharset]) -> Array

  * **key** - Parameter key (eg. `filename`)
  * **str** - String or an Uint8Array value to encode
  * **maxLength** - Maximum length of the encoded string part (not line length). Defaults to 50
  * **fromCharset** - If `str` is a typed array, use this charset to decode the value to unicode before encoding

The method returns an array of encoded parts with the following structure: `[{key:'...', value: '...'}]`

#### Example

```
mimefuncs.continuationEncode('filename', 'filename õäöü.txt', 20);
->
[ { key: 'filename*0*', value: 'utf-8\'\'filename%20' },
  { key: 'filename*1*', value: '%C3%B5%C3%A4%C3%B6' },
  { key: 'filename*2*', value: '%C3%BC.txt' } ]
```

This can be combined into a properly formatted header:

```
Content-disposition: attachment; filename*0*="utf-8''filename%20"
  filename*1*="%C3%B5%C3%A4%C3%B6"; filename*2*="%C3%BC.txt"
```

### quotedPrintableEncode

Encodes a string into Quoted-printable format (see also `quotedPrintableDecode`). Maximum line
length for the generated string is 76 + 2 bytes.

    mimefuncs.quotedPrintableEncode(str [, fromCharset]) -> String

  * **str** - String or an Uint8Array to mime encode
  * **fromCharset** - If the first parameter is a typed array, use this charset to decode the value to unicode before encoding

### quotedPrintableDecode

Decodes a string from Quoted-printable format  (see also `quotedPrintableEncode`).

    mimefuncs.quotedPrintableDecode(str [, fromCharset]) -> String

  * **str** - Mime encoded string
  * **fromCharset** - Use this charset to decode mime encoded string to unicode

### base64Encode

Encodes a string into Base64 format (see also `base64Decode`). Maximum line
length for the generated string is 76 + 2 bytes.

    mimefuncs.base64Encode(str [, fromCharset]) -> String

  * **str** - String or an Uint8Array to base64 encode
  * **fromCharset** - If the first parameter is a typed array, use this charset to decode the value to unicode before encoding

### base64Decode

Decodes a string from Base64 format (see also `base64Encode`) to an unencoded unicode string.

    mimefuncs.base64Decode(str [, fromCharset]) -> String

  * **str** Base64 encoded string
  * **fromCharset** Use this charset to decode base64 encoded string to unicode

### base64.decode

Decodes a string from Base64 format to an Uint8Array.

    mimefuncs.base64.decode(str) -> Uint8Array

  * **str** Base64 encoded string

### mimeWordEncode

Encodes a string to a mime word.

    mimefuncs.mimeWordEncode(str[, mimeWordEncoding[, maxLength[, fromCharset]]]) -> String

  * **str** - String or Uint8Array to be encoded
  * **mimeWordEncoding** - Encoding for the mime word, either Q or B (default is 'Q')
  * **maxLength** - If set, split mime words into several chunks if needed
  * **fromCharset** - If the first parameter is a typed array, use this charset to decode the value to unicode before encoding

### mimeWordsEncode

Encodes non ascii sequences in a string to mime words.

    mimefuncs.mimeWordsEncode(str[, mimeWordEncoding[, maxLength[, fromCharset]]]) -> String

  * **str** - String or Uint8Array to be encoded
  * **mimeWordEncoding** - Encoding for the mime word, either Q or B (default is 'Q')
  * **maxLength** - If set, split mime words into several chunks if needed
  * **fromCharset** - If the first parameter is a typed array, use this charset to decode the value to unicode before encoding

### mimeWordDecode

Decodes a complete mime word encoded string

    mimefuncs.mimeWordDecode(str) -> String

  * **str** - String to be decoded. Mime words have charset information included so need to specify it here

### mimeWordsDecode

Decodes a string that might include one or several mime words. If no mime words are found from the string, the original string is returned

    mimefuncs.mimeWordsDecode(str) -> String

  * **str** - String to be decoded

### headerLineEncode

Encodes and folds a header line for a MIME message header. Shorthand for `mimeWordsEncode` + `foldLines`.

    mimefuncs.headerLineEncode(key, value[, fromCharset])

  * **key** - Key name, will not be encoded
  * **value** - Value to be encoded
  * **fromCharset** - If the `value` parameter is a typed array, use this charset to decode the value to unicode before encoding

### headerLineDecode

Unfolds a header line and splits it to key and value pair. The return value is in the form of `{key: 'subject', value: 'test'}`. The value is not mime word decoded, you need to do your own decoding based on the rules for the specific header key.

    mimefuncs.headerLineDecode(headerLine) -> Object

  * **headerLine** - Single header line, might include linebreaks as well if folded

### headerLinesDecode

Parses a block of header lines. Does not decode mime words as every header
might have its own rules (eg. formatted email addresses and such).

Return value is an object of headers, where header keys are object keys. NB! Several values with the same key make up an array of values for the same key.

    mimefuncs.headerLinesDecode(headers) -> Object

  * **headers** - Headers string

### fromTypedArray

Converts an `ArrayBuffer` or `Uint8Array` value to 'binary' string.

    mimefuncs.fromTypedArray(data) -> String

  * **data** - an `ArrayBuffer` or `Uint8Array` value

### toTypedArray

Converts a 'binary' string to an `Uint8Array` object.

    mimefuncs.toTypedArray(data) -> Uint8Array

  * **data** - a 'binary' string

### parseHeaderValue

Parses a header value with `key=value` arguments into a structured object. Useful when dealing with
`content-type` and such.

    parseHeaderValue(valueString) -> Object

  * **valueString** - a header value without the key

Example

```javascript
parseHeaderValue('content-type: text/plain; CHARSET="UTF-8"');
```

Outputs

```json
{
    "value": "text/plain",
    "params": {
        "charset": "UTF-8"
    }
}
```

## Hands on

```bash
git clone git@github.com:whiteout-io/mimefuncs.git
cd mimefuncs
npm install && npm test
```

## License

```
Copyright (c) 2013 Andris Reinman

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.```
