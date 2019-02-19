import { TestWithBrowser, TestWithGlobalBrowser } from '..';
import { Config } from '../../util';
import { expect } from 'chai';
const ordered_stringify = require('json-stable-stringify'); // tslint:disable-line
import * as ava from 'ava';
import { TestVariant } from '../../test';

// tslint:disable:no-blank-lines-func

export let defineUnitTests = (testVariant: TestVariant, testWithBrowser: TestWithBrowser, testWithSemaphoredGlobalBrowser: TestWithGlobalBrowser) => {

  for (const ut of Config.tests.unit_tests) {
    ava.test(`unit ${ut.name}`, testWithBrowser(async (t, browser) => {
      const page = await browser.newPage(t, `chrome/dev/unit_test.htm?f=${ut.f}&args=${encodeURIComponent(JSON.stringify(ut.args))}`);
      await page.waitForSelTestState('ready');
      const content = await page.read('@unit-test-result');
      const r = JSON.parse(content);
      expect(r).to.not.have.property('error');
      expect(ordered_stringify(r.result)).to.equal(ordered_stringify(ut.result));
    }));
  }

};
