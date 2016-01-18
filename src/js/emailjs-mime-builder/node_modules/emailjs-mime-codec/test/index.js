'use strict';

require.config({
    baseUrl: '../',
    paths: {
        'test': '../test',
        'chai': '../node_modules/chai/chai',
        'emailjs-stringencoding': '../node_modules/emailjs-stringencoding/src/emailjs-stringencoding'
    }
});


mocha.setup('bdd');
require(['test/mimecodec-unit'], function() {
    (window.mochaPhantomJS || window.mocha).run();
});
