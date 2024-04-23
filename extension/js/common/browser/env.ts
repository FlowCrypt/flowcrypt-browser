/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../../../../node_modules/@types/chrome/index.d.ts" />

'use strict';

import { Url } from '../core/common.js';

export type WebMailName = 'gmail' | 'outlook' | 'settings';
export type WebMailVersion = 'generic' | 'gmail2020' | 'gmail2022';

declare const self: ServiceWorkerGlobalScope;

export class Env {
  public static runtimeId(orig = false) {
    if (chrome?.runtime?.id) {
      if (orig === true) {
        return chrome.runtime.id;
      } else {
        return chrome.runtime.id.replace(/[^a-z0-9]/gi, '');
      }
    }
    return undefined;
  }

  public static getExtensionOrigin() {
    const url = chrome.runtime.getURL('');
    return Url.removeTrailingSlash(url);
  }

  public static isContentScript() {
    if (Env.isExtension()) {
      try {
        // Attempt to get the URL of an extension resource. This will succeed if we're in an extension context.
        const extensionUrl = chrome.runtime.getURL('');
        // Check if the current page URL is different from the extension's base URL (i.e., it's not an extension page)
        return window.location.href.indexOf(extensionUrl) !== 0;
      } catch (e) {
        // In case of any errors (which shouldn't happen in a proper extension context), assume it's not a content script
        return false;
      }
    }
    // chrome.runtime is not available, so it's not running within an extension
    return false;
  }

  // Check if the current context is a Service Worker
  public static isBackgroundPage() {
    return typeof self.registration !== 'undefined';
  }

  public static isExtension() {
    return typeof Env.runtimeId() !== 'undefined';
  }

  public static keyCodes() {
    // todo - use e.key (string) instead? Keycodes not reliable. https://bugs.chromium.org/p/chromium/issues/detail?id=79407
    // eslint-disable-next-line @typescript-eslint/naming-convention
    return { a: 97, r: 114, A: 65, R: 82, f: 102, F: 70, backspace: 8, tab: 9, enter: 13, comma: 188 };
  }

  public static async webmails(): Promise<WebMailName[]> {
    return ['gmail']; // async because storage may be involved in the future
  }

  public static getBaseUrl() {
    return window.location.protocol + '//' + window.location.hostname;
  }

  public static getUrlNoParams() {
    return window.location.protocol + '//' + window.location.hostname + window.location.pathname;
  }
}
