
import { BrowserHandle } from '../browser';
import { test_with_new_browser, test_with_semaphored_global_browser } from '../test';
import * as ava from 'ava';

export type TestWithBrowser = typeof test_with_new_browser;
export type TestWithGlobalBrowser = typeof test_with_semaphored_global_browser;
