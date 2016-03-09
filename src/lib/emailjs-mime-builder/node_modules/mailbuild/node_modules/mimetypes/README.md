# MIME Types

`mimetypes` is a UMD module that allows you to detect file extensions for content types and vice-versa.

[![Build Status](https://travis-ci.org/whiteout-io/mimetypes.png?branch=master)](https://travis-ci.org/whiteout-io/mimetypes)

## Installation

### [volo](http://volojs.org/):

    volo add whiteout-io/mimetypes/v0.1.1

### [Bower](http://bower.io/):

    bower install git@github.com:whiteout-io/mimetypes.git#v0.1.1

### [npm](https://www.npmjs.org/):

    npm install https://github.com/whiteout-io/mimetypes/tarball/v0.1.1

## Usage

### node.js and AMD

    require('mimetypes');

### Global context

    // exposes global variable mimetypes
    <script src="mimetypes.js"></script>

## Methods

### #detectExtension

 Returns file extension for a content type string. If no suitable extensions are found, 'bin' is used as the default extension.

    mimetypes.detectExtension(mimeType) -> String

  * **mimeType** - Content type to be checked for

For example:

    mimetypes.detectExtension('image/jpeg') // returns 'jpeg'

### #detectMimeType

Returns content type for a file extension. If no suitable content types are found, 'application/octet-stream' is used as the default content type

    mimetypes.detectMimeType(extension) -> String

  * **extension** Extension to be checked for

For example:

    mimetypes.detectExtension('jpeg') // returns 'image/jpeg'

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
