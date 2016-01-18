# Address parser

`addressparser` is a UMD module that allows you to parse mime formatted e-mail address lists in node and the browser.

NB! This module does not decode any mime-word or punycode encoded strings, it is only a basic parser for parsing the base data.

[![Build Status](https://travis-ci.org/whiteout-io/addressparser.png?branch=master)](https://travis-ci.org/whiteout-io/addressparser)

## Installation

### [npm](https://www.npmjs.org/):

    npm install https://github.com/whiteout-io/addressparser/tarball/<TAG_NAME>

## Usage

### node.js and AMD

    require('addressparser');

### Global context

    // exposes global variable addressparser
    <script src="addressparser.js"></script>

### addressparser #parse()

Parses a list of mime formatted e-mail addresses. Returned array includes objects in the form of `{name, address}`. If the address is a [group](http://tools.ietf.org/html/rfc2822#appendix-A.1.3), instead of `address` parameter, `group` parameter (array) with nested address objects is used.

    addressparser.parse(addressString) -> String

For example:

    addressparser.parse(('"Bach, Sebastian" <sebu@example.com>, mozart@example.com (Mozzie)');

    // returns
    [{
        name: "Bach, Sebastian", 
        address: "sebu@example.com"
    }, {
        name: "Mozzie", 
        address: "mozart@example.com"
    }]

And when using groups

    addressparser.parse('Composers:"Bach, Sebastian" <sebu@example.com>, mozart@example.com (Mozzie);');

    // returns
    [{
        name: "Composers",
        group: [{
            address: "sebu@example.com",
            name: "Bach, Sebastian"
        }, {
            address: "mozart@example.com",
            name: "Mozzie"
        }]
    }]

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
