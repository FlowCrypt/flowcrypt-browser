'use strict';

(function(factory) {
    if (typeof define === 'function' && define.amd) {
        define(['chai', 'sinon', '../src/mailbuild'], factory);
    } else if (typeof exports === 'object') {
        module.exports = factory(require('chai'), require('sinon'), require('../src/mailbuild'));
    }
}(function(chai, sinon, Mailbuild) {
    var expect = chai.expect;
    chai.Assertion.includeStack = true;

    describe('mailbuild', function() {
        it('should create mailbuild object', function() {
            expect(new Mailbuild()).to.exist;
        });

        describe('#createChild', function() {
            it('should create child', function() {
                var mb = new Mailbuild('multipart/mixed');

                var child = mb.createChild('multipart/mixed');
                expect(child.parentNode).to.equal(mb);
                expect(child.rootNode).to.equal(mb);

                var subchild1 = child.createChild('text/html');
                expect(subchild1.parentNode).to.equal(child);
                expect(subchild1.rootNode).to.equal(mb);

                var subchild2 = child.createChild('text/html');
                expect(subchild2.parentNode).to.equal(child);
                expect(subchild2.rootNode).to.equal(mb);
            });
        });

        describe('#appendChild', function() {
            it('should append child node', function() {
                var mb = new Mailbuild('multipart/mixed');

                var child = new Mailbuild('text/plain');
                mb.appendChild(child);
                expect(child.parentNode).to.equal(mb);
                expect(child.rootNode).to.equal(mb);
                expect(mb._childNodes.length).to.equal(1);
                expect(mb._childNodes[0]).to.equal(child);
            });
        });

        describe('#replace', function() {
            it('should replace node', function() {
                var mb = new Mailbuild(),
                    child = mb.createChild('text/plain'),
                    replacement = new Mailbuild('image/png');

                child.replace(replacement);

                expect(mb._childNodes.length).to.equal(1);
                expect(mb._childNodes[0]).to.equal(replacement);
            });
        });

        describe('#remove', function() {
            it('should remove node', function() {
                var mb = new Mailbuild(),
                    child = mb.createChild('text/plain');

                child.remove();
                expect(mb._childNodes.length).to.equal(0);
                expect(child.parenNode).to.not.exist;
            });
        });

        describe('#setHeader', function() {
            it('should set header', function() {
                var mb = new Mailbuild();

                mb.setHeader('key', 'value');
                mb.setHeader('key', 'value1');
                expect(mb.getHeader('Key')).to.equal('value1');

                mb.setHeader([{
                    key: 'key',
                    value: 'value2'
                }, {
                    key: 'key2',
                    value: 'value3'
                }]);

                expect(mb._headers).to.deep.equal([{
                    key: 'Key',
                    value: 'value2'
                }, {
                    key: 'Key2',
                    value: 'value3'
                }]);

                mb.setHeader({
                    key: 'value4',
                    key2: 'value5'
                });

                expect(mb._headers).to.deep.equal([{
                    key: 'Key',
                    value: 'value4'
                }, {
                    key: 'Key2',
                    value: 'value5'
                }]);
            });
        });

        describe('#addHeader', function() {
            it('should add header', function() {
                var mb = new Mailbuild();

                mb.addHeader('key', 'value1');
                mb.addHeader('key', 'value2');

                mb.addHeader([{
                    key: 'key',
                    value: 'value2'
                }, {
                    key: 'key2',
                    value: 'value3'
                }]);

                mb.addHeader({
                    key: 'value4',
                    key2: 'value5'
                });

                expect(mb._headers).to.deep.equal([{
                    key: 'Key',
                    value: 'value1'
                }, {
                    key: 'Key',
                    value: 'value2'
                }, {
                    key: 'Key',
                    value: 'value2'
                }, {
                    key: 'Key2',
                    value: 'value3'
                }, {
                    key: 'Key',
                    value: 'value4'
                }, {
                    key: 'Key2',
                    value: 'value5'
                }]);
            });
        });

        describe('#getHeader', function() {
            it('should return first matching header value', function() {
                var mb = new Mailbuild();
                mb._headers = [{
                    key: 'Key',
                    value: 'value4'
                }, {
                    key: 'Key2',
                    value: 'value5'
                }];

                expect(mb.getHeader('KEY')).to.equal('value4');
            });
        });

        describe('#setContent', function() {
            it('should set the contents for a node', function() {
                var mb = new Mailbuild();
                mb.setContent('abc');
                expect(mb.content).to.equal('abc');
            });
        });

        describe('#build', function() {
            it('should build root node', function() {
                var mb = new Mailbuild('text/plain').
                setHeader({
                    date: '12345',
                    'message-id': '67890'
                }).
                setContent('Hello world!'),

                expected = 'Content-Type: text/plain\r\n' +
                    'Date: 12345\r\n' +
                    'Message-Id: <67890>\r\n' +
                    'Content-Transfer-Encoding: 7bit\r\n' +
                    'MIME-Version: 1.0\r\n' +
                    '\r\n' +
                    'Hello world!';

                expect(mb.build()).to.equal(expected);
            });

            it('should build child node', function() {
                var mb = new Mailbuild('multipart/mixed'),
                    childNode = mb.createChild('text/plain').
                setContent('Hello world!'),

                expected = 'Content-Type: text/plain\r\n' +
                    'Content-Transfer-Encoding: 7bit\r\n' +
                    '\r\n' +
                    'Hello world!';

                expect(childNode.build()).to.equal(expected);
            });

            it('should build multipart node', function() {
                var mb = new Mailbuild('multipart/mixed', {
                    baseBoundary: 'test'
                }).
                setHeader({
                    date: '12345',
                    'message-id': '67890'
                }),

                expected = 'Content-Type: multipart/mixed; boundary="----sinikael-?=_1-test"\r\n' +
                    'Date: 12345\r\n' +
                    'Message-Id: <67890>\r\n' +
                    'MIME-Version: 1.0\r\n' +
                    '\r\n' +
                    '------sinikael-?=_1-test\r\n' +
                    'Content-Type: text/plain\r\n' +
                    'Content-Transfer-Encoding: 7bit\r\n' +
                    '\r\n' +
                    'Hello world!\r\n' +
                    '------sinikael-?=_1-test--\r\n';

                mb.createChild('text/plain').setContent('Hello world!');

                expect(mb.build()).to.equal(expected);
            });

            it('should build root with generated headers', function() {
                var msg = new Mailbuild('text/plain').build();

                expect(/^Date:\s/m.test(msg)).to.be.true;
                expect(/^Message\-Id:\s</m.test(msg)).to.be.true;
                expect(/^MIME-Version: 1.0$/m.test(msg)).to.be.true;
            });

            it('should set content transfer encoding with string', function() {
                var msg = new Mailbuild('text/plain').
                setHeader({
                    'Content-Transfer-Encoding': 'quoted-printable'
                }).
                setContent('JÕGEVA').
                build(),

                expected = 'J=C3=95GEVA';

                msg = msg.split('\r\n\r\n');
                msg.shift();
                msg = msg.join('\r\n\r\n');

                expect(msg).to.equal(expected);
            });

            it('should not inclide bcc missing in output, but in envelope', function() {
                var mb = new Mailbuild('text/plain').
                setHeader({
                    from: 'sender@example.com',
                    to: 'receiver@example.com',
                    bcc: 'bcc@example.com'
                }),
                msg = mb.build(),
                envelope = mb.getEnvelope();

                expect(envelope).to.deep.equal({
                    from: 'sender@example.com',
                    to: ['receiver@example.com', 'bcc@example.com']
                });

                expect(/^From: sender@example.com$/m.test(msg)).to.be.true;
                expect(/^To: receiver@example.com$/m.test(msg)).to.be.true;
                expect(!/^Bcc:/m.test(msg)).to.be.true;
            });

            it('should have unicode subject', function() {
                var msg = new Mailbuild('text/plain').
                setHeader({
                    subject: 'jõgeval istus kägu metsas'
                }).build();

                expect(/^Subject: =\?UTF-8\?Q\?j=C3=B5geval\?= istus =\?UTF-8\?Q\?k=C3=A4gu\?= metsas$/m.test(msg)).to.be.true;
            });

            it('should have unicode subject with strange characters', function() {
                var msg = new Mailbuild('text/plain').
                setHeader({
                    subject: 'ˆ¸ÁÌÓıÏˇÁÛ^¸\\ÁıˆÌÁÛØ^\\˜Û˝™ˇıÓ¸^\\˜ﬁ^\\·\\˜Ø^£˜#ﬁ^\\£ﬁ^\\£ﬁ^\\'
                }).build();

                expect(msg.match(/\bSubject: [^\r]*\r\n( [^\r]*\r\n)*/)[0]).to.equal('Subject: =?UTF-8?Q?=CB=86=C2=B8=C3=81=C3=8C=C3=93=C4=B1?=\r\n =?UTF-8?Q?=C3=8F=CB=87=C3=81=C3=9B^=C2=B8\\=C3=81?=\r\n =?UTF-8?Q?=C4=B1=CB=86=C3=8C=C3=81=C3=9B=C3=98^\\?=\r\n =?UTF-8?Q?=CB=9C=C3=9B=CB=9D=E2=84=A2=CB=87=C4=B1?=\r\n =?UTF-8?Q?=C3=93=C2=B8^\\=CB=9C=EF=AC=81^\\=C2=B7\\?=\r\n =?UTF-8?Q?=CB=9C=C3=98^=C2=A3=CB=9C#=EF=AC=81^\\?=\r\n =?UTF-8?Q?=C2=A3=EF=AC=81^\\=C2=A3=EF=AC=81^\\?=\r\n');
            });

            it('should setContent (arraybuffer)', function() {
                var arr = new Uint8Array(256),
                    msg = new Mailbuild('text/plain').
                setHeader({
                    'Content-Transfer-Encoding': 'base64'
                }).
                setContent(arr),

                expected = 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8gISIjJCUmJygpKissLS4vMDEyMzQ1Njc4\r\n' +
                    'OTo7PD0+P0BBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWltcXV5fYGFiY2RlZmdoaWprbG1ub3Bx\r\n' +
                    'cnN0dXZ3eHl6e3x9fn+AgYKDhIWGh4iJiouMjY6PkJGSk5SVlpeYmZqbnJ2en6ChoqOkpaanqKmq\r\n' +
                    'q6ytrq+wsbKztLW2t7i5uru8vb6/wMHCw8TFxsfIycrLzM3Oz9DR0tPU1dbX2Nna29zd3t/g4eLj\r\n' +
                    '5OXm5+jp6uvs7e7v8PHy8/T19vf4+fr7/P3+/w==';

                for (var i = 0, len = arr.length; i < len; i++) {
                    arr[i] = i;
                }

                msg = msg.build().split('\r\n\r\n');
                msg.shift();
                msg = msg.join('\r\n\r\n');

                expect(msg).to.equal(expected);
            });

            it('should keep 7bit text as is', function() {
                var msg = new Mailbuild('text/plain').
                setContent('tere tere').
                build();

                expect(/\r\n\r\ntere tere$/.test(msg)).to.be.true;
                expect(/^Content-Type: text\/plain$/m.test(msg)).to.be.true;
                expect(/^Content-Transfer-Encoding: 7bit$/m.test(msg)).to.be.true;
            });

            it('should convert 7bit newlines', function() {
                var msg = new Mailbuild('text/plain').
                setContent('tere\ntere').
                build();

                expect(/\r\n\r\ntere\r\ntere$/.test(msg)).to.be.true;
            });

            it('should encode 7bit text', function() {
                var msg = new Mailbuild('text/plain').
                setContent('tere tere tere tere tere tere tere tere tere tere tere tere tere tere tere tere tere tere tere tere').
                build();

                expect(/^Content-Type: text\/plain; format=flowed$/m.test(msg)).to.be.true;
                expect(/^Content-Transfer-Encoding: 7bit$/m.test(msg)).to.be.true;

                msg = msg.split('\r\n\r\n');
                msg.shift();
                msg = msg.join('\r\n\r\n');

                expect(msg).to.equal('tere tere tere tere tere tere tere tere tere tere tere tere tere tere tere \r\ntere tere tere tere tere');
            });

            it('should stuff flowed space', function() {
                var msg = new Mailbuild('text/plain; format=flowed').
                setContent('tere\r\nFrom\r\n Hello\r\n> abc\nabc').
                build();

                expect(/^Content-Type: text\/plain; format=flowed$/m.test(msg)).to.be.true;
                expect(/^Content-Transfer-Encoding: 7bit$/m.test(msg)).to.be.true;

                msg = msg.split('\r\n\r\n');
                msg.shift();
                msg = msg.join('\r\n\r\n');

                expect(msg).to.equal('tere\r\n From\r\n  Hello\r\n > abc\r\nabc');
            });

            it('should use auto charset in unicode text', function() {
                var msg = new Mailbuild('text/plain').
                setContent('jõgeva').
                build();

                expect(/\r\n\r\nj=C3=B5geva$/.test(msg)).to.be.true;
                expect(/^Content-Type: text\/plain; charset=utf-8$/m.test(msg)).to.be.true;
                expect(/^Content-Transfer-Encoding: quoted-printable$/m.test(msg)).to.be.true;
            });

            it('should fetch ascii filename', function() {
                var msg = new Mailbuild('text/plain', {
                    filename: 'jogeva.txt'
                }).
                setContent('jogeva').
                build();

                expect(/\r\n\r\njogeva$/.test(msg)).to.be.true;
                expect(/^Content-Type: text\/plain$/m.test(msg)).to.be.true;
                expect(/^Content-Transfer-Encoding: 7bit$/m.test(msg)).to.be.true;
                expect(/^Content-Disposition: attachment; filename=jogeva.txt$/m.test(msg)).to.be.true;
            });

            it('should set unicode filename', function() {
                var msg = new Mailbuild('text/plain', {
                    filename: 'jõgeva.txt'
                }).
                setContent('jõgeva').
                build();

                expect(/\r\n\r\nj=C3=B5geva$/.test(msg)).to.be.true;
                expect(/^Content-Type: text\/plain; charset=utf-8$/m.test(msg)).to.be.true;
                expect(/^Content-Transfer-Encoding: quoted-printable$/m.test(msg)).to.be.true;
                expect(/^Content-Disposition: attachment; filename\*0\*=utf-8''j%C3%B5geva.txt$/m.test(msg)).to.be.true;
            });

            it('should detect content type from filename', function() {
                var msg = new Mailbuild(false, {
                    filename: 'jogeva.zip'
                }).
                setContent('jogeva').
                build();

                expect(/^Content-Type: application\/zip$/m.test(msg)).to.be.true;
            });

            it('should convert address objects', function() {
                var msg = new Mailbuild(false).
                setHeader({
                    from: [{
                        name: 'the safewithme testuser',
                        address: 'safewithme.testuser@jõgeva.com'
                    }],
                    cc: [{
                        name: 'the safewithme testuser',
                        address: 'safewithme.testuser@jõgeva.com'
                    }]
                });

                expect(/^From: the safewithme testuser <safewithme.testuser@xn\-\-jgeva-dua.com>$/m.test(msg.build())).to.be.true;
                expect(/^Cc: the safewithme testuser <safewithme.testuser@xn\-\-jgeva-dua.com>$/m.test(msg.build())).to.be.true;

                expect(msg.getEnvelope()).to.deep.equal({
                    from: 'safewithme.testuser@xn--jgeva-dua.com',
                    to: [
                        'safewithme.testuser@xn--jgeva-dua.com'
                    ]
                });
            });

            it('should skip empty header', function() {
                var mb = new Mailbuild('text/plain').
                setHeader({
                    a: 'b',
                    cc: '',
                    dd: [],
                    o: false,
                    date: 'zzz',
                    'message-id': '67890'
                }).
                setContent('Hello world!'),

                expected = 'Content-Type: text/plain\r\n' +
                    'A: b\r\n' +
                    'Date: zzz\r\n' +
                    'Message-Id: <67890>\r\n' +
                    'Content-Transfer-Encoding: 7bit\r\n' +
                    'MIME-Version: 1.0\r\n' +
                    '\r\n' +
                    'Hello world!';

                expect(mb.build()).to.equal(expected);
            });

            it('should set default transfer encoding for application content', function() {
                var mb = new Mailbuild('application/x-my-stuff').
                setHeader({
                    date: '12345',
                    'message-id': '67890'
                }).
                setContent('Hello world!'),

                expected = 'Content-Type: application/x-my-stuff\r\n' +
                    'Date: 12345\r\n' +
                    'Message-Id: <67890>\r\n' +
                    'Content-Transfer-Encoding: base64\r\n' +
                    'MIME-Version: 1.0\r\n' +
                    '\r\n' +
                    'SGVsbG8gd29ybGQh';

                expect(mb.build()).to.equal(expected);
            });

            it('should not set transfer encoding for multipart content', function() {
                var mb = new Mailbuild('multipart/global').
                setHeader({
                    date: '12345',
                    'message-id': '67890'
                }).
                setContent('Hello world!'),

                expected = 'Content-Type: multipart/global; boundary=abc\r\n' +
                    'Date: 12345\r\n' +
                    'Message-Id: <67890>\r\n' +
                    'MIME-Version: 1.0\r\n' +
                    '\r\n' +
                    'Hello world!\r\n' +
                    '\r\n' +
                    '--abc--' +
                    '\r\n';

                mb.boundary = 'abc';

                expect(mb.build()).to.equal(expected);
            });

            it('should use from domain for message-id', function() {
                var mb = new Mailbuild('text/plain').
                setHeader({
                    from: 'test@example.com'
                });

                expect(/^Message-Id: <\d+(\-[a-f0-9]{8}){3}@example\.com>$/m.test(mb.build())).to.be.true;
            });

            it('should fallback to localhost for message-id', function() {
                var mb = new Mailbuild('text/plain');

                expect(/^Message-Id: <\d+(\-[a-f0-9]{8}){3}@localhost>$/m.test(mb.build())).to.be.true;
            });
        });

        describe('#getEnvelope', function() {
            it('should get envelope', function() {
                expect(new Mailbuild().addHeader({
                    from: 'From <from@example.com>',
                    sender: 'Sender <sender@example.com>',
                    to: 'receiver1@example.com'
                }).addHeader({
                    to: 'receiver2@example.com',
                    cc: 'receiver1@example.com, receiver3@example.com',
                    bcc: 'receiver4@example.com, Rec5 <receiver5@example.com>'
                }).getEnvelope()).to.deep.equal({
                    from: 'from@example.com',
                    to: ['receiver1@example.com', 'receiver2@example.com', 'receiver3@example.com', 'receiver4@example.com', 'receiver5@example.com']
                });

                expect(new Mailbuild().addHeader({
                    sender: 'Sender <sender@example.com>',
                    to: 'receiver1@example.com'
                }).addHeader({
                    to: 'receiver2@example.com',
                    cc: 'receiver1@example.com, receiver3@example.com',
                    bcc: 'receiver4@example.com, Rec5 <receiver5@example.com>'
                }).getEnvelope()).to.deep.equal({
                    from: 'sender@example.com',
                    to: ['receiver1@example.com', 'receiver2@example.com', 'receiver3@example.com', 'receiver4@example.com', 'receiver5@example.com']
                });
            });
        });

        describe('#_parseAddresses', function() {
            it('should normalize header key', function() {
                var mb = new Mailbuild();

                expect(mb._parseAddresses('test address@example.com')).to.deep.equal([{
                    address: 'address@example.com',
                    name: 'test'
                }]);

                expect(mb._parseAddresses(['test address@example.com'])).to.deep.equal([{
                    address: 'address@example.com',
                    name: 'test'
                }]);

                expect(mb._parseAddresses([
                    ['test address@example.com']
                ])).to.deep.equal([{
                    address: 'address@example.com',
                    name: 'test'
                }]);

                expect(mb._parseAddresses([{
                    address: 'address@example.com',
                    name: 'test'
                }])).to.deep.equal([{
                    address: 'address@example.com',
                    name: 'test'
                }]);
            });
        });

        describe('#_normalizeHeaderKey', function() {
            it('should normalize header key', function() {
                var mb = new Mailbuild();

                expect(mb._normalizeHeaderKey('key')).to.equal('Key');
                expect(mb._normalizeHeaderKey('mime-vERSION')).to.equal('MIME-Version');
                expect(mb._normalizeHeaderKey('-a-long-name')).to.equal('-A-Long-Name');
            });
        });

        describe('#_buildHeaderValue', function() {
            it('should build header value', function() {
                var mb = new Mailbuild();

                expect(mb._buildHeaderValue({
                    value: 'test'
                })).to.equal('test');
                expect(mb._buildHeaderValue({
                    value: 'test',
                    params: {
                        a: 'b'
                    }
                })).to.equal('test; a=b');
                expect(mb._buildHeaderValue({
                    value: 'test',
                    params: {
                        a: ';'
                    }
                })).to.equal('test; a=";"');
                expect(mb._buildHeaderValue({
                    value: 'test',
                    params: {
                        a: ';"'
                    }
                })).to.equal('test; a=";\\""');
                expect(mb._buildHeaderValue({
                    value: 'test',
                    params: {
                        a: 'b',
                        c: 'd'
                    }
                })).to.equal('test; a=b; c=d');
            });
        });

        describe('#_escapeHeaderArgument', function() {
            it('should return original value if possible', function() {
                var mb = new Mailbuild();
                expect(mb._escapeHeaderArgument('abc')).to.equal('abc');
            });

            it('should use quotes', function() {
                var mb = new Mailbuild();
                expect(mb._escapeHeaderArgument('abc "tere"')).to.equal('"abc \\"tere\\""');
            });
        });

        describe('#_handleContentType', function() {
            it('should do nothing on non multipart', function() {
                var mb = new Mailbuild();
                expect(mb.boundary).to.not.exist;
                mb._handleContentType({
                    value: 'text/plain'
                });
                expect(mb.boundary).to.be.false;
                expect(mb.multipart).to.be.false;
            });

            it('should use provided boundary', function() {
                var mb = new Mailbuild();
                expect(mb.boundary).to.not.exist;
                mb._handleContentType({
                    value: 'multipart/mixed',
                    params: {
                        boundary: 'abc'
                    }
                });
                expect(mb.boundary).to.equal('abc');
                expect(mb.multipart).to.equal('mixed');
            });

            it('should generate boundary', function() {
                var mb = new Mailbuild();
                sinon.stub(mb, '_generateBoundary').returns('def');

                expect(mb.boundary).to.not.exist;
                mb._handleContentType({
                    value: 'multipart/mixed',
                    params: {}
                });
                expect(mb.boundary).to.equal('def');
                expect(mb.multipart).to.equal('mixed');

                mb._generateBoundary.restore();
            });
        });

        describe('#_generateBoundary ', function() {
            it('should genereate boundary string', function() {
                var mb = new Mailbuild();
                mb._nodeId = 'abc';
                mb.rootNode.baseBoundary = 'def';
                expect(mb._generateBoundary()).to.equal('----sinikael-?=_abc-def');
            });
        });

        describe('#_encodeHeaderValue', function() {
            it('should do noting if possible', function() {
                var mb = new Mailbuild();
                expect(mb._encodeHeaderValue('x-my', 'test value')).to.equal('test value');
            });

            it('should encode non ascii characters', function() {
                var mb = new Mailbuild();
                expect(mb._encodeHeaderValue('x-my', 'test jõgeva value')).to.equal('test =?UTF-8?Q?j=C3=B5geva?= value');
            });

            it('should format references', function() {
                var mb = new Mailbuild();
                expect(mb._encodeHeaderValue('references', 'abc def')).to.equal('<abc> <def>');
                expect(mb._encodeHeaderValue('references', ['abc', 'def'])).to.equal('<abc> <def>');
            });

            it('should format message-id', function() {
                var mb = new Mailbuild();
                expect(mb._encodeHeaderValue('message-id', 'abc')).to.equal('<abc>');
            });

            it('should format addresses', function() {
                var mb = new Mailbuild();
                expect(mb._encodeHeaderValue('from', {
                    name: 'the safewithme testuser',
                    address: 'safewithme.testuser@jõgeva.com'
                })).to.equal('the safewithme testuser <safewithme.testuser@xn--jgeva-dua.com>');
            });
        });

        describe('#_convertAddresses', function() {
            it('should convert address object to a string', function() {
                var mb = new Mailbuild();
                expect(mb._convertAddresses([{
                    name: 'Jõgeva Ants',
                    address: 'ants@jõgeva.ee'
                }, {
                    name: 'Composers',
                    group: [{
                        address: 'sebu@example.com',
                        name: 'Bach, Sebastian'
                    }, {
                        address: 'mozart@example.com',
                        name: 'Mozzie'
                    }]
                }])).to.equal('=?UTF-8?Q?J=C3=B5geva_Ants?= <ants@xn--jgeva-dua.ee>, Composers:"Bach, Sebastian" <sebu@example.com>, Mozzie <mozart@example.com>;');
            });

            it('should keep ascii name as is', function() {
                var mb = new Mailbuild();
                expect(mb._convertAddresses([{
                    name: 'O\'Vigala Sass',
                    address: 'a@b.c'
                }])).to.equal('O\'Vigala Sass <a@b.c>');
            });

            it('should include name in quotes for special symbols', function() {
                var mb = new Mailbuild();
                expect(mb._convertAddresses([{
                    name: 'Sass, Vigala',
                    address: 'a@b.c'
                }])).to.equal('"Sass, Vigala" <a@b.c>');
            });

            it('should escape quotes', function() {
                var mb = new Mailbuild();
                expect(mb._convertAddresses([{
                    name: '"Vigala Sass"',
                    address: 'a@b.c'
                }])).to.equal('"\\"Vigala Sass\\"" <a@b.c>');
            });

            it('should mime encode unicode names', function() {
                var mb = new Mailbuild();
                expect(mb._convertAddresses([{
                    name: '"Jõgeva Sass"',
                    address: 'a@b.c'
                }])).to.equal('=?UTF-8?Q?=22J=C3=B5geva_Sass=22?= <a@b.c>');
            });
        });

        describe('#_isPlainText', function() {
            it('should return true', function() {
                var mb = new Mailbuild();
                expect(mb._isPlainText('az09\t\r\n~!?')).to.be.true;
            });

            it('should return false on low bits', function() {
                var mb = new Mailbuild();
                expect(mb._isPlainText('az09\n\x08!?')).to.be.false;
            });

            it('should return false on high bits', function() {
                var mb = new Mailbuild();
                expect(mb._isPlainText('az09\nõ!?')).to.be.false;
            });
        });
    });
}));