import {TestWithBrowser} from '..';
import {Config} from '../../util';
import {expect} from 'chai';
const ordered_stringify = require('json-stable-stringify'); // tslint:disable-line
import * as ava from 'ava';

// tslint:disable:no-unused-expression

export let define_unit_tests = (test_with_browser: TestWithBrowser, test_with_semaphored_global_browser: TestWithBrowser) => {

  for(let ut of Config.config.unit_tests) {
    ava.test(`unit ${ut.name}`, test_with_browser(async browser => {
      let page = await browser.new_page(`chrome/dev/unit_test.htm?f=${ut.f}&args=${encodeURIComponent(JSON.stringify(ut.args))}`);
      await page.wait_for_selector_test_state('ready');
      let content = await page.read('@unit-test-result');
      let r = JSON.parse(content);
      expect(r).to.have.property('error').that.is.null;
      expect(ordered_stringify(r.result)).to.equal(ordered_stringify(ut.result));
    }));
  }

};
