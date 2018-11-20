import { TestWithBrowser, TestWithGlobalBrowser } from '..';
import { Config } from '../../util';
import { expect } from 'chai';
const ordered_stringify = require('json-stable-stringify'); // tslint:disable-line
import * as ava from 'ava';

// tslint:disable:no-unused-expression

export let defineUnitTests = (testWithBrowser: TestWithBrowser, testWithSemaphoredGlobalBrowser: TestWithGlobalBrowser) => {

  for (const ut of Config.tests.unit_tests) {
    ava.test(`unit ${ut.name}`, testWithBrowser(async browser => {
      const page = await browser.newPage(`chrome/dev/unit_test.htm?f=${ut.f}&args=${encodeURIComponent(JSON.stringify(ut.args))}`);
      await page.waitForSelTestStaet('ready');
      const content = await page.read('@unit-test-result');
      const r = JSON.parse(content);
      expect(r).to.have.property('error').that.is.null;
      expect(ordered_stringify(r.result)).to.equal(ordered_stringify(ut.result));
    }));
  }

};
