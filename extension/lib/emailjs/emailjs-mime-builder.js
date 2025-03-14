// Copyright (c) 2013 Andris Reinman
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

(function (root, factory) {
    'use strict';

    if (typeof define === 'function' && define.amd) {
        define(['emailjs-mime-codec', 'emailjs-mime-types', 'punycode', 'emailjs-addressparser'], factory);
    } else if (typeof exports === 'object') {
        module.exports = factory(require('emailjs-mime-codec'), require('emailjs-mime-types'), require('punycode'), require('emailjs-addressparser'));
    } else {
        root['emailjs-mime-builder'] = factory(root['emailjs-mime-codec'], root['emailjs-mime-types'], root.punycode, root['emailjs-addressparser']);
    }
}(this, function (mimecodec, mimetypes, punycode, addressparser) {
    'use strict';

    /**
     * Creates a new mime tree node. Assumes 'multipart/*' as the content type
     * if it is a branch, anything else counts as leaf. If rootNode is missing from
     * the options, assumes this is the root.
     *
     * @param {String} contentType Define the content type for the node. Can be left blank for attachments (derived from filename)
     * @param {Object} [options] optional options
     * @param {Object} [options.rootNode] root node for this tree
     * @param {Object} [options.parentNode] immediate parent for this node
     * @param {Object} [options.filename] filename for an attachment node
     * @param {String} [options.baseBoundary] shared part of the unique multipart boundary
     * @param {Boolean} [options.includeBccInHeader] include BCC in the Mime Message
     */
    function MimeNode(contentType, options) {
        this.nodeCounter = 0;

        options = options || {};

        /**
         * shared part of the unique multipart boundary
         */
        this.baseBoundary = options.baseBoundary || Date.now().toString() + Math.random();

        /**
         * If date headers is missing and current node is the root, this value is used instead
         */
        this.date = new Date();

        /**
         * Root node for current mime tree
         */
        this.rootNode = options.rootNode || this;

        /**
         * If filename is specified but contentType is not (probably an attachment)
         * detect the content type from filename extension
         */
        if (options.filename) {
            /**
             * Filename for this node. Useful with attachments
             */
            this.filename = options.filename;
            if (!contentType) {
                contentType = mimetypes.detectMimeType(this.filename.split('.').pop());
            }
        }

        /**
         * Immediate parent for this node (or undefined if not set)
         */
        this.parentNode = options.parentNode;

        /**
         * Used for generating unique boundaries (prepended to the shared base)
         */
        this._nodeId = ++this.rootNode.nodeCounter;

        /**
         * An array for possible child nodes
         */
        this._childNodes = [];

        /**
         * A list of header values for this node in the form of [{key:'', value:''}]
         */
        this._headers = [];

        /**
         * If content type is set (or derived from the filename) add it to headers
         */
        if (contentType) {
            this.setHeader('content-type', contentType);
        }

        this.includeBccInHeader = options.includeBccInHeader || false;
    }

    /////// PUBLIC METHODS

    /**
     * Creates and appends a child node. Arguments provided are passed to MimeNode constructor
     *
     * @param {String} [contentType] Optional content type
     * @param {Object} [options] Optional options object
     * @return {Object} Created node object
     */
    MimeNode.prototype.createChild = function (contentType, options) {
        if (!options && typeof contentType === 'object') {
            options = contentType;
            contentType = undefined;
        }
        var node = new MimeNode(contentType, options);
        this.appendChild(node);
        return node;
    };

    /**
     * Appends an existing node to the mime tree. Removes the node from an existing
     * tree if needed
     *
     * @param {Object} childNode node to be appended
     * @return {Object} Appended node object
     */
    MimeNode.prototype.appendChild = function (childNode) {

        if (childNode.rootNode !== this.rootNode) {
            childNode.rootNode = this.rootNode;
            childNode._nodeId = ++this.rootNode.nodeCounter;
        }

        childNode.parentNode = this;

        this._childNodes.push(childNode);
        return childNode;
    };

    /**
     * Replaces current node with another node
     *
     * @param {Object} node Replacement node
     * @return {Object} Replacement node
     */
    MimeNode.prototype.replace = function (node) {
        if (node === this) {
            return this;
        }

        this.parentNode._childNodes.forEach(function (childNode, i) {
            if (childNode === this) {

                node.rootNode = this.rootNode;
                node.parentNode = this.parentNode;
                node._nodeId = this._nodeId;

                this.rootNode = this;
                this.parentNode = undefined;

                node.parentNode._childNodes[i] = node;
            }
        }.bind(this));

        return node;
    };

    /**
     * Removes current node from the mime tree
     *
     * @return {Object} removed node
     */
    MimeNode.prototype.remove = function () {
        if (!this.parentNode) {
            return this;
        }

        for (var i = this.parentNode._childNodes.length - 1; i >= 0; i--) {
            if (this.parentNode._childNodes[i] === this) {
                this.parentNode._childNodes.splice(i, 1);
                this.parentNode = undefined;
                this.rootNode = this;
                return this;
            }
        }
    };

    /**
     * Sets a header value. If the value for selected key exists, it is overwritten.
     * You can set multiple values as well by using [{key:'', value:''}] or
     * {key: 'value'} as the first argument.
     *
     * @param {String|Array|Object} key Header key or a list of key value pairs
     * @param {String} value Header value
     * @return {Object} current node
     */
    MimeNode.prototype.setHeader = function (key, value) {
        var added = false,
            headerValue;

        // Allow setting multiple headers at once
        if (!value && key && typeof key === 'object') {
            // allow {key:'content-type', value: 'text/plain'}
            if (key.key && key.value) {
                this.setHeader(key.key, key.value);
            }
            // allow [{key:'content-type', value: 'text/plain'}]
            else if (Array.isArray(key)) {
                key.forEach(function (i) {
                    this.setHeader(i.key, i.value);
                }.bind(this));
            }
            // allow {'content-type': 'text/plain'}
            else {
                Object.keys(key).forEach(function (i) {
                    this.setHeader(i, key[i]);
                }.bind(this));
            }
            return this;
        }

        key = this._normalizeHeaderKey(key);

        headerValue = {
            key: key,
            value: value
        };

        // Check if the value exists and overwrite
        for (var i = 0, len = this._headers.length; i < len; i++) {
            if (this._headers[i].key === key) {
                if (!added) {
                    // replace the first match
                    this._headers[i] = headerValue;
                    added = true;
                } else {
                    // remove following matches
                    this._headers.splice(i, 1);
                    i--;
                    len--;
                }
            }
        }

        // match not found, append the value
        if (!added) {
            this._headers.push(headerValue);
        }

        return this;
    };

    /**
     * Adds a header value. If the value for selected key exists, the value is appended
     * as a new field and old one is not touched.
     * You can set multiple values as well by using [{key:'', value:''}] or
     * {key: 'value'} as the first argument.
     *
     * @param {String|Array|Object} key Header key or a list of key value pairs
     * @param {String} value Header value
     * @return {Object} current node
     */
    MimeNode.prototype.addHeader = function (key, value) {

        // Allow setting multiple headers at once
        if (!value && key && typeof key === 'object') {
            // allow {key:'content-type', value: 'text/plain'}
            if (key.key && key.value) {
                this.addHeader(key.key, key.value);
            }
            // allow [{key:'content-type', value: 'text/plain'}]
            else if (Array.isArray(key)) {
                key.forEach(function (i) {
                    this.addHeader(i.key, i.value);
                }.bind(this));
            }
            // allow {'content-type': 'text/plain'}
            else {
                Object.keys(key).forEach(function (i) {
                    this.addHeader(i, key[i]);
                }.bind(this));
            }
            return this;
        }

        this._headers.push({
            key: this._normalizeHeaderKey(key),
            value: value
        });

        return this;
    };

    /**
     * Retrieves the first mathcing value of a selected key
     *
     * @param {String} key Key to search for
     * @retun {String} Value for the key
     */
    MimeNode.prototype.getHeader = function (key) {
        key = this._normalizeHeaderKey(key);
        for (var i = 0, len = this._headers.length; i < len; i++) {
            if (this._headers[i].key === key) {
                return this._headers[i].value;
            }
        }
    };

    /**
     * Sets body content for current node. If the value is a string, charset is added automatically
     * to Content-Type (if it is text/*). If the value is a Typed Array, you need to specify
     * the charset yourself
     *
     * @param (String|Uint8Array) content Body content
     * @return {Object} current node
     */
    MimeNode.prototype.setContent = function (content) {
        this.content = content;
        return this;
    };

    /**
     * Builds the rfc2822 message from the current node. If this is a root node,
     * mandatory header fields are set if missing (Date, Message-Id, MIME-Version)
     *
     * @return {String} Compiled message
     */
    MimeNode.prototype.build = function () {
        var lines = [],
            contentType = (this.getHeader('Content-Type') || '').toString().toLowerCase().trim(),
            transferEncoding, flowed;

        if (this.content) {
            transferEncoding = (this.getHeader('Content-Transfer-Encoding') || '').toString().toLowerCase().trim();
            if (!transferEncoding || ['base64', 'quoted-printable'].indexOf(transferEncoding) < 0) {
                if (/^text\//i.test(contentType)) {
                    // If there are no special symbols, no need to modify the text
                    if (this._isPlainText(this.content)) {
                        // If there are lines longer than 76 symbols/bytes, make the text 'flowed'
                        // Take only first 100000 symbols to prevent "Too much recursion" error
                        // https://github.com/FlowCrypt/flowcrypt-browser/issues/5479
                        if (/^.{77,}/m.test(this.content.substr(0, 100000))) {
                            flowed = true;
                        }
                        transferEncoding = '7bit';
                    } else {
                        transferEncoding = 'quoted-printable';
                    }
                } else if (!/^multipart\//i.test(contentType)) {
                    transferEncoding = transferEncoding || 'base64';
                }
            }

            if (transferEncoding) {
                this.setHeader('Content-Transfer-Encoding', transferEncoding);
            }
        }

        if (this.filename && !this.getHeader('Content-Disposition')) {
            this.setHeader('Content-Disposition', 'attachment');
        }

        this._headers.forEach(function (header) {
            var key = header.key,
                value = header.value,
                structured;

            switch (header.key) {
                case 'Content-Disposition':
                    structured = mimecodec.parseHeaderValue(value);
                    if (this.filename) {
                        structured.params.filename = this.filename;
                    }
                    value = this._buildHeaderValue(structured);
                    break;
                case 'Content-Type':
                    structured = mimecodec.parseHeaderValue(value);

                    this._handleContentType(structured);

                    if (flowed) {
                        structured.params.format = 'flowed';
                    }
                    if (String(structured.params.format).toLowerCase().trim() === 'flowed') {
                        flowed = true;
                    }

                    if (structured.value.match(/^text\//) && typeof this.content === 'string' && /[\u0080-\uFFFF]/.test(this.content)) {
                        structured.params.charset = 'utf-8';
                    }

                    value = this._buildHeaderValue(structured);
                    break;
                case 'Bcc':
                    if (this.includeBccInHeader === false) {
                        // skip BCC values
                        return;
                    }
            }

            // skip empty lines
            value = this._encodeHeaderValue(key, value);
            if (!(value || '').toString().trim()) {
                return;
            }

            lines.push(mimecodec.foldLines(key + ': ' + value, 76));
        }.bind(this));

        // Ensure mandatory header fields
        if (this.rootNode === this) {
            if (!this.getHeader('Date')) {
                lines.push('Date: ' + this.date.toUTCString().replace(/GMT/, '+0000'));
            }
            // You really should define your own Message-Id field
            if (!this.getHeader('Message-Id')) {
                lines.push('Message-Id: <' +
                    // crux to generate random strings like this:
                    // "1401391905590-58aa8c32-d32a065c-c1a2aad2"
                    [0, 0, 0].reduce(function (prev) {
                        return prev + '-' + Math.floor((1 + Math.random()) * 0x100000000).
                            toString(16).
                            substring(1);
                    }, Date.now()) +
                    '@' +
                    // try to use the domain of the FROM address or fallback localhost
                    (this.getEnvelope().from || 'localhost').split('@').pop() +
                    '>');
            }
            if (!this.getHeader('MIME-Version')) {
                lines.push('MIME-Version: 1.0');
            }
        }
        lines.push('');

        if (this.content) {

            switch (transferEncoding) {
                case 'quoted-printable':
                    lines.push(mimecodec.quotedPrintableEncode(this.content));
                    break;
                case 'base64':
                    lines.push(mimecodec.base64Encode(this.content, typeof this.content === 'object' && 'binary' || false));
                    break;
                default:
                    if (flowed) {
                        lines.push(mimecodec.foldLines(this.content.replace(/\r?\n/g, '\r\n').
                            // space stuffing http://tools.ietf.org/html/rfc3676#section-4.2
                            replace(/^( |From|>)/igm, ' $1'),
                            76, true));
                    } else {
                        lines.push(this.content.replace(/\r?\n/g, '\r\n'));
                    }
            }
            if (this.multipart) {
                lines.push('');
            }
        }

        if (this.multipart) {
            this._childNodes.forEach(function (node) {
                lines.push('--' + this.boundary);
                lines.push(node.build());
            }.bind(this));
            lines.push('--' + this.boundary + '--');
            lines.push('');
        }

        return lines.join('\r\n');
    };

    /**
     * Generates and returns SMTP envelope with the sender address and a list of recipients addresses
     *
     * @return {Object} SMTP envelope in the form of {from: 'from@example.com', to: ['to@example.com']}
     */
    MimeNode.prototype.getEnvelope = function () {
        var envelope = {
            from: false,
            to: []
        };
        this._headers.forEach(function (header) {
            var list = [];
            if (header.key === 'From' || (!envelope.from && ['Reply-To', 'Sender'].indexOf(header.key) >= 0)) {
                this._convertAddresses(this._parseAddresses(header.value), list);
                if (list.length && list[0]) {
                    envelope.from = list[0];
                }
            } else if (['To', 'Cc', 'Bcc'].indexOf(header.key) >= 0) {
                this._convertAddresses(this._parseAddresses(header.value), envelope.to);
            }
        }.bind(this));

        return envelope;
    };

    /////// PRIVATE METHODS

    /**
     * Parses addresses. Takes in a single address or an array or an
     * array of address arrays (eg. To: [[first group], [second group],...])
     *
     * @param {Mixed} addresses Addresses to be parsed
     * @return {Array} An array of address objects
     */
    MimeNode.prototype._parseAddresses = function (addresses) {
        return [].concat.apply([], [].concat(addresses).map(function (address) {
            if (address && address.address) {
                address = this._convertAddresses(address);
            }
            return addressparser.parse(address);
        }.bind(this)));
    };

    /**
     * Normalizes a header key, uses Camel-Case form, except for uppercase MIME-
     *
     * @param {String} key Key to be normalized
     * @return {String} key in Camel-Case form
     */
    MimeNode.prototype._normalizeHeaderKey = function (key) {
        return (key || '').toString().
            // no newlines in keys
            replace(/\r?\n|\r/g, ' ').
            trim().toLowerCase().
            // use uppercase words, except MIME
            replace(/^MIME\b|^[a-z]|\-[a-z]/ig, function (c) {
                return c.toUpperCase();
            });
    };

    /**
     * Joins parsed header value together as 'value; param1=value1; param2=value2'
     * PS: We are following RFC 822 for the list of special characters that we need to keep in quotes.
     *      Refer: https://www.w3.org/Protocols/rfc1341/4_Content-Type.html
     * @param {Object} structured Parsed header value
     * @return {String} joined header value
     */
    // copied from https://github.com/nodemailer/libmime/
    MimeNode.prototype._buildHeaderValue = function(structured) {
        let paramsArray = [];

        Object.keys(structured.params || {}).forEach(param => {
            // filename might include unicode characters so it is a special case
            let value = structured.params[param];
            if (!this._isPlainText(value) || value.length >= 75) {
                this._buildHeaderParam(param, value, 50).forEach(encodedParam => {
                    if (!/[\s"\\;:/=(),<>@[\]?]|^[-']|'$/.test(encodedParam.value) || encodedParam.key.substr(-1) === '*') {
                        paramsArray.push(encodedParam.key + '=' + encodedParam.value);
                    } else {
                        paramsArray.push(encodedParam.key + '=' + JSON.stringify(encodedParam.value));
                    }
                });
            } else if (/[\s'"\\;:/=(),<>@[\]?]|^-/.test(value)) {
                paramsArray.push(param + '=' + JSON.stringify(value));
            } else {
                paramsArray.push(param + '=' + value);
            }
        });

        return structured.value + (paramsArray.length ? '; ' + paramsArray.join('; ') : '');
    }

    /**
     * Encodes a string or an Buffer to an UTF-8 Parameter Value Continuation encoding (rfc2231)
     * Useful for splitting long parameter values.
     *
     * For example
     *      title="unicode string"
     * becomes
     *     title*0*=utf-8''unicode
     *     title*1*=%20string
     *
     * @param {String|Buffer} data String to be encoded
     * @param {Number} [maxLength=50] Max length for generated chunks
     * @param {String} [fromCharset='UTF-8'] Source sharacter set
     * @return {Array} A list of encoded keys and headers
     */
    // copied from https://github.com/nodemailer/libmime/
    MimeNode.prototype._buildHeaderParam = function(key, data, maxLength, fromCharset) {
        let list = [];
        let encodedStr = typeof data === 'string' ? data : mimecodec.decode(data, fromCharset);
        let encodedStrArr;
        let chr, ord;
        let line;
        let startPos = 0;
        let isEncoded = false;
        let i, len;

        maxLength = maxLength || 50;

        // process ascii only text
        if (this._isPlainText(data)) {
            // check if conversion is even needed
            if (encodedStr.length <= maxLength) {
                return [
                    {
                        key,
                        value: encodedStr
                    }
                ];
            }

            encodedStr = encodedStr.replace(new RegExp('.{' + maxLength + '}', 'g'), str => {
                list.push({
                    line: str
                });
                return '';
            });

            if (encodedStr) {
                list.push({
                    line: encodedStr
                });
            }
        } else {
            if (/[\uD800-\uDBFF]/.test(encodedStr)) {
                // string containts surrogate pairs, so normalize it to an array of bytes
                encodedStrArr = [];
                for (i = 0, len = encodedStr.length; i < len; i++) {
                    chr = encodedStr.charAt(i);
                    ord = chr.charCodeAt(0);
                    if (ord >= 0xd800 && ord <= 0xdbff && i < len - 1) {
                        chr += encodedStr.charAt(i + 1);
                        encodedStrArr.push(chr);
                        i++;
                    } else {
                        encodedStrArr.push(chr);
                    }
                }
                encodedStr = encodedStrArr;
            }

            // first line includes the charset and language info and needs to be encoded
            // even if it does not contain any unicode characters
            line = "utf-8''";
            isEncoded = true;
            startPos = 0;

            // process text with unicode or special chars
            for (i = 0, len = encodedStr.length; i < len; i++) {
                chr = encodedStr[i];

                if (isEncoded) {
                    chr = this._safeEncodeURIComponent(chr);
                } else {
                    // try to urlencode current char
                    chr = chr === ' ' ? chr : this._safeEncodeURIComponent(chr);
                    // By default it is not required to encode a line, the need
                    // only appears when the string contains unicode or special chars
                    // in this case we start processing the line over and encode all chars
                    if (chr !== encodedStr[i]) {
                        // Check if it is even possible to add the encoded char to the line
                        // If not, there is no reason to use this line, just push it to the list
                        // and start a new line with the char that needs encoding
                        if ((this._safeEncodeURIComponent(line) + chr).length >= maxLength) {
                            list.push({
                                line,
                                encoded: isEncoded
                            });
                            line = '';
                            startPos = i - 1;
                        } else {
                            isEncoded = true;
                            i = startPos;
                            line = '';
                            continue;
                        }
                    }
                }

                // if the line is already too long, push it to the list and start a new one
                if ((line + chr).length >= maxLength) {
                    list.push({
                        line,
                        encoded: isEncoded
                    });
                    line = chr = encodedStr[i] === ' ' ? ' ' : this._safeEncodeURIComponent(encodedStr[i]);
                    if (chr === encodedStr[i]) {
                        isEncoded = false;
                        startPos = i - 1;
                    } else {
                        isEncoded = true;
                    }
                } else {
                    line += chr;
                }
            }

            if (line) {
                list.push({
                    line,
                    encoded: isEncoded
                });
            }
        }

        return list.map((item, i) => ({
            // encoded lines: {name}*{part}*
            // unencoded lines: {name}*{part}
            // if any line needs to be encoded then the first line (part==0) is always encoded
            key: key + '*' + i + (item.encoded ? '*' : ''),
            value: item.line
        }));
    }

    // copied from https://github.com/nodemailer/libmime/
    MimeNode.prototype._safeEncodeURIComponent = function(str) {
        str = (str || '').toString();

        try {
            // might throw if we try to encode invalid sequences, eg. partial emoji
            str = encodeURIComponent(str);
        } catch (E) {
            // should never run
            return str.replace(/[^\x00-\x1F *'()<>@,;:\\"[\]?=\u007F-\uFFFF]+/g, '');
        }

        // ensure chars that are not handled by encodeURICompent are converted as well
        return str.replace(/[\x00-\x1F *'()<>@,;:\\"[\]?=\u007F-\uFFFF]/g, chr => this._encodeURICharComponent(chr));
    }

    MimeNode.prototype._encodeURICharComponent = function(chr) {
        let res = '';
        let ord = chr.charCodeAt(0).toString(16).toUpperCase();

        if (ord.length % 2) {
            ord = '0' + ord;
        }

        if (ord.length > 2) {
            for (let i = 0, len = ord.length / 2; i < len; i++) {
                res += '%' + ord.substr(i, 2);
            }
        } else {
            res += '%' + ord;
        }

        return res;
    }

    /**
     * Escapes a header argument value (eg. boundary value for content type),
     * adds surrounding quotes if needed
     *
     * @param {String} value Header argument value
     * @return {String} escaped and quoted (if needed) argument value
     */
    MimeNode.prototype._escapeHeaderArgument = function (value) {
        if (value.match(/[\s'"\\;\/=]|^\-/g)) {
            return '"' + value.replace(/(["\\])/g, "\\$1") + '"';
        } else {
            return value;
        }
    };

    /**
     * Checks if the content type is multipart and defines boundary if needed.
     * Doesn't return anything, modifies object argument instead.
     *
     * @param {Object} structured Parsed header value for 'Content-Type' key
     */
    MimeNode.prototype._handleContentType = function (structured) {
        this.contentType = structured.value.trim().toLowerCase();

        this.multipart = this.contentType.split('/').reduce(function (prev, value) {
            return prev === 'multipart' ? value : false;
        });

        if (this.multipart) {
            this.boundary = structured.params.boundary = structured.params.boundary || this.boundary || this._generateBoundary();
        } else {
            this.boundary = false;
        }
    };

    /**
     * Generates a multipart boundary value
     *
     * @return {String} boundary value
     */
    MimeNode.prototype._generateBoundary = function () {
        return '----sinikael-?=_' + this._nodeId + '-' + this.rootNode.baseBoundary;
    };

    /**
     * Encodes a header value for use in the generated rfc2822 email.
     *
     * @param {String} key Header key
     * @param {String} value Header value
     */
    MimeNode.prototype._encodeHeaderValue = function (key, value) {
        key = this._normalizeHeaderKey(key);

        switch (key) {
            case 'From':
            case 'Sender':
            case 'To':
            case 'Cc':
            case 'Bcc':
            case 'Reply-To':
                return this._convertAddresses(this._parseAddresses(value));

            case 'Message-Id':
            case 'In-Reply-To':
            case 'Content-Id':
                value = (value || '').toString().replace(/\r?\n|\r/g, ' ');

                if (value.charAt(0) !== '<') {
                    value = '<' + value;
                }

                if (value.charAt(value.length - 1) !== '>') {
                    value = value + '>';
                }
                return value;

            case 'References':
                value = [].concat.apply([], [].concat(value || '').map(function (elm) {
                    elm = (elm || '').toString().replace(/\r?\n|\r/g, ' ').trim();
                    return elm.replace(/<[^>]*>/g, function (str) {
                        return str.replace(/\s/g, '');
                    }).split(/\s+/);
                })).map(function (elm) {
                    if (elm.charAt(0) !== '<') {
                        elm = '<' + elm;
                    }
                    if (elm.charAt(elm.length - 1) !== '>') {
                        elm = elm + '>';
                    }
                    return elm;
                });

                return value.join(' ').trim();

            default:
                value = (value || '').toString().replace(/\r?\n|\r/g, ' ');
                // mimeWordsEncode only encodes if needed, otherwise the original string is returned
                return mimecodec.mimeWordsEncode(value, 'Q', 52);
        }
    };

    /**
     * Rebuilds address object using punycode and other adjustments
     *
     * @param {Array} addresses An array of address objects
     * @param {Array} [uniqueList] An array to be populated with addresses
     * @return {String} address string
     */
    MimeNode.prototype._convertAddresses = function (addresses, uniqueList) {
        var values = [];

        uniqueList = uniqueList || [];

        [].concat(addresses || []).forEach(function (address) {
            if (address.address) {
                address.address = address.address.replace(/^.*?(?=\@)/, function (user) {
                    return mimecodec.mimeWordsEncode(user, 'Q', 52);
                }).replace(/@.+$/, function (domain) {
                    return '@' + punycode.toASCII(domain.substr(1));
                });

                if (!address.name) {
                    values.push(address.address);
                } else if (address.name) {
                    values.push(this._encodeAddressName(address.name) + ' <' + address.address + '>');
                }

                if (uniqueList.indexOf(address.address) < 0) {
                    uniqueList.push(address.address);
                }
            } else if (address.group) {
                values.push(this._encodeAddressName(address.name) + ':' + (address.group.length ? this._convertAddresses(address.group, uniqueList) : '').trim() + ';');
            }
        }.bind(this));

        return values.join(', ');
    };

    /**
     * If needed, mime encodes the name part
     *
     * @param {String} name Name part of an address
     * @returns {String} Mime word encoded string if needed
     */
    MimeNode.prototype._encodeAddressName = function (name) {
        if (!/^[\w ']*$/.test(name)) {
            if (/^[\x20-\x7e]*$/.test(name)) {
                return '"' + name.replace(/([\\"])/g, '\\$1') + '"';
            } else {
                return mimecodec.mimeWordEncode(name, 'Q', 52);
            }
        }
        return name;
    };

    /**
     * Checks if a value is plaintext string (uses only printable 7bit chars)
     *
     * @param {String} value String to be tested
     * @returns {Boolean} true if it is a plaintext string
     */
    MimeNode.prototype._isPlainText = function (value) {
        if (typeof value !== 'string' || /[\x00-\x08\x0b\x0c\x0e-\x1f\u0080-\uFFFF]/.test(value)) {
            return false;
        } else {
            return true;
        }
    };

    return MimeNode;
}));
