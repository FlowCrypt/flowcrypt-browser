/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

/// <reference path="../../../../node_modules/@types/chrome/index.d.ts" />

'use strict';

export type WebMailName = 'gmail' | 'outlook' | 'settings';
export type WebMailVersion = 'generic' | 'gmail2020' | 'gmail2022';

export class Env {

  public static runtimeId = (orig = false) => {
    if (chrome?.runtime?.id) {
      if (orig === true) {
        return chrome.runtime.id;
      } else {
        return chrome.runtime.id.replace(/[^a-z0-9]/gi, '');
      }
    }
    return undefined;
  };

  public static isContentScript = () => {
    return Env.isExtension() && window.location.href.indexOf(chrome.runtime.getURL('')) === -1; // extension but not on its own url
  };

  public static isBackgroundPage = () => {
    return Boolean(window.location && window.location.href.includes('background_page.htm'));
  };

  public static isExtension = () => {
    return typeof Env.runtimeId() !== 'undefined';
  };

  public static keyCodes = () => { // todo - use e.key (string) instead? Keycodes not reliable. https://bugs.chromium.org/p/chromium/issues/detail?id=79407
    return { a: 97, r: 114, A: 65, R: 82, f: 102, F: 70, backspace: 8, tab: 9, enter: 13, comma: 188, };
  };

  public static webmails = async (): Promise<WebMailName[]> => {
    return ['gmail']; // async because storage may be involved in the future
  };

  public static getBaseUrl = () => {
    return window.location.protocol + '//' + window.location.hostname;
  };

  public static getUrlNoParams = () => {
    return window.location.protocol + '//' + window.location.hostname + window.location.pathname;
  };

}
