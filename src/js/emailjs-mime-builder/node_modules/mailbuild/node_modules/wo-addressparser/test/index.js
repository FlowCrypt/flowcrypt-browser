'use strict';

require.config({
    baseUrl: '../src',
    paths: {
        'test': '../test',
        'chai': '../node_modules/chai/chai'
    }
});


mocha.setup('bdd');
require(['test/addressparser-unit'], function() {
    (window.mochaPhantomJS || window.mocha).run();
});