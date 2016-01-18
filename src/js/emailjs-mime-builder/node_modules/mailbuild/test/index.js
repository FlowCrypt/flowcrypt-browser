'use strict';

require.config({
    baseUrl: '../',
    paths: {
        'test': './test',
        'chai': './node_modules/chai/chai',
        'addressparser': './node_modules/wo-addressparser/src/addressparser',
        'mimetypes': './node_modules/mimetypes/src/mimetypes',
        'mimefuncs': './node_modules/mimefuncs/src/mimefuncs',
        'punycode': './node_modules/punycode/punycode.min',
        'stringencoding': './node_modules/mimefuncs/node_modules/wo-stringencoding/dist/stringencoding',
        'sinon': './node_modules/sinon/pkg/sinon',
    },
    shim: {
        sinon: {
            exports: 'sinon',
        }
    }
});


mocha.setup('bdd');
require(['test/mailbuild-unit'], function() {
    (window.mochaPhantomJS || window.mocha).run();
});