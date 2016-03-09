'use strict';

require.config({
    baseUrl: '../',
    paths: {
        'test': './test',
        'chai': './node_modules/chai/chai',
        'emailjs-addressparser': './node_modules/emailjs-addressparser/src/emailjs-addressparser',
        'emailjs-mime-types': './node_modules/emailjs-mime-types/src/emailjs-mime-types',
        'emailjs-mime-codec': './node_modules/emailjs-mime-codec/src/emailjs-mime-codec',
        'punycode': './node_modules/punycode/punycode',
        'emailjs-stringencoding': './node_modules/emailjs-stringencoding/src/emailjs-stringencoding',
        'sinon': './node_modules/sinon/pkg/sinon',
    },
    shim: {
        sinon: {
            exports: 'sinon',
        }
    }
});


mocha.setup('bdd');
require(['test/emailjs-mime-builder-unit'], function() {
    (window.mochaPhantomJS || window.mocha).run();
});
