(function(root, factory) {
    'use strict';

    if (typeof define === 'function' && define.amd) {
        define(['chai', 'mimetypes'], factory);
    } else if (typeof exports === 'object') {
        factory(require('chai'), require('../src/mimetypes'));
    }
}(this, function(chai, mimetypes) {
    'use strict';

    var expect = chai.expect;
    chai.Assertion.includeStack = true;

    describe('mimetypes', function() {
        describe('#detectMimeType', function() {
            it('should find exact match', function() {
                var extension = 'doc',
                    contentType = 'application/msword';

                expect(mimetypes.detectExtension(contentType)).to.equal(extension);
            });

            it('should find best match', function() {
                var extension = 'jpeg',
                    contentType = 'image/jpeg';

                expect(mimetypes.detectExtension(contentType)).to.equal(extension);
            });
        });

        describe('#detectExtension', function() {
            it('should find exact match', function() {
                var extension = 'doc',
                    contentType = 'application/msword';

                expect(mimetypes.detectMimeType(extension)).to.equal(contentType);
            });

            it('should find best match', function() {
                var extension = 'js',
                    contentType = 'application/javascript';

                expect(mimetypes.detectMimeType(extension)).to.equal(contentType);
            });
        });
    });
}));