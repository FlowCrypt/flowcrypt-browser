'use strict';

require.config({
    baseUrl: '../',
    paths: {
        'test': '../test',
        'chai': '../node_modules/chai/chai',
        'stringencoding': '../node_modules/wo-stringencoding/dist/stringencoding'
    }
});


mocha.setup('bdd');
require(['test/mimefuncs-unit'], function() {
    (window.mochaPhantomJS || window.mocha).run();
});