'use strict';

(function(factory) {
    if (typeof define === 'function' && define.amd) {
        define(['chai', 'sinon', '../src/emailjs-mime-parser', 'emailjs-stringencoding'], factory);
    } else if (typeof exports === 'object') {
        module.exports = factory(require('chai'), require('sinon'), require('../src/emailjs-mime-parser'), require('emailjs-stringencoding'));
    }
}(function(chai, sinon, Mimeparser, stringencoding) {
    var TextDecoder = stringencoding.TextDecoder;
    var expect = chai.expect;
    chai.Assertion.includeStack = true;

    describe('Mimeparser', function() {
        var parser;

        beforeEach(function() {
            parser = new Mimeparser();
        });

        describe('#write', function() {
            it('should split input to lines', function() {
                sinon.stub(parser.node, 'writeLine');

                parser.write('line1\r\nline');
                parser.write('2\r');
                parser.write('\nline3\r\nline4');

                expect(parser.node.writeLine.callCount).to.equal(3);
                expect(parser.node.writeLine.args[0][0]).to.equal('line1');
                expect(parser.node.writeLine.args[1][0]).to.equal('line2');
                expect(parser.node.writeLine.args[2][0]).to.equal('line3');
                expect(parser._remainder).to.equal('line4');

                parser.node.writeLine.restore();
            });
        });

        describe('#end', function() {
            it('should process the remainder', function() {
                sinon.stub(parser.node, 'writeLine');
                sinon.stub(parser.node, 'finalize');
                sinon.stub(parser, 'onend');

                parser._remainder = 'line4';
                parser.end();

                expect(parser.node.writeLine.withArgs('line4').callCount).to.equal(1);
                expect(parser.node.finalize.callCount).to.equal(1);
                expect(parser.onend.callCount).to.equal(1);
                expect(parser._remainder).to.equal('');

                parser.node.writeLine.restore();
                parser.node.finalize.restore();
                parser.onend.restore();
            });
        });

        describe('#getNode', function() {
            it('should retrieve a node', function() {
                parser.nodes['node1.2.3'] = 'abc';
                expect(parser.getNode('1.2.3')).to.equal('abc');
            });
        });

        describe('MimeNode tests', function() {
            var node;

            beforeEach(function() {
                node = parser.node;
            });

            describe('#writeLine', function() {
                it('should process the line according to current state', function() {
                    sinon.stub(node, '_processHeaderLine');
                    sinon.stub(node, '_processBodyLine');

                    node._state = 'HEADER';
                    node.writeLine('abc');

                    node._state = 'BODY';
                    node.writeLine('def');

                    expect(node._processHeaderLine.withArgs('abc').callCount).to.equal(1);
                    expect(node._processBodyLine.withArgs('def').callCount).to.equal(1);

                    node._processHeaderLine.restore();
                    node._processBodyLine.restore();
                });
            });

            describe('#finalize', function() {
                it('should call emit if needed', function() {
                    node._currentChild = {
                        finalize: function() {}
                    };

                    sinon.stub(node, '_emitBody');
                    sinon.stub(node._currentChild, 'finalize');

                    node._isRfc822 = false;
                    node.finalize();

                    node._isRfc822 = true;
                    node.finalize();

                    expect(node._emitBody.callCount).to.equal(1);
                    expect(node._currentChild.finalize.callCount).to.equal(1);

                    node._emitBody.restore();
                    node._currentChild.finalize.restore();
                });
            });

            describe('#_processHeaderLine', function() {
                it('should start body on empty line', function() {
                    sinon.stub(node, '_parseHeaders');
                    sinon.stub(node._parser, 'onheader');

                    node._state = 'HEADER';
                    node._processHeaderLine('');

                    expect(node._state).to.equal('BODY');
                    expect(node._parseHeaders.callCount).to.equal(1);
                    expect(node._parser.onheader.callCount).to.equal(1);

                    node._parseHeaders.restore();
                    node._parser.onheader.restore();
                });

                it('should push a line to the header', function() {
                    node.header = [];

                    node._processHeaderLine('abc');
                    node._processHeaderLine(' def');
                    node._processHeaderLine(' ghi');
                    node._processHeaderLine('jkl');

                    expect(node.header).to.deep.equal(['abc\n def\n ghi', 'jkl']);
                });
            });

            describe('#_parseHeaders', function() {
                it('should parse header values', function() {
                    sinon.stub(node, '_parseHeaderValue', function(a, b) {
                        return b;
                    });
                    sinon.stub(node, '_processContentType');
                    sinon.stub(node, '_processContentTransferEncoding');

                    node.headers = {};
                    node.header = ['ABC: def', 'GHI: jkl'];

                    node._parseHeaders();

                    expect(node.headers).to.deep.equal({
                        abc: ['def'],
                        ghi: ['jkl']
                    });
                    expect(node._parseHeaderValue.withArgs('abc', 'def').callCount).to.equal(1);
                    expect(node._parseHeaderValue.withArgs('ghi', 'jkl').callCount).to.equal(1);
                    expect(node._processContentType.callCount).to.equal(1);
                    expect(node._processContentTransferEncoding.callCount).to.equal(1);

                    node._parseHeaderValue.restore();
                    node._processContentType.restore();
                    node._processContentTransferEncoding.restore();
                });

                it('should default to latin1 charset for binary', function() {
                    sinon.stub(node, '_parseHeaderValue', function(a, b) {
                        if (a === 'content-type') {
                            return {
                                value: b,
                                params: {}
                            };
                        } else {
                            return b;
                        }
                    });
                    sinon.stub(node, '_processContentType');
                    sinon.stub(node, '_processContentTransferEncoding');

                    node.headers = {};
                    node.header = ['a: \xD5\xC4\xD6\xDC', 'Content-Type: text/plain', 'b: \xD5\xC4\xD6\xDC'];
                    node._parseHeaders();

                    expect(node.headers).to.deep.equal({
                        a: ['ÕÄÖÜ'],
                        b: ['ÕÄÖÜ'],
                        'content-type': [{
                            value: 'text/plain',
                            params: {}
                        }]
                    });

                    node._parseHeaderValue.restore();
                    node._processContentType.restore();
                    node._processContentTransferEncoding.restore();
                });

                it('should detect utf8 charset for binary', function() {
                    sinon.stub(node, '_parseHeaderValue', function(a, b) {
                        if (a === 'content-type') {
                            return {
                                value: b,
                                params: {
                                    charset: 'utf-8'
                                }
                            };
                        } else {
                            return b;
                        }
                    });
                    sinon.stub(node, '_processContentType');
                    sinon.stub(node, '_processContentTransferEncoding');

                    node.headers = {};
                    node.header = ['a: \xC3\x95\xC3\x84\xC3\x96\xC3\x9C', 'Content-Type: text/plain', 'b: \xC3\x95\xC3\x84\xC3\x96\xC3\x9C'];
                    node._parseHeaders();

                    expect(node.headers).to.deep.equal({
                        a: ['ÕÄÖÜ'],
                        b: ['ÕÄÖÜ'],
                        'content-type': [{
                            value: 'text/plain',
                            params: {
                                charset: 'utf-8'
                            }
                        }]
                    });

                    node._parseHeaderValue.restore();
                    node._processContentType.restore();
                    node._processContentTransferEncoding.restore();
                });
            });

            describe('#_parseHeaderValue', function() {
                it('should parse objects', function() {
                    sinon.stub(node, '_decodeHeaderCharset');

                    expect(node._parseHeaderValue('content-type', 'text/plain; charset=utf-8')).to.deep.equal({
                        initial: 'text/plain; charset=utf-8',
                        value: 'text/plain',
                        params: {
                            charset: 'utf-8'
                        }
                    });

                    expect(node._decodeHeaderCharset.callCount).to.equal(1);

                    node._decodeHeaderCharset.restore();
                });

                it('should parse addresses', function() {
                    sinon.stub(node, '_decodeHeaderCharset');

                    expect(node._parseHeaderValue('to', 'a@b.ce')).to.deep.equal({
                        initial: 'a@b.ce',
                        value: [{
                            name: '',
                            address: 'a@b.ce'
                        }]
                    });

                    expect(node._decodeHeaderCharset.callCount).to.equal(1);

                    node._decodeHeaderCharset.restore();
                });

                it('should preserve strings', function() {
                    sinon.stub(node, '_decodeHeaderCharset');

                    expect(node._parseHeaderValue('x-my', 'zzzz')).to.deep.equal({
                        initial: 'zzzz',
                        value: 'zzzz'
                    });

                    expect(node._decodeHeaderCharset.callCount).to.equal(1);

                    node._decodeHeaderCharset.restore();
                });

                it('should have unicode subject with strange characters', function() {
                    expect(node._parseHeaderValue('Subject', '=?UTF-8?Q?=CB=86=C2=B8=C3=81=C3=8C=C3=93=C4=B1?=\r\n =?UTF-8?Q?=C3=8F=CB=87=C3=81=C3=9B^=C2=B8\\=C3=81?=\r\n =?UTF-8?Q?=C4=B1=CB=86=C3=8C=C3=81=C3=9B=C3=98^\\?=\r\n =?UTF-8?Q?=CB=9C=C3=9B=CB=9D=E2=84=A2=CB=87=C4=B1?=\r\n =?UTF-8?Q?=C3=93=C2=B8^\\=CB=9C=EF=AC=81^\\=C2=B7\\?=\r\n =?UTF-8?Q?=CB=9C=C3=98^=C2=A3=CB=9C#=EF=AC=81^\\?=\r\n =?UTF-8?Q?=C2=A3=EF=AC=81^\\=C2=A3=EF=AC=81^\\?=').value).to.equal('ˆ¸ÁÌÓıÏˇÁÛ^¸\\ÁıˆÌÁÛØ^\\˜Û˝™ˇıÓ¸^\\˜ﬁ^\\·\\˜Ø^£˜#ﬁ^\\£ﬁ^\\£ﬁ^\\');
                });

            });

            describe('#_parseDate', function() {
                it('should parse Date object', function() {
                    var date = 'Thu, 15 May 2014 11:53:30 +0100';
                    expect(node._parseDate(date)).to.equal('Thu, 15 May 2014 10:53:30 +0000');
                });

                it('should parse Date object with tz abbr', function() {
                    var date = 'Thu, 15 May 2014 10:53:30 UTC';
                    expect(node._parseDate(date)).to.equal('Thu, 15 May 2014 10:53:30 +0000');
                });

                it('should parse Date object with european tz', function() {
                    var date = 'Thu, 15 May 2014 13:53:30 EEST';
                    expect(node._parseDate(date)).to.equal('Thu, 15 May 2014 10:53:30 +0000');
                });

                it('should return original on unexpected input', function() {
                    var date = 'Thu, 15 May 2014 13:53:30 YYY';
                    expect(node._parseDate(date)).to.equal('Thu, 15 May 2014 13:53:30 YYY');
                });
            });

            describe('#_isValidDate', function() {
                it('should detect proper Date object', function() {
                    expect(node._isValidDate(new Date())).to.be.true;
                });
                it('should detect invalid Date object', function() {
                    expect(node._isValidDate(new Date('ooo'))).to.be.false;
                });
                it('should detect invalid input', function() {
                    expect(node._isValidDate('ooo')).to.be.false;
                });
            });

            describe('#_decodeHeaderCharset', function() {
                it('should decode object values', function() {
                    expect(node._decodeHeaderCharset({
                        value: 'tere =?iso-8859-1?Q?=F5=E4=F6=FC?='
                    })).to.deep.equal({
                        value: 'tere õäöü'
                    });

                    expect(node._decodeHeaderCharset({
                        params: {
                            a: 'tere =?iso-8859-1?Q?=F5=E4=F6=FC?='
                        }
                    })).to.deep.equal({
                        params: {
                            a: 'tere õäöü'
                        }
                    });
                });

                it('should decode addresses', function() {
                    expect(node._decodeHeaderCharset({
                        value: [{
                            name: 'tere =?iso-8859-1?Q?=F5=E4=F6=FC?='
                        }]
                    }, {
                        isAddress: true
                    })).to.deep.equal({
                        value: [{
                            name: 'tere õäöü'
                        }]
                    });
                });
            });

            describe('#_processContentType', function() {
                it('should fetch special properties from content-type header', function() {
                    node.headers['content-type'] = [{
                        value: 'multipart/mixed',
                        params: {
                            charset: 'utf-8',
                            boundary: 'zzzz'
                        }
                    }];

                    node._processContentType();

                    expect(node.contentType).to.deep.equal({
                        value: 'multipart/mixed',
                        type: 'multipart',
                        params: {
                            charset: 'utf-8',
                            boundary: 'zzzz'
                        }
                    });
                    expect(node.charset).to.equal('utf-8');
                    expect(node._isMultipart).to.equal('mixed');
                    expect(node._multipartBoundary).to.equal('zzzz');
                });
            });

            describe('#_processContentTransferEncoding', function() {
                it('should fetch special properties from content-transfer-encoding header', function() {
                    node.headers['content-transfer-encoding'] = [{
                        value: 'BASE64'
                    }];

                    node._processContentTransferEncoding();

                    expect(node.contentTransferEncoding).to.deep.equal({
                        value: 'base64'
                    });
                });

                it('should set default transfer encoding to 7bit', function() {
                    node._processContentTransferEncoding();

                    expect(node.contentTransferEncoding).to.deep.equal({
                        value: '7bit',
                        params: {}
                    });
                });
            });

            describe('#_processBodyLine', function() {
                describe('multipart nodes', function() {
                    it('should add new node on boundary', function() {
                        node._childNodes = [];
                        node._isMultipart = 'mixed';
                        node._multipartBoundary = 'zzz';

                        node._processBodyLine('--zzz');

                        expect(node._childNodes.length).to.equal(1);
                        var finalizeStub = sinon.stub(node._currentChild, 'finalize');

                        node._processBodyLine('--zzz');
                        expect(node._childNodes.length).to.equal(2);
                        expect(finalizeStub.callCount).to.equal(1);

                        finalizeStub.restore();
                    });

                    it('should close node on boundary', function() {
                        node._isMultipart = 'mixed';
                        node._multipartBoundary = 'zzz';
                        node._currentChild = {
                            finalize: function() {}
                        };
                        node._childNodes = [node._currentChild];

                        var finalizeStub = sinon.stub(node._currentChild, 'finalize');
                        node._processBodyLine('--zzz--');
                        expect(finalizeStub.callCount).to.equal(1);

                        finalizeStub.restore();
                    });

                    it('should write a line to the current node', function() {
                        node._isMultipart = 'mixed';
                        node._multipartBoundary = 'zzz';
                        node._currentChild = {
                            writeLine: function() {}
                        };
                        node._childNodes = [node._currentChild];

                        var writeLineStub = sinon.stub(node._currentChild, 'writeLine');
                        node._processBodyLine('abc');
                        expect(writeLineStub.withArgs('abc').callCount).to.equal(1);

                        writeLineStub.restore();
                    });
                });

                it('should write a line to the current RFC822 node', function() {
                    node._isRfc822 = true;
                    node._currentChild = {
                        writeLine: function() {}
                    };
                    node._childNodes = [node._currentChild];

                    var writeLineStub = sinon.stub(node._currentChild, 'writeLine');
                    node._processBodyLine('abc');
                    expect(writeLineStub.withArgs('abc').callCount).to.equal(1);

                    writeLineStub.restore();
                });

                it('should process base64 data', function() {
                    node.contentTransferEncoding = {
                        value: 'base64'
                    };

                    node._lineRemainder = 'YW';
                    node._processBodyLine('JjZGV');

                    expect(node._lineRemainder).to.equal('ZGV');
                    expect(node._bodyBuffer).to.equal('abc');
                });

                it('should process quoted-printable data', function() {
                    //=C3=B5=C3=A4=C3=B6=C3=BC
                    node.contentTransferEncoding = {
                        value: 'quoted-printable'
                    };

                    node._lineRemainder = '=C';
                    node._processBodyLine('3=B5=C3=A4=C');

                    expect(node._lineRemainder).to.equal('=C');
                    expect(node._bodyBuffer).to.equal('ÃµÃ¤');
                });

                it('should process unencoded input', function() {
                    node.contentTransferEncoding = {
                        value: 'uuu'
                    };
                    node._processBodyLine('zzzz');
                    node._processBodyLine('xxxx');

                    expect(node._bodyBuffer).to.equal('zzzz\nxxxx');
                });
            });

            describe('#_emitBody', function() {
                it('should emit an undecoded typed array for non text nodes', function() {
                    sinon.stub(node._parser, 'onbody');

                    node.contentType = {
                        value: 'attachment/bin'
                    };

                    node._bodyBuffer = '\xfe\xf0';
                    node._emitBody();

                    expect(node._parser.onbody.args[0][1]).to.deep.equal(new Uint8Array([0xfe, 0xf0]));

                    node._parser.onbody.restore();
                });

                it('should emit a decoded typed array for text nodes', function() {
                    sinon.stub(node._parser, 'onbody');

                    node.contentType = {
                        value: 'text/plain',
                        params: {
                            charset: 'iso-8859-1'
                        }
                    };
                    node.charset = 'iso-8859-13';
                    node._bodyBuffer = '\xfe\xf0';
                    node._emitBody();

                    expect(node._parser.onbody.args[0][1]).to.deep.equal(new Uint8Array([0xC5, 0xBE, 0xC5, 0xA1]));
                    expect(node.charset).to.equal('utf-8');

                    node._parser.onbody.restore();
                });

                it('should check non unicode charset from html', function() {
                    sinon.stub(node._parser, 'onbody');
                    sinon.stub(node, '_detectHTMLCharset').returns('iso-8859-13');

                    node.contentType = {
                        value: 'text/html',
                        params: {}
                    };
                    node._bodyBuffer = '\xfe\xf0';
                    node._emitBody();

                    expect(node._parser.onbody.args[0][1]).to.deep.equal(new Uint8Array([0xC5, 0xBE, 0xC5, 0xA1]));
                    expect(node.charset).to.equal('utf-8');

                    node._parser.onbody.restore();
                });

                it('should check unicode charset from html', function() {
                    sinon.stub(node._parser, 'onbody');
                    sinon.stub(node, '_detectHTMLCharset').returns('utf-8');

                    node.contentType = {
                        value: 'text/html',
                        params: {}
                    };
                    node._bodyBuffer = '\xC5\xBE\xC5\xA1';
                    node._emitBody();

                    expect(node._parser.onbody.args[0][1]).to.deep.equal(new Uint8Array([0xC5, 0xBE, 0xC5, 0xA1]));
                    expect(node.charset).to.equal('utf-8');

                    node._parser.onbody.restore();
                });
            });

            describe('#_detectHTMLCharset', function() {
                var node;

                beforeEach(function() {
                    node = parser.node;
                });

                it('should detect charset from simple meta', function() {
                    expect(node._detectHTMLCharset('\n\n<meta charset="utf-8">')).to.equal('utf-8');
                    expect(node._detectHTMLCharset('\n\n<meta\n charset="utf-8">')).to.equal('utf-8');
                    expect(node._detectHTMLCharset('\n\n<meta\n charset=utf-8>')).to.equal('utf-8');
                });

                it('should detect charset from http-equiv meta', function() {
                    expect(node._detectHTMLCharset('\n\n<meta http-equiv="content-type" content="text/html; charset=utf-8" />')).to.equal('utf-8');
                    expect(node._detectHTMLCharset('\n\n<meta http-equiv=content-type content="text/html; charset=utf-8" />')).to.equal('utf-8');
                });
            });
        });

        describe('message tests', function() {
            it('should succeed', function(done) {
                var fixture = 'From: Sender Name <sender.name@example.com>\r\nTo: Receiver Name <receiver.name@example.com>\r\nSubject: Hello world!\r\nDate: Fri, 4 Oct 2013 07:17:32 +0000\r\nMessage-Id: <simplemessage@localhost>\r\nContent-Type: text/plain; charset="utf-8"\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\n\r\nHi,\r\n\r\nthis is a private conversation. To read my encrypted message below, simply =\r\nopen it in Whiteout Mail.\r\nOpen Whiteout Mail: https://chrome.google.com/webstore/detail/jjgghafhamhol=\r\njigjoghcfcekhkonijg\r\n\r\n';
                parser.onheader = function(node) {
                    expect(node.header).to.deep.equal([
                        'From: Sender Name <sender.name@example.com>',
                        'To: Receiver Name <receiver.name@example.com>',
                        'Subject: Hello world!',
                        'Date: Fri, 4 Oct 2013 07:17:32 +0000',
                        'Message-Id: <simplemessage@localhost>',
                        'Content-Type: text/plain; charset=\"utf-8\"',
                        'Content-Transfer-Encoding: quoted-printable'
                    ]);
                };

                var expectedText = '\nHi,\n\nthis is a private conversation. To read my encrypted message below, simply open it in Whiteout Mail.\nOpen Whiteout Mail: https://chrome.google.com/webstore/detail/jjgghafhamholjigjoghcfcekhkonijg\n\n';
                parser.onbody = function(node, chunk) {
                    expect(new TextDecoder('utf-8').decode(chunk)).to.equal(expectedText);
                };

                parser.onend = function() {
                    expect(parser.nodes).to.not.be.empty;
                    expect(new TextDecoder('utf-8').decode(parser.nodes.node.content)).to.equal(expectedText);

                    done();
                };
                parser.write(fixture);
                parser.end();
            });

            it('should parse specific headers', function(done) {
                var fixture = 'From: Sender Name <sender.name@example.com>\r\nTo: Receiver Name <receiver.name@example.com>\r\nSubject: Hello world!\r\nDate: Fri, 4 Oct 2013 07:17:32 +0000\r\nMessage-Id: <simplemessage@localhost>\r\nContent-Type: multipart/signed; protocol="TYPE/STYPE"; micalg="MICALG"; boundary="Signed Boundary"\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\n';
                parser.onheader = function(node) {

                    expect(node.headers.from).to.deep.equal([{
                        value: [{
                            address: 'sender.name@example.com',
                            name: 'Sender Name'
                        }],
                        initial: 'Sender Name <sender.name@example.com>'
                    }]);

                    expect(node.headers.subject).to.deep.equal([{
                        value: 'Hello world!',
                        initial: 'Hello world!'
                    }]);

                    expect(node.headers['content-type']).to.deep.equal([{
                        value: 'multipart/signed',
                        params: {
                            boundary: 'Signed Boundary',
                            micalg: 'MICALG',
                            protocol: 'TYPE/STYPE'
                        },
                        type: 'multipart',
                        initial: 'multipart/signed; protocol="TYPE/STYPE"; micalg="MICALG"; boundary="Signed Boundary"'
                    }]);

                };

                parser.onend = function() {
                    done();
                };

                parser.write(fixture);
                parser.end();
            });

            it('should parse header and body', function(done) {
                var fixture = 'Content-Type: text/plain; name="foo.txt"\r\nContent-Disposition: attachment; filename="foo.txt"\r\nContent-Transfer-Encoding: base64\r\n\r\nZm9vZm9vZm9vZm9vZm9v\r\n';

                parser.onheader = function(node) {
                    expect(node.header).to.deep.equal([
                        'Content-Type: text/plain; name="foo.txt"',
                        'Content-Disposition: attachment; filename="foo.txt"',
                        'Content-Transfer-Encoding: base64'
                    ]);
                };

                parser.onbody = function(node, chunk) {
                    expect(new TextDecoder('utf-8').decode(chunk)).to.equal('foofoofoofoofoo');
                };

                parser.onend = function() {
                    expect(parser.nodes).to.not.be.empty;
                    expect(new TextDecoder('utf-8').decode(parser.nodes.node.content)).to.equal('foofoofoofoofoo');
                    done();
                };
                parser.write(fixture);
                parser.end();
            });

            it('should parse encoded headers', function(done) {
                var fixture = 'Subject: =?iso-8859-1?Q?Avaldu?= =?iso-8859-1?Q?s_lepingu_?=\r\n' +
                    ' =?iso-8859-1?Q?l=F5petamise?= =?iso-8859-1?Q?ks?=\r\n' +
                    'Content-Disposition: attachment;\r\n' +
                    '  filename*0*=UTF-8\'\'%C3%95%C3%84;\r\n' +
                    '  filename*1*=%C3%96%C3%9C\r\n' +
                    'From: =?gb2312?B?086yyZjl?= user@ldkf.com.tw\r\n' +
                    'To: =?UTF-8?Q?=C3=95=C3=84=C3=96=C3=9C?=:=?gb2312?B?086yyZjl?= user@ldkf.com.tw;\r\n' +
                    'Content-Disposition: attachment; filename="=?UTF-8?Q?=C3=95=C3=84=C3=96=C3=9C?="\r\n' +
                    '\r\n' +
                    'abc';
                parser.onheader = function(node) {
                    expect(node.headers).to.deep.equal({
                        subject: [{
                            value: 'Avaldus lepingu lõpetamiseks',
                            initial: '=?iso-8859-1?Q?Avaldu?= =?iso-8859-1?Q?s_lepingu_?= =?iso-8859-1?Q?l=F5petamise?= =?iso-8859-1?Q?ks?='
                        }],
                        'content-disposition': [{
                            value: 'attachment',
                            params: {
                                filename: 'ÕÄÖÜ'
                            },
                            initial: 'attachment;  filename*0*=UTF-8\'\'%C3%95%C3%84;  filename*1*=%C3%96%C3%9C'
                        }, {
                            value: 'attachment',
                            params: {
                                filename: 'ÕÄÖÜ'
                            },
                            initial: 'attachment; filename="=?UTF-8?Q?=C3=95=C3=84=C3=96=C3=9C?="'
                        }],
                        from: [{
                            value: [{
                                address: 'user@ldkf.com.tw',
                                name: '游采樺'
                            }],
                            initial: '=?gb2312?B?086yyZjl?= user@ldkf.com.tw'
                        }],
                        to: [{
                            value: [{
                                name: 'ÕÄÖÜ',
                                group: [{
                                    address: 'user@ldkf.com.tw',
                                    name: '游采樺'
                                }]
                            }],
                            initial: '=?UTF-8?Q?=C3=95=C3=84=C3=96=C3=9C?=:=?gb2312?B?086yyZjl?= user@ldkf.com.tw;'
                        }]
                    });
                };

                parser.onend = function() {
                    done();
                };

                parser.write(fixture);
                parser.end();
            });

            it('should decode plaintext body from latin-1 charset', function(done) {
                var fixture = 'Content-Type: text/plain; charset="latin_1"\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\nl=F5petam';
                var expectedText = 'lõpetam';

                parser.onbody = function(node, chunk) {
                    expect(new TextDecoder('utf-8').decode(chunk)).to.equal(expectedText);
                };

                parser.onend = function() {
                    expect(new TextDecoder('utf-8').decode(parser.nodes.node.content)).to.equal(expectedText);
                    done();
                };
                parser.write(fixture);
                parser.end();
            });

            it('should ignore charset for plaintext attachment', function(done) {
                var fixture = 'Content-Type: text/plain; charset="latin_1"\r\nContent-Disposition: attachment\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\nl=F5petam';
                var expectedText = 'lõpetam';

                parser.onbody = function(node, chunk) {
                    expect(new TextDecoder('iso-8859-1').decode(chunk)).to.equal(expectedText);
                };

                parser.onend = function() {
                    expect(new TextDecoder('iso-8859-1').decode(parser.nodes.node.content)).to.equal(expectedText);
                    done();
                };
                parser.write(fixture);
                parser.end();
            });

            it('should detect charset from html', function(done) {
                var fixture = 'Content-Type: text/plain;\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\n=3Cmeta=20charset=3D=22latin_1=22/=3E=D5=C4=D6=DC';
                var expectedText = '<meta charset="latin_1"/>ÕÄÖÜ';

                parser.onbody = function(node, chunk) {
                    expect(new TextDecoder('utf-8').decode(chunk)).to.equal(expectedText);
                };

                parser.onend = function() {
                    expect(new TextDecoder('utf-8').decode(parser.nodes.node.content)).to.equal(expectedText);
                    done();
                };
                parser.write(fixture);
                parser.end();
            });

            it('should use latin1 as the default for headers', function(done) {
                var fixture = 'a: \xD5\xC4\xD6\xDC\r\nContent-Type: text/plain\r\nb: \xD5\xC4\xD6\xDC\r\n\r\n';

                parser.onheader = function(node) {
                    expect(node.headers.a[0].value).to.equal('ÕÄÖÜ');
                    expect(node.headers.b[0].value).to.equal('ÕÄÖÜ');
                };

                parser.onend = done;
                parser.write(fixture);
                parser.end();
            });

            it('should parse date header', function(done) {
                var fixture = 'Date: Thu, 15 May 2014 13:53:30 EEST\r\n\r\n';

                parser.onheader = function(node) {
                    expect(node.headers.date[0].value).to.equal('Thu, 15 May 2014 10:53:30 +0000');
                };

                parser.onend = done;
                parser.write(fixture);
                parser.end();
            });

            it('should detect 8bit header encoding from content-type', function(done) {
                var fixture = 'a: \xC3\x95\xC3\x84\xC3\x96\xC3\x9C\r\nContent-Type: text/plain; charset=utf-8\r\nb: \xC3\x95\xC3\x84\xC3\x96\xC3\x9C\r\n\r\n';

                parser.onheader = function(node) {
                    expect(node.headers.a[0].value).to.equal('ÕÄÖÜ');
                    expect(node.headers.b[0].value).to.equal('ÕÄÖÜ');
                };

                parser.onend = done;
                parser.write(fixture);
                parser.end();
            });

            it('should store raw content for a node', function(done) {
                var fixtures = {
                    'root': 'MIME-Version: 1.0\n' +
                        'Content-Type: multipart/mixed; boundary=frontier\n' +
                        '\n' +
                        'This is a message with multiple parts in MIME format.\n' +
                        '--frontier\n' +
                        'Content-Type: text/plain\n' +
                        '\n' +
                        'This is the body of the message.\n' +
                        '\n' +
                        '--frontier\n' +
                        'Content-Type: multipart/mixed; boundary=sub\n' +
                        '\n' +
                        '--sub\n' +
                        'Content-Type: text/plain\n' +
                        '\n' +
                        'This is the body of the message.\n' +
                        '\n' +
                        '--sub--\n' +
                        '\n' +
                        '--frontier\n' +
                        'Content-Type: application/octet-stream\n' +
                        'Content-Transfer-Encoding: base64\n' +
                        '\n' +
                        'PGh0bWw+CiAgPGhlYWQ+CiAgPC9oZWFkPgogIDxib2R5P\n' +
                        'gogICAgPHA+VGhpcyBpcyB0aGUgYm9keSBvZiB0aGUgbW\n' +
                        'Vzc2FnZS48L3A+CiAgPC9ib2R5Pgo8L2h0bWw+Cg==\n' +
                        '--frontier--',
                    '1': 'Content-Type: text/plain\n' +
                        '\n' +
                        'This is the body of the message.\n' +
                        '',
                    '2': 'Content-Type: multipart/mixed; boundary=sub\n' +
                        '\n' +
                        '--sub\n' +
                        'Content-Type: text/plain\n' +
                        '\n' +
                        'This is the body of the message.\n' +
                        '\n' +
                        '--sub--\n' +
                        '',
                    '2.1': 'Content-Type: text/plain\n' +
                        '\n' +
                        'This is the body of the message.\n' +
                        '',
                    '3': 'Content-Type: application/octet-stream\n' +
                        'Content-Transfer-Encoding: base64\n' +
                        '\n' +
                        'PGh0bWw+CiAgPGhlYWQ+CiAgPC9oZWFkPgogIDxib2R5P\n' +
                        'gogICAgPHA+VGhpcyBpcyB0aGUgYm9keSBvZiB0aGUgbW\n' +
                        'Vzc2FnZS48L3A+CiAgPC9ib2R5Pgo8L2h0bWw+Cg=='
                };

                parser.onend = function() {
                    expect(parser.getNode().raw).to.equal(fixtures.root);
                    expect(parser.getNode('1').raw).to.equal(fixtures['1']);
                    expect(parser.getNode('2').raw).to.equal(fixtures['2']);
                    expect(parser.getNode('2.1').raw).to.equal(fixtures['2.1']);
                    expect(parser.getNode('3').raw).to.equal(fixtures['3']);
                    done();
                };
                parser.write(fixtures.root);
                parser.end();
            });

            it('should parse format=flowed text', function(done) {
                var fixture = 'Content-Type: text/plain; format=flowed\r\n\r\nFirst line \r\ncontinued \r\nand so on\n-- \nSignature\ntere\n From\n  Hello\n > abc\nabc\n';

                parser.onend = function() {
                    expect(parser.nodes).to.not.be.empty;
                    expect(new TextDecoder('utf-8').decode(parser.nodes.node.content)).to.equal('First line continued and so on\n-- \nSignature\ntere\nFrom\n Hello\n> abc\nabc\n');
                    done();
                };

                parser.write(fixture);
                parser.end();
            });

            it('should not corrupt format=flowed text that is not flowed', function(done) {
                var fixture = 'Content-Type: text/plain; format=flowed\r\n\r\nFirst line.\r\nSecond line.\r\n';

                parser.onend = function() {
                    expect(parser.nodes).to.not.be.empty;
                    expect(new TextDecoder('utf-8').decode(parser.nodes.node.content)).to.equal('First line.\nSecond line.\n');
                    done();
                };

                parser.write(fixture);
                parser.end();
            });

            it('should parse format=fixed text', function(done) {
                var fixture = 'Content-Type: text/plain; format=fixed\r\n\r\nFirst line \r\ncontinued \r\nand so on';

                parser.onend = function() {
                    expect(parser.nodes).to.not.be.empty;
                    expect(new TextDecoder('utf-8').decode(parser.nodes.node.content)).to.equal('First line \ncontinued \nand so on');
                    done();
                };

                parser.write(fixture);
                parser.end();
            });

            it('should parse delsp=yes text', function(done) {
                var fixture = 'Content-Type: text/plain; format=flowed; delsp=yes\r\n\r\nFirst line \r\ncontinued \r\nand so on';

                parser.onend = function() {
                    expect(parser.nodes).to.not.be.empty;
                    expect(new TextDecoder('utf-8').decode(parser.nodes.node.content)).to.equal('First linecontinuedand so on');
                    done();
                };

                parser.write(fixture);
                parser.end();
            });
        });
    });
}));
