import { TestWithNewBrowser, TestWithGlobalBrowser } from '../../test';
import { Config } from '../../util';
import { expect } from 'chai';
const ordered_stringify = require('json-stable-stringify'); // tslint:disable-line
import * as ava from 'ava';
import { TestVariant } from '../../util';

// tslint:disable:no-blank-lines-func

export let defineUnitTests = (testVariant: TestVariant, TestWithNewBrowser: TestWithNewBrowser, testWithSemaphoredGlobalBrowser: TestWithGlobalBrowser) => {

  if (testVariant !== 'CONSUMER-LIVE-GMAIL') {

    for (const ut of Config.tests.unit_tests) {
      ava.test(`[standalone] unit ${ut.name}`, TestWithNewBrowser(async (t, browser) => {
        const page = await browser.newPage(t, `chrome/dev/unit_test.htm?f=${ut.f}&args=${encodeURIComponent(JSON.stringify(ut.args))}`);
        await page.waitForSelTestState('ready');
        const content = await page.read('@unit-test-result');
        const r = JSON.parse(content);
        expect(r).to.not.have.property('error');
        expect(ordered_stringify(r.result)).to.equal(ordered_stringify(ut.result)); // tslint:disable-line:no-unsafe-any
      }));
    }

  }
};
