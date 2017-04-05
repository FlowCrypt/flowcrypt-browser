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

(function(root, factory) {
    'use strict';

    if (typeof define === 'function' && define.amd) {
        define(['emailjs-mime-codec', 'emailjs-addressparser'], factory);
    } else if (typeof exports === 'object') {
        module.exports = factory(require('emailjs-mime-codec'), require('emailjs-addressparser'));
    } else {
        root['emailjs-mime-parser'] = factory(root['emailjs-mime-codec'], root['emailjs-addressparser']);
    }

}(this, function(mimecodec, addressparser) {
    'use strict';

    var TIMEZONE_ABBREVATIONS = {
        "ACDT": "+1030",
        "ACST": "+0930",
        "ACT": "+0800",
        "ADT": "-0300",
        "AEDT": "+1100",
        "AEST": "+1000",
        "AFT": "+0430",
        "AKDT": "-0800",
        "AKST": "-0900",
        "AMST": "-0300",
        "AMT": "+0400",
        "ART": "-0300",
        "AST": "+0300",
        "AWDT": "+0900",
        "AWST": "+0800",
        "AZOST": "-0100",
        "AZT": "+0400",
        "BDT": "+0800",
        "BIOT": "+0600",
        "BIT": "-1200",
        "BOT": "-0400",
        "BRT": "-0300",
        "BST": "+0600",
        "BTT": "+0600",
        "CAT": "+0200",
        "CCT": "+0630",
        "CDT": "-0500",
        "CEDT": "+0200",
        "CEST": "+0200",
        "CET": "+0100",
        "CHADT": "+1345",
        "CHAST": "+1245",
        "CHOT": "+0800",
        "CHST": "+1000",
        "CHUT": "+1000",
        "CIST": "-0800",
        "CIT": "+0800",
        "CKT": "-1000",
        "CLST": "-0300",
        "CLT": "-0400",
        "COST": "-0400",
        "COT": "-0500",
        "CST": "-0600",
        "CT": "+0800",
        "CVT": "-0100",
        "CWST": "+0845",
        "CXT": "+0700",
        "DAVT": "+0700",
        "DDUT": "+1000",
        "DFT": "+0100",
        "EASST": "-0500",
        "EAST": "-0600",
        "EAT": "+0300",
        "ECT": "-0500",
        "EDT": "-0400",
        "EEDT": "+0300",
        "EEST": "+0300",
        "EET": "+0200",
        "EGST": "+0000",
        "EGT": "-0100",
        "EIT": "+0900",
        "EST": "-0500",
        "FET": "+0300",
        "FJT": "+1200",
        "FKST": "-0300",
        "FKT": "-0400",
        "FNT": "-0200",
        "GALT": "-0600",
        "GAMT": "-0900",
        "GET": "+0400",
        "GFT": "-0300",
        "GILT": "+1200",
        "GIT": "-0900",
        "GMT": "+0000",
        "GST": "+0400",
        "GYT": "-0400",
        "HADT": "-0900",
        "HAEC": "+0200",
        "HAST": "-1000",
        "HKT": "+0800",
        "HMT": "+0500",
        "HOVT": "+0700",
        "HST": "-1000",
        "ICT": "+0700",
        "IDT": "+0300",
        "IOT": "+0300",
        "IRDT": "+0430",
        "IRKT": "+0900",
        "IRST": "+0330",
        "IST": "+0530",
        "JST": "+0900",
        "KGT": "+0600",
        "KOST": "+1100",
        "KRAT": "+0700",
        "KST": "+0900",
        "LHST": "+1030",
        "LINT": "+1400",
        "MAGT": "+1200",
        "MART": "-0930",
        "MAWT": "+0500",
        "MDT": "-0600",
        "MET": "+0100",
        "MEST": "+0200",
        "MHT": "+1200",
        "MIST": "+1100",
        "MIT": "-0930",
        "MMT": "+0630",
        "MSK": "+0400",
        "MST": "-0700",
        "MUT": "+0400",
        "MVT": "+0500",
        "MYT": "+0800",
        "NCT": "+1100",
        "NDT": "-0230",
        "NFT": "+1130",
        "NPT": "+0545",
        "NST": "-0330",
        "NT": "-0330",
        "NUT": "-1100",
        "NZDT": "+1300",
        "NZST": "+1200",
        "OMST": "+0700",
        "ORAT": "+0500",
        "PDT": "-0700",
        "PET": "-0500",
        "PETT": "+1200",
        "PGT": "+1000",
        "PHOT": "+1300",
        "PHT": "+0800",
        "PKT": "+0500",
        "PMDT": "-0200",
        "PMST": "-0300",
        "PONT": "+1100",
        "PST": "-0800",
        "PYST": "-0300",
        "PYT": "-0400",
        "RET": "+0400",
        "ROTT": "-0300",
        "SAKT": "+1100",
        "SAMT": "+0400",
        "SAST": "+0200",
        "SBT": "+1100",
        "SCT": "+0400",
        "SGT": "+0800",
        "SLST": "+0530",
        "SRT": "-0300",
        "SST": "+0800",
        "SYOT": "+0300",
        "TAHT": "-1000",
        "THA": "+0700",
        "TFT": "+0500",
        "TJT": "+0500",
        "TKT": "+1300",
        "TLT": "+0900",
        "TMT": "+0500",
        "TOT": "+1300",
        "TVT": "+1200",
        "UCT": "+0000",
        "ULAT": "+0800",
        "UTC": "+0000",
        "UYST": "-0200",
        "UYT": "-0300",
        "UZT": "+0500",
        "VET": "-0430",
        "VLAT": "+1000",
        "VOLT": "+0400",
        "VOST": "+0600",
        "VUT": "+1100",
        "WAKT": "+1200",
        "WAST": "+0200",
        "WAT": "+0100",
        "WEDT": "+0100",
        "WEST": "+0100",
        "WET": "+0000",
        "WST": "+0800",
        "YAKT": "+1000",
        "YEKT": "+0600",
        "Z": "+0000"
    };

    /**
     * Creates a parser for a mime stream
     *
     * @constructor
     */
    function MimeParser() {
        /**
         * Returned to the write calls
         */
        this.running = true;

        /**
         * Cache for parsed node objects
         */
        this.nodes = {};

        /**
         * Root node object
         */
        this.node = new MimeNode(null, this);

        /**
         * Data is written to nodes one line at the time. If entire line
         * is not received yet, buffer it before passing on
         */
        this._remainder = '';
    }

    /**
     * Writes a chunk of data to the processing queue. Splits data to lines and feeds
     * complete lines to the current node element
     *
     * @param {Uint8Array|String} chunk Chunk to be processed. Either an Uint8Array value or a 'binary' string
     */
    MimeParser.prototype.write = function(chunk) {
        if (!chunk || !chunk.length) {
            return !this.running;
        }

        var lines = (this._remainder + (typeof chunk === 'object' ?
            mimecodec.fromTypedArray(chunk) : chunk)).split(/\r?\n/g);
        this._remainder = lines.pop();

        for (var i = 0, len = lines.length; i < len; i++) {
            this.node.writeLine(lines[i]);
        }

        return !this.running;
    };

    /**
     * Indicates that there is no more data coming
     *
     * @param {Uint8Array|String} [chunk] Final chunk to be processed
     */
    MimeParser.prototype.end = function(chunk) {
        if (chunk && chunk.length) {
            this.write(chunk);
        }

        if (this.node._lineCount || this._remainder) {
            this.node.writeLine(this._remainder);
            this._remainder = '';
        }

        if (this.node) {
            this.node.finalize();
        }

        this.onend();
    };

    /**
     * Retrieves a mime part object for specified path
     *
     *   parser.getNode('1.2.3')
     *
     * @param {String} path Path to the node
     */
    MimeParser.prototype.getNode = function(path) {
        path = path || '';
        return this.nodes['node' + path] || null;
    };

    // PARSER EVENTS

    /**
     * Override this function.
     * Called when the parsing is ended
     * @event
     */
    MimeParser.prototype.onend = function() {};

    /**
     * Override this function.
     * Called when the parsing is ended
     * @event
     * @param {Object} node Current mime part. See node.header for header lines
     */
    MimeParser.prototype.onheader = function() {};

    /**
     * Override this function.
     * Called when a body chunk is emitted
     * @event
     * @param {Object} node Current mime part
     * @param {Uint8Array} chunk Body chunk
     */
    MimeParser.prototype.onbody = function() {};

    // NODE PROCESSING

    /**
     * Creates an object that holds and manages one part of the multipart message
     *
     * @constructor
     * @param {Object} parentNode Reference to the parent element. If not specified, then this is root node
     * @param {Object} parser MimeParser object
     */
    function MimeNode(parentNode, parser) {

        // Public properties

        /**
         * An array of unfolded header lines
         */
        this.header = [];

        /**
         * An object that holds header key=value pairs
         */
        this.headers = {};

        /**
         * Path for this node
         */
        this.path = parentNode ? parentNode.path.concat(parentNode._childNodes.length + 1) : [];

        // Private properties

        /**
         * Reference to the 'master' parser object
         */
        this._parser = parser;

        /**
         * Parent node for this specific node
         */
        this._parentNode = parentNode;

        /**
         * Current state, always starts out with HEADER
         */
        this._state = 'HEADER';

        /**
         * Body buffer
         */
        this._bodyBuffer = '';

        /**
         * Line counter bor the body part
         */
        this._lineCount = 0;

        /**
         * If this is a multipart or message/rfc822 mime part, the value
         * will be converted to array and hold all child nodes for this node
         */
        this._childNodes = false;

        /**
         * Active child node (if available)
         */
        this._currentChild = false;

        /**
         * Remainder string when dealing with base64 and qp values
         */
        this._lineRemainder = '';

        /**
         * Indicates if this is a multipart node
         */
        this._isMultipart = false;

        /**
         * Stores boundary value for current multipart node
         */
        this._multipartBoundary = false;

        /**
         * Indicates if this is a message/rfc822 node
         */
        this._isRfc822 = false;

        /**
         * Stores the raw content of this node
         */
        this.raw = '';

        // Att this node to the path cache
        this._parser.nodes['node' + this.path.join('.')] = this;
    }

    // Public methods

    /**
     * Processes an enitre input line
     *
     * @param {String} line Entire input line as 'binary' string
     */
    MimeNode.prototype.writeLine = function(line) {

        this.raw += (this.raw ? '\n' : '') + line;

        if (this._state === 'HEADER') {
            this._processHeaderLine(line);
        } else if (this._state === 'BODY') {
            this._processBodyLine(line);
        }
    };

    /**
     * Processes any remainders
     */
    MimeNode.prototype.finalize = function() {
        if (this._isRfc822) {
            this._currentChild.finalize();
        } else {
            this._emitBody(true);
        }
    };

    // Private methods

    /**
     * Processes a line in the HEADER state. It the line is empty, change state to BODY
     *
     * @param {String} line Entire input line as 'binary' string
     */
    MimeNode.prototype._processHeaderLine = function(line) {
        if (!line) {
            this._parseHeaders();
            this._parser.onheader(this);
            this._state = 'BODY';
            return;
        }

        if (line.match(/^\s/) && this.header.length) {
            this.header[this.header.length - 1] += '\n' + line;
        } else {
            this.header.push(line);
        }
    };

    /**
     * Joins folded header lines and calls Content-Type and Transfer-Encoding processors
     */
    MimeNode.prototype._parseHeaders = function() {

        // Join header lines
        var key, value, hasBinary;

        for (var i = 0, len = this.header.length; i < len; i++) {
            value = this.header[i].split(':');
            key = (value.shift() || '').trim().toLowerCase();
            value = (value.join(':') || '').replace(/\n/g, '').trim();

            if (value.match(/[\u0080-\uFFFF]/)) {
                if (!this.charset) {
                    hasBinary = true;
                }
                // use default charset at first and if the actual charset is resolved, the conversion is re-run
                value = mimecodec.charset.decode(mimecodec.charset.convert(mimecodec.toTypedArray(value), this.charset || 'iso-8859-1'));
            }

            if (!this.headers[key]) {
                this.headers[key] = [this._parseHeaderValue(key, value)];
            } else {
                this.headers[key].push(this._parseHeaderValue(key, value));
            }

            if (!this.charset && key === 'content-type') {
                this.charset = this.headers[key][this.headers[key].length - 1].params.charset;
            }

            if (hasBinary && this.charset) {
                // reset values and start over once charset has been resolved and 8bit content has been found
                hasBinary = false;
                this.headers = {};
                i = -1; // next iteration has i == 0
            }
        }

        this._processContentType();
        this._processContentTransferEncoding();
    };

    /**
     * Parses single header value
     * @param {String} key Header key
     * @param {String} value Value for the key
     * @return {Object} parsed header
     */
    MimeNode.prototype._parseHeaderValue = function(key, value) {
        var parsedValue, isAddress = false;

        switch (key) {
            case 'content-type':
            case 'content-transfer-encoding':
            case 'content-disposition':
            case 'dkim-signature':
                parsedValue = mimecodec.parseHeaderValue(value);
                break;
            case 'from':
            case 'sender':
            case 'to':
            case 'reply-to':
            case 'cc':
            case 'bcc':
            case 'abuse-reports-to':
            case 'errors-to':
            case 'return-path':
            case 'delivered-to':
                isAddress = true;
                parsedValue = {
                    value: [].concat(addressparser.parse(value) || [])
                };
                break;
            case 'date':
                parsedValue = {
                    value: this._parseDate(value)
                };
                break;
            default:
                parsedValue = {
                    value: value
                };
        }
        parsedValue.initial = value;

        this._decodeHeaderCharset(parsedValue, {
            isAddress: isAddress
        });

        return parsedValue;
    };

    /**
     * Checks if a date string can be parsed. Falls back replacing timezone
     * abbrevations with timezone values
     *
     * @param {String} str Date header
     * @returns {String} UTC date string if parsing succeeded, otherwise returns input value
     */
    MimeNode.prototype._parseDate = function(str) {
        str = (str || '').toString().trim();

        var date = new Date(str);

        if (this._isValidDate(date)) {
            return date.toUTCString().replace(/GMT/, '+0000');
        }

        // Assume last alpha part is a timezone
        // Ex: "Date: Thu, 15 May 2014 13:53:30 EEST"
        str = str.replace(/\b[a-z]+$/i, function(tz) {
            tz = tz.toUpperCase();
            if (TIMEZONE_ABBREVATIONS.hasOwnProperty(tz)) {
                return TIMEZONE_ABBREVATIONS[tz];
            }
            return tz;
        });

        date = new Date(str);

        if (this._isValidDate(date)) {
            return date.toUTCString().replace(/GMT/, '+0000');
        } else {
            return str;
        }
    };

    /**
     * Checks if a value is a Date object and it contains an actual date value
     * @param {Date} date Date object to check
     * @returns {Boolean} True if the value is a valid date
     */
    MimeNode.prototype._isValidDate = function(date) {
        return Object.prototype.toString.call(date) === '[object Date]' && date.toString() !== 'Invalid Date';
    };

    MimeNode.prototype._decodeHeaderCharset = function(parsed, options) {
        options = options || {};

        // decode default value
        if (typeof parsed.value === 'string') {
            parsed.value = mimecodec.mimeWordsDecode(parsed.value);
        }

        // decode possible params
        Object.keys(parsed.params || {}).forEach(function(key) {
            if (typeof parsed.params[key] === 'string') {
                parsed.params[key] = mimecodec.mimeWordsDecode(parsed.params[key]);
            }
        });

        // decode addresses
        if (options.isAddress && Array.isArray(parsed.value)) {
            parsed.value.forEach(function(addr) {
                if (addr.name) {
                    addr.name = mimecodec.mimeWordsDecode(addr.name);
                    if (Array.isArray(addr.group)) {
                        this._decodeHeaderCharset({
                            value: addr.group
                        }, {
                            isAddress: true
                        });
                    }
                }
            }.bind(this));
        }

        return parsed;
    };

    /**
     * Parses Content-Type value and selects following actions.
     */
    MimeNode.prototype._processContentType = function() {
        var contentDisposition;

        this.contentType = this.headers['content-type'] && this.headers['content-type'][0] ||
            mimecodec.parseHeaderValue('text/plain');
        this.contentType.value = (this.contentType.value || '').toLowerCase().trim();
        this.contentType.type = (this.contentType.value.split('/').shift() || 'text');

        if (this.contentType.params && this.contentType.params.charset && !this.charset) {
            this.charset = this.contentType.params.charset;
        }

        if (this.contentType.type === 'multipart' && this.contentType.params.boundary) {
            this._childNodes = [];
            this._isMultipart = (this.contentType.value.split('/').pop() || 'mixed');
            this._multipartBoundary = this.contentType.params.boundary;
        }

        if (this.contentType.value === 'message/rfc822') {
            /**
             * Parse message/rfc822 only if the mime part is not marked with content-disposition: attachment,
             * otherwise treat it like a regular attachment
             */
            contentDisposition = this.headers['content-disposition'] && this.headers['content-disposition'][0] ||
                mimecodec.parseHeaderValue('');
            if ((contentDisposition.value || '').toLowerCase().trim() !== 'attachment') {
                this._childNodes = [];
                this._currentChild = new MimeNode(this, this._parser);
                this._childNodes.push(this._currentChild);
                this._isRfc822 = true;
            }
        }
    };

    /**
     * Parses Content-Trasnfer-Encoding value to see if the body needs to be converted
     * before it can be emitted
     */
    MimeNode.prototype._processContentTransferEncoding = function() {
        this.contentTransferEncoding = this.headers['content-transfer-encoding'] && this.headers['content-transfer-encoding'][0] ||
            mimecodec.parseHeaderValue('7bit');
        this.contentTransferEncoding.value = (this.contentTransferEncoding.value || '').toLowerCase().trim();
    };

    /**
     * Processes a line in the BODY state. If this is a multipart or rfc822 node,
     * passes line value to child nodes.
     *
     * @param {String} line Entire input line as 'binary' string
     */
    MimeNode.prototype._processBodyLine = function(line) {
        var curLine, match;

        this._lineCount++;

        if (this._isMultipart) {
            if (line === '--' + this._multipartBoundary) {
                if (this._currentChild) {
                    this._currentChild.finalize();
                }
                this._currentChild = new MimeNode(this, this._parser);
                this._childNodes.push(this._currentChild);
            } else if (line === '--' + this._multipartBoundary + '--') {
                if (this._currentChild) {
                    this._currentChild.finalize();
                }
                this._currentChild = false;
            } else if (this._currentChild) {
                this._currentChild.writeLine(line);
            } else {
                // Ignore body for multipart
            }
        } else if (this._isRfc822) {
            this._currentChild.writeLine(line);
        } else {
            switch (this.contentTransferEncoding.value) {
                case 'base64':
                    curLine = this._lineRemainder + line.trim();

                    if (curLine.length % 4) {
                        this._lineRemainder = curLine.substr(-curLine.length % 4);
                        curLine = curLine.substr(0, curLine.length - this._lineRemainder.length);
                    } else {
                        this._lineRemainder = '';
                    }

                    if (curLine.length) {
                        this._bodyBuffer += mimecodec.fromTypedArray(mimecodec.base64.decode(curLine));
                    }

                    break;
                case 'quoted-printable':
                    curLine = this._lineRemainder + (this._lineCount > 1 ? '\n' : '') + line;

                    if ((match = curLine.match(/=[a-f0-9]{0,1}$/i))) {
                        this._lineRemainder = match[0];
                        curLine = curLine.substr(0, curLine.length - this._lineRemainder.length);
                    } else {
                        this._lineRemainder = '';
                    }

                    this._bodyBuffer += curLine.replace(/\=(\r?\n|$)/g, '').replace(/=([a-f0-9]{2})/ig, function(m, code) {
                        return String.fromCharCode(parseInt(code, 16));
                    });
                    break;
                    // case '7bit':
                    // case '8bit':
                default:
                    this._bodyBuffer += (this._lineCount > 1 ? '\n' : '') + line;
                    break;
            }
        }
    };

    /**
     * Emits a chunk of the body
     *
     * @param {Boolean} forceEmit If set to true does not keep any remainders
     */
    MimeNode.prototype._emitBody = function() {
        var contentDisposition = this.headers['content-disposition'] && this.headers['content-disposition'][0] ||
            mimecodec.parseHeaderValue('');
        var delSp;

        if (this._isMultipart || !this._bodyBuffer) {
            return;
        }

        // Process flowed text before emitting it
        if (/^text\/(plain|html)$/i.test(this.contentType.value) &&
            this.contentType.params && /^flowed$/i.test(this.contentType.params.format)) {

            delSp = /^yes$/i.test(this.contentType.params.delsp);

            this._bodyBuffer = this._bodyBuffer.
            split('\n').
            // remove soft linebreaks
            // soft linebreaks are added after space symbols
            reduce(function(previousValue, currentValue) {
                var body = previousValue;
                if (delSp) {
                    // delsp adds spaces to text to be able to fold it
                    // these spaces can be removed once the text is unfolded
                    body = body.replace(/[ ]+$/, '');
                }
                if (/ $/.test(previousValue) && !/(^|\n)\-\- $/.test(previousValue)) {
                    return body + currentValue;
                } else {
                    return body + '\n' + currentValue;
                }
            }).
            // remove whitespace stuffing
            // http://tools.ietf.org/html/rfc3676#section-4.4
            replace(/^ /gm, '');
        }

        this.content = mimecodec.toTypedArray(this._bodyBuffer);

        if (/^text\/(plain|html)$/i.test(this.contentType.value) && !/^attachment$/i.test(contentDisposition.value)) {

            if (!this.charset && /^text\/html$/i.test(this.contentType.value)) {
                this.charset = this._detectHTMLCharset(this._bodyBuffer);
            }

            // decode "binary" string to an unicode string
            if (!/^utf[\-_]?8$/i.test(this.charset)) {
                this.content = mimecodec.charset.convert(mimecodec.toTypedArray(this._bodyBuffer), this.charset || 'iso-8859-1');
            }

            // override charset for text nodes
            this.charset = this.contentType.params.charset = 'utf-8';
        }
        this._bodyBuffer = '';

        this._parser.onbody(this, this.content);
    };

    /**
     * Detect charset from a html file
     *
     * @param {String} html Input HTML
     * @returns {String} Charset if found or undefined
     */
    MimeNode.prototype._detectHTMLCharset = function(html) {
        var charset, input, meta;

        if (typeof html !== 'string') {
            html = html.toString('ascii');
        }

        html = html.replace(/\r?\n|\r/g, " ");

        if ((meta = html.match(/<meta\s+http-equiv=["'\s]*content-type[^>]*?>/i))) {
            input = meta[0];
        }

        if (input) {
            charset = input.match(/charset\s?=\s?([a-zA-Z\-_:0-9]*);?/);
            if (charset) {
                charset = (charset[1] || '').trim().toLowerCase();
            }
        }

        if (!charset && (meta = html.match(/<meta\s+charset=["'\s]*([^"'<>\/\s]+)/i))) {
            charset = (meta[1] || '').trim().toLowerCase();
        }

        return charset;
    };

    return MimeParser;
}));
