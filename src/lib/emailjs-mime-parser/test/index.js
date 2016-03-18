'use strict';

require.config({
    baseUrl: '../',
    paths: {
        'test': './test',
        'chai': './node_modules/chai/chai',
        'emailjs-mime-codec': './node_modules/emailjs-mime-codec/src/emailjs-mime-codec',
        'emailjs-addressparser': './node_modules/emailjs-addressparser/src/emailjs-addressparser',
        'emailjs-stringencoding': './node_modules/emailjs-stringencoding/src/emailjs-stringencoding',
        'sinon': './node_modules/sinon/pkg/sinon'
    },
    shim: {
        sinon: {
            exports: 'sinon',
        }
    }
});


mocha.setup('bdd');
require(['test/mimeparser-unit'], function() {
    (window.mochaPhantomJS || window.mocha).run();
});
