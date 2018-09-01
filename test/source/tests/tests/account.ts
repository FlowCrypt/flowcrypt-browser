
import {TestWithBrowser, TestWithGlobalBrowser} from '..';
import {PageRecipe} from '../page_recipe';
import {Url, Semaphore} from '../../browser';
import {FlowCryptApi} from '../api';
import * as ava from 'ava';
import { Util, Config } from '../../util';
import {expect} from 'chai';

export let define_account_tests = (test_with_new_browser: TestWithBrowser, test_with_semaphored_global_browser: TestWithGlobalBrowser) => {

  ava.test('testing trial global browser', test_with_semaphored_global_browser('trial', async (browser, t) => {
    'testing';
  }));

  ava.test.todo('compose > large file > subscribe > trial');

  ava.test.todo('compose > footer > subscribe > trial');

  ava.test.todo('settings > subscribe > trial');

  ava.test.todo('settings will recognize expired subscription');

  ava.test.todo('settings will recognize / sync subscription');

  ava.test.todo('settings > subscribe > expire > compose > large file > subscribe');

  ava.test.todo('settings > subscribe > expire > compose > footer > subscribe');

};
