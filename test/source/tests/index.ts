
import { BrowserHandle } from '../browser';
import { testWithNewBrowser, testWithSemaphoredGlobalBrowser } from '../test';
import * as ava from 'ava';

export type TestWithBrowser = typeof testWithNewBrowser;
export type TestWithGlobalBrowser = typeof testWithSemaphoredGlobalBrowser;
