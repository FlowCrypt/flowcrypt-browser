(function(root, factory) {
    "use strict";

    if (typeof define === "function" && define.amd) {
        define(['chai', 'addressparser'], factory);
    } else if (typeof exports === 'object') {
        factory(require('chai'), require('../src/addressparser'));
    }
}(this, function(chai, addressparser) {
    'use strict';

    var expect = chai.expect;
    chai.Assertion.includeStack = true;

    describe('addressparser', function() {
        describe('#parse', function() {
            it("should handle single address correctly", function() {
                var input = "andris@tr.ee",
                    expected = [{
                        address: "andris@tr.ee",
                        name: ""
                    }];
                expect(addressparser.parse(input)).to.deep.equal(expected);
            });

            it("should handle multiple addresses correctly", function() {
                var input = "andris@tr.ee, andris@example.com",
                    expected = [{
                        address: "andris@tr.ee",
                        name: ""
                    }, {
                        address: "andris@example.com",
                        name: ""
                    }];
                expect(addressparser.parse(input)).to.deep.equal(expected);
            });

            it("should handle unquoted name correctly", function() {
                var input = "andris <andris@tr.ee>",
                    expected = [{
                        name: "andris",
                        address: "andris@tr.ee"
                    }];
                expect(addressparser.parse(input)).to.deep.equal(expected);
            });

            it("should handle quoted name correctly", function() {
                var input = "\"reinman, andris\" <andris@tr.ee>",
                    expected = [{
                        name: "reinman, andris",
                        address: "andris@tr.ee"
                    }];
                expect(addressparser.parse(input)).to.deep.equal(expected);
            });

            it("should handle unquoted name, unquoted address correctly", function() {
                var input = "andris andris@tr.ee",
                    expected = [{
                        name: "andris",
                        address: "andris@tr.ee"
                    }];
                expect(addressparser.parse(input)).to.deep.equal(expected);
            });

            it("should handle emtpy group correctly", function() {
                var input = "Undisclosed:;",
                    expected = [{
                        "name": "Undisclosed",
                        "group": []
                    }];
                expect(addressparser.parse(input)).to.deep.equal(expected);
            });

            it("should handle address group correctly", function() {
                var input = "Disclosed:andris@tr.ee, andris@example.com;",
                    expected = [{
                        "name": "Disclosed",
                        "group": [{
                            "address": "andris@tr.ee",
                            "name": ""
                        }, {
                            "address": "andris@example.com",
                            "name": ""
                        }]
                    }];
                expect(addressparser.parse(input)).to.deep.equal(expected);
            });

            it("should handle mixed group correctly", function() {
                var input = "Test User <test.user@mail.ee>, Disclosed:andris@tr.ee, andris@example.com;,,,, Undisclosed:;",
                    expected = [{
                        "address": "test.user@mail.ee",
                        "name": "Test User"
                    }, {
                        "name": "Disclosed",
                        "group": [{
                            "address": "andris@tr.ee",
                            "name": ""
                        }, {
                            "address": "andris@example.com",
                            "name": ""
                        }]
                    }, {
                        "name": "Undisclosed",
                        "group": []
                    }];
                expect(addressparser.parse(input)).to.deep.equal(expected);
            });

            it("should handle name from comment correctly", function() {
                var input = "andris@tr.ee (andris)",
                    expected = [{
                        name: "andris",
                        address: "andris@tr.ee"
                    }];
                expect(addressparser.parse(input)).to.deep.equal(expected);
            });

            it("should handle skip comment correctly", function() {
                var input = "andris@tr.ee (reinman) andris",
                    expected = [{
                        name: "andris",
                        address: "andris@tr.ee"
                    }];
                expect(addressparser.parse(input)).to.deep.equal(expected);
            });

            it("should handle missing address correctly", function() {
                var input = "andris",
                    expected = [{
                        name: "andris",
                        address: ""
                    }];
                expect(addressparser.parse(input)).to.deep.equal(expected);
            });

            it("should handle apostrophe in name correctly", function() {
                var input = "O'Neill",
                    expected = [{
                        name: "O'Neill",
                        address: ""
                    }];
                expect(addressparser.parse(input)).to.deep.equal(expected);
            });

            it("should handle particularily bad input, unescaped colon correctly", function() {
                var input = "FirstName Surname-WithADash :: Company <firstname@company.com>",
                    expected = [{
                        name: 'FirstName Surname-WithADash',
                        group: [{
                            name: undefined,
                            group: [{
                                address: 'firstname@company.com',
                                name: 'Company'
                            }]
                        }]
                    }];
                expect(addressparser.parse(input)).to.deep.equal(expected);
            });
        });
    });
}));