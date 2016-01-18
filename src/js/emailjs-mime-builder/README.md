# emailjs-mime-builder

*emailjs-mime-builder* is a low level rfc2822 message composer. Define your own mime tree, no magic included.

[![Build Status](https://travis-ci.org/emailjs/emailjs-mime-builder.png?branch=master)](https://travis-ci.org/emailjs/emailjs-mime-builder)

## StringEncoding API

This module requires `TextEncoder` and `TextDecoder` to exist as part of the StringEncoding API (see: [MDN](https://developer.mozilla.org/en-US/docs/WebAPI/Encoding_API) [whatwg.org](http://encoding.spec.whatwg.org/#api)). Firefox 19+ and Chrome M38+ support this. For the others, [there is a polyfill](https://github.com/whiteout-io/stringencoding)!

## Installation

### [npm](https://www.npmjs.org/):

    npm install --save mailbuild

### Dependencies

This module has dependencies that will be fetched automatically.

* [emailjs-mime-codec](https://github.com/emailjs/emailjs-mime-codec/)
* [emailjs-mime-types](https://github.com/emailjs/emailjs-mime-types/)
* [emailjs-addressparser](https://github.com/emailjs/emailjs-addressparser/)
* [punycode.js](https://github.com/bestiejs/punycode.js)
* [emailjs-stringencoding](https://github.com/emailjs/emailjs-stringencoding)

## API

Create a new `MimeBuilder` object with

```javascript
var builder = new MimeBuilder(contentType [, options]);
```

Where

  * **contentType** - define the content type for created node. Can be left blank for attachments (content type derived from `filename` option if available)
  * **options** - an optional options object
    * **filename** - *String* filename for an attachment node
    * **baseBoundary** - *String* shared part of the unique multipart boundary (generated randomly if not set)

## Methods

The same methods apply to the root node created with `new MimeBuilder()` and to any child nodes.

### createChild

Creates and appends a child node to the node object

```javascript
node.createChild(contentType, options)
```

The same arguments apply as with `new MimeBuilder()`. Created node object is returned.

**Example**

```javascript
new MimeBuilder("multipart/mixed").
    createChild("multipart/related").
        createChild("text/plain");
```

Generates the following mime tree:

```
multipart/mixed
  ↳ multipart/related
      ↳ text/plain
```

### appendChild

Appends an existing child node to the node object. Removes the node from an existing tree if needed.

```javascript
node.appendChild(childNode)
```

Where

  * **childNode** - child node to be appended

Method returns appended child node.

**Example**

```javascript
var childNode = new MimeBuilder("text/plain"),
    rootNode = new MimeBuilder("multipart/mixed");
rootnode.appendChild(childNode);
```

Generates the following mime tree:

```
multipart/mixed
  ↳ text/plain
```

## replace

Replaces current node with another node

```javascript
node.replace(replacementNode)
```

Where

  * **replacementNode** - node to replace the current node with

Method returns replacement node.

**Example**

```javascript
var rootNode = new MimeBuilder("multipart/mixed"),
    childNode = rootNode.createChild("text/plain");
childNode.replace(new MimeBuilder("text/html"));
```

Generates the following mime tree:

```
multipart/mixed
  ↳ text/html
```

## remove

Removes current node from the mime tree. Does not make a lot of sense for a root node.

```javascript
node.remove();
```

Method returns removed node.

**Example**

```javascript

var rootNode = new MimeBuilder("multipart/mixed"),
    childNode = rootNode.createChild("text/plain");
childNode.remove();
```

Generates the following mime tree:

```
multipart/mixed
```

## setHeader

Sets a header value. If the value for selected key exists, it is overwritten.

You can set multiple values as well by using `[{key:"", value:""}]` or
`{key: "value"}` structures as the first argument.

```javascript
node.setHeader(key, value);
```

Where

  * **key** - *String|Array|Object* Header key or a list of key value pairs
  * **value** - *String* Header value

Method returns current node.

**Example**

```javascript
new MimeBuilder("text/plain").
    setHeader("content-disposition", "inline").
    setHeader({
        "content-transfer-encoding": "7bit"
    }).
    setHeader([
        {key: "message-id", value: "abcde"}
    ]);
```

Generates the following header:

```
Content-type: text/plain
Content-Disposition: inline
Content-Transfer-Encoding: 7bit
Message-Id: <abcde>
```

## addHeader

Adds a header value. If the value for selected key exists, the value is appended
as a new field and old one is not touched.

You can set multiple values as well by using `[{key:"", value:""}]` or
`{key: "value"}` structures as the first argument.

```javascript
node.addHeader(key, value);
```

Where

  * **key** - *String|Array|Object* Header key or a list of key value pairs
  * **value** - *String* Header value

Method returns current node.

**Example**

```javascript
new MimeBuilder("text/plain").
    addHeader("X-Spam", "1").
    setHeader({
        "x-spam": "2"
    }).
    setHeader([
        {key: "x-spam", value: "3"}
    ]);
```

Generates the following header:

```
Content-type: text/plain
X-Spam: 1
X-Spam: 2
X-Spam: 3
```

## getHeader

Retrieves the first mathcing value of a selected key

```javascript
node.getHeader(key)
```

Where

  * **key** - *String* Key to search for

**Example**

```javascript
new MimeBuilder("text/plain").getHeader("content-type"); // text/plain
```

## setContent

Sets body content for current node. If the value is a string, charset is added automatically
to Content-Type (if it is `text/*`). If the value is a Typed Array, you need to specify the charset yourself.

```javascript
node.setContent(body)
```

Where

  * **body** - *String|Uint8Array* body content

**Example**

```javascript
new MimeBuilder("text/plain").setContent("Hello world!");
```

## build

Builds the rfc2822 message from the current node. If this is a root node, mandatory header fields are set if missing (Date, Message-Id, MIME-Version)

```javascript
node.build()
```

Method returns the rfc2822 message as a string

**Example**

```javascript
new MimeBuilder("text/plain").setContent("Hello world!").build();
```

Returns the following string:

```
Content-type: text/plain
Date: <current datetime>
Message-Id: <generated value>
MIME-Version: 1.0

Hello world!
```

## getEnvelope

Generates a SMTP envelope object. Makes sense only for root node.

```javascript
var envelope = node.generateEnvelope()
```

Method returns the envelope in the form of `{from:'address', to: ['addresses']}`

**Example**

```javascript
new MimeBuilder().
    addHeader({
        from: "From <from@example.com>",
        to: "receiver1@example.com",
        cc: "receiver2@example.com"
    }).
    getEnvelope();
```

Returns the following object:

```json
{
    "from": "from@example.com",
    "to": ["receiver1@example.com", "receiver2@example.com"]
}
```

## Notes

### Addresses

When setting address headers (`From`, `To`, `Cc`, `Bcc`) use of unicode is allowed. If needed
the addresses are converted to punycode automatically.

### Attachments

For attachments you should minimally set `filename` option and `Content-Disposition` header. If filename is specified, you can leave content type blank - if content type is not set, it is detected from the filename.

```javascript
new MimeBuilder("multipart/mixed").
  createChild(false, {filename: "image.png"}).
  setHeader("Content-Disposition", "attachment");
```

Obviously you might want to add `Content-Id` header as well if you want to reference this attachment from the HTML content.

### MIME structure

Most probably you only need to deal with the following multipart types when generating messages:

  * **multipart/alternative** - includes the same content in different forms (usually text/plain + text/html)
  * **multipart/related** - includes main node and related nodes (eg. text/html + referenced attachments)
  * **multipart/mixed** - includes other multipart nodes and attachments, or single content node and attachments

**Examples**

One content node and an attachment

```
multipart/mixed
  ↳ text/plain
  ↳ image/png
```

Content node with referenced attachment (eg. image with `Content-Type` referenced by `cid:` url in the HTML)

```
multipart/related
  ↳ text/html
  ↳ image/png
```

Plaintext and HTML alternatives

```
multipart/alternative
  ↳ text/html
  ↳ text/plain
```

One content node with referenced attachment and a regular attachment

```
multipart/mixed
  ↳ multipart/related
    ↳ text/plain
    ↳ image/png
  ↳ application/x-zip
```

Alternative content with referenced attachment for HTML and a regular attachment

```
multipart/mixed
  ↳ multipart/alternative
    ↳ text/plain
    ↳ multipart/related
      ↳ text/html
      ↳ image/png
  ↳ application/x-zip
```

## Get your hands dirty

```
git clone git@github.com:whiteout-io/mailbuild.git
cd mailbuild
npm install && npm test
grunt dev
go to http://localhost:12345/example/ to run the example
go to http://localhost:12345/test/ to run the tests in your browser of choice
```

## License

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
    THE SOFTWARE.
