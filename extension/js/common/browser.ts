/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

/// <reference path="../../../node_modules/@types/chrome/index.d.ts" />

'use strict';

import { Catch } from './platform/catch.js';
import { Dict } from './core/common.js';
import { Api } from './api/api.js';
import { Att } from './core/att.js';
import Swal from 'sweetalert2';
import { Xss } from './platform/xss.js';

type PreventableEventName = 'double' | 'parallel' | 'spree' | 'slowspree' | 'veryslowspree';
type NamedSels = Dict<JQuery<HTMLElement>>;

export type WebMailName = 'gmail' | 'outlook' | 'settings';
export type BrowserEventErrHandler = { auth?: () => Promise<void>, authPopup?: () => Promise<void>, network?: () => Promise<void>, other?: (e: any) => Promise<void> };
export type SelCache = { cached: (name: string) => JQuery<HTMLElement>; now: (name: string) => JQuery<HTMLElement>; sel: (name: string) => string; };

export interface JQS extends JQueryStatic { featherlight: (contentOrSettings: string | Object) => void; } // tslint:disable-line:ban-types

export class Browser {

  public static objUrlCreate = (content: Uint8Array | string) => {
    return window.URL.createObjectURL(new Blob([content], { type: 'application/octet-stream' }));
  }

  public static objUrlConsume = async (url: string) => {
    const buf = await Api.download(url);
    window.URL.revokeObjectURL(url);
    return buf;
  }

  public static saveToDownloads = (att: Att, renderIn?: JQuery<HTMLElement>) => {
    const blob = new Blob([att.getData()], { type: att.type });
    if (window.navigator && window.navigator.msSaveOrOpenBlob) {
      window.navigator.msSaveBlob(blob, att.name);
    } else {
      const a = window.document.createElement('a');
      a.href = window.URL.createObjectURL(blob);
      a.download = Xss.escape(att.name);
      if (renderIn) {
        a.innerHTML = '<div>Right-click here and choose \'Save Link As\' to save encrypted file</div>'; // xss-direct
        a.className = 'file-download-right-click-link';
        renderIn.html(a.outerHTML); // xss-escaped attachment name above
        renderIn.css('height', 'auto');
        renderIn.find('a').click(e => {
          Ui.modal.warning('Please use right-click and select Save Link As').catch(Catch.reportErr);
          e.preventDefault();
          e.stopPropagation();
          return false;
        });
      } else {
        if (typeof a.click === 'function') {
          a.click();
        } else { // safari
          const ev = document.createEvent('MouseEvents');
          // @ts-ignore - safari only. expected 15 arguments, but works well with 4
          ev.initMouseEvent('click', true, true, window);
          a.dispatchEvent(ev);
        }
        if (Catch.browser().name === 'firefox') {
          try {
            document.body.removeChild(a);
          } catch (err) {
            if (!(err instanceof Error && err.message === 'Node was not found')) {
              throw err;
            }
          }
        }
        Catch.setHandledTimeout(() => window.URL.revokeObjectURL(a.href), 0);
      }
    }
  }

  public static arrFromDomNodeList = (obj: NodeList | JQuery<HTMLElement>): Node[] => {
    // http://stackoverflow.com/questions/2735067/how-to-convert-a-dom-node-list-to-an-array-in-javascript
    const array = [];
    for (let i = obj.length >>> 0; i--;) { // iterate backwards ensuring that length is an UInt32
      array[i] = obj[i];
    }
    return array;
  }

}

export class Env {

  public static runtimeId = (orig = false) => {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
      if (orig === true) {
        return chrome.runtime.id;
      } else {
        return chrome.runtime.id.replace(/[^a-z0-9]/gi, '');
      }
    }
    return undefined;
  }

  public static isContentScript = () => Env.isExtension() && window.location.href.indexOf(chrome.runtime.getURL('')) === -1; // extension but not on its own url

  public static isBackgroundPage = () => Boolean(window.location && window.location.href.includes('background_page.htm'));

  public static isExtension = () => typeof Env.runtimeId() !== 'undefined';

  public static keyCodes = () => { // todo - use e.key (string) instead? Keycodes not reliable. https://bugs.chromium.org/p/chromium/issues/detail?id=79407
    return { a: 97, r: 114, A: 65, R: 82, f: 102, F: 70, backspace: 8, tab: 9, enter: 13, comma: 188, };
  }

  public static webmails = async (): Promise<WebMailName[]> => {
    return ['gmail']; // async because storage may be involved in the future
  }

  public static getBaseUrl = () => {
    return window.location.protocol + '//' + window.location.hostname;
  }

  public static getUrlNoParams = () => {
    return window.location.protocol + '//' + window.location.hostname + window.location.pathname;
  }

}

export class Ui {

  public static EVENT_DOUBLE_MS = 1000;
  public static EVENT_SPREE_MS = 50;
  public static EVENT_SLOW_SPREE_MS = 200;
  public static EVENT_VERY_SLOW_SPREE_MS = 500;

  public static retryLink = (caption: string = 'retry') => `<a href="${Xss.escape(window.location.href)}">${Xss.escape(caption)}</a>`;

  public static delay = (ms: number) => new Promise(resolve => Catch.setHandledTimeout(resolve, ms));

  public static spinner = (color: string, placeholderCls: "small_spinner" | "large_spinner" = 'small_spinner') => {
    const path = `/img/svgs/spinner-${color}-small.svg`;
    const url = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL ? chrome.runtime.getURL(path) : path;
    return `<i class="${placeholderCls}" data-test="spinner"><img src="${url}" /></i>`;
  }

  public static renderOverlayPromptAwaitUserChoice = (btns: Dict<{ title?: string, color?: string }>, prompt: string, details?: string): Promise<string> => {
    return new Promise(resolve => {
      const getEscapedColor = (id: string) => Xss.escape(btns[id].color || 'green');
      const getEscapedTitle = (id: string) => Xss.escape(btns[id].title || id.replace(/_/g, ' '));
      const formatBtn = (id: string) => {
        return `<div class="button ${getEscapedColor(id)} overlay_action_${Xss.escape(id)}" data-test="action-overlay-${Xss.escape(id)}">${getEscapedTitle(id)}</div>`;
      };
      const formattedBtns = Object.keys(btns).map(formatBtn).join('&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;');
      if (details) {
        const a = `<a href="#" class="action-show-overlay-details" data-test="action-show-overlay-details" style="display:block;text-align:center;">Show technical details</a>`;
        details = `${a}<pre class="display_none" data-test="container-overlay-details">${details.replace(/\n/g, '<br>')}</pre>`;
      }
      Xss.sanitizeAppend('body', `
        <div class="featherlight white prompt_overlay" style="display: block;">
          <div class="featherlight-content" data-test="dialog">
            <div class="line" data-test="container-overlay-prompt-text">${prompt.replace(/\n/g, '<br>')}</div>
            <div class="line">${formattedBtns}</div>
            <div class="line">&nbsp;</div>
            <div style="font-size:12px;">${details || ''}</div>
            <div class="line">&nbsp;</div>
            <div class="line">Email human@flowcrypt.com if you need assistance.</div>
          </div>
        </div>
      `);
      const overlay = $('.prompt_overlay');
      overlay.find('.action-show-overlay-details').one('click', Ui.event.handle(target => {
        $(target).hide().siblings('pre').show();
      }));
      for (const id of Object.keys(btns)) {
        overlay.find(`.overlay_action_${id}`).one('click', Ui.event.handle(() => {
          overlay.remove();
          resolve(id);
        }));
      }
    });
  }

  public static escape = (callback: () => void) => (e: JQuery.Event<HTMLElement, null>) => { // returns a function
    if (!e.metaKey && !e.ctrlKey && e.key === 'Escape') {
      callback();
    }
  }

  public static tab = (callback: (e: JQuery.Event<HTMLElement>) => void) => (e: JQuery.Event<HTMLElement>) => { // returns a function
    if (!e.metaKey && !e.ctrlKey && !e.shiftKey && e.key === 'Tab') {
      callback(e);
    }
  }

  public static shiftTab = (callback: (e: JQuery.Event<HTMLElement>) => void) => (e: JQuery.Event<HTMLElement>) => { // returns a function
    if (!e.metaKey && !e.ctrlKey && e.shiftKey && e.key === 'Tab') {
      callback(e);
    }
  }

  public static enter = (callback: () => void) => (e: JQuery.Event<HTMLElement, null>) => { // returns a function
    if (!e.metaKey && !e.ctrlKey && e.key === 'Enter') {
      callback();
    }
  }

  public static ctrlEnter = (callback: () => void) => (e: JQuery.Event<HTMLElement, null>) => { // returns a function
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      callback();
    }
  }

  public static setTestState = (state: 'ready' | 'working' | 'waiting') => {
    $('body').attr('data-test-state', state); // for automated tests
  }

  public static buildJquerySels = (sels: Dict<string>): SelCache => {
    const cache: NamedSels = {};
    return {
      cached: (name: string) => {
        if (!cache[name]) {
          if (typeof sels[name] === 'undefined') {
            Catch.report('unknown selector name: ' + name);
          }
          cache[name] = $(sels[name]);
        }
        return cache[name];
      },
      now: (name: string) => {
        if (typeof sels[name] === 'undefined') {
          Catch.report('unknown selector name: ' + name);
        }
        return $(sels[name]);
      },
      sel: (name: string) => {
        if (typeof sels[name] === 'undefined') {
          Catch.report('unknown selector name: ' + name);
        }
        return sels[name];
      }
    };
  }

  public static scroll = (sel: string | JQuery<HTMLElement>, repeat: number[] = []) => {
    const el = $(sel as string).first()[0]; // as string due to JQuery TS quirk. Do not convert to String() as this may actually be JQuery<HTMLElement>
    if (el) {
      el.scrollIntoView();
      for (const delay of repeat) { // useful if mobile keyboard is about to show up
        Catch.setHandledTimeout(() => el.scrollIntoView(), delay);
      }
    }
  }

  public static event = {
    clicked: (selector: string | JQuery<HTMLElement>): Promise<HTMLElement> => new Promise(resolve => $(selector as string).one('click', function () { resolve(this); })),
    stop: () => (e: JQuery.Event) => { // returns a function
      e.preventDefault();
      e.stopPropagation();
      return false;
    },
    protect: () => {
      // prevent events that could potentially leak information about sensitive info from bubbling above the frame
      $('body').on('keyup keypress keydown click drag drop dragover dragleave dragend submit', e => {
        // don't ask me how come Chrome allows it to bubble cross-domain
        // should be used in embedded frames where the parent cannot be trusted (eg parent is webmail)
        // should be further combined with iframe type=content + sandboxing, but these could potentially be changed by the parent frame
        // so this indeed seems like the only defense
        // happened on only one machine, but could potentially happen to other users as well
        // if you know more than I do about the hows and whys of events bubbling out of iframes on different domains, let me know
        e.stopPropagation();
      });
    },
    handle: (cb: (e: HTMLElement, event: JQuery.Event<HTMLElement, null>) => void | Promise<void>, errHandlers?: BrowserEventErrHandler) => {
      return function (this: HTMLElement, event: JQuery.Event<HTMLElement, null>) {
        let r;
        try {
          r = cb(this, event);
          if (typeof r === 'object' && typeof r.catch === 'function') {
            r.catch(e => Ui.event._dispatchErr(e, errHandlers));
          }
        } catch (e) {
          Ui.event._dispatchErr(e, errHandlers);
        }
      };
    },
    _dispatchErr: (e: any, errHandlers?: BrowserEventErrHandler) => {
      if (Api.err.isNetErr(e) && errHandlers && errHandlers.network) {
        errHandlers.network().catch(Catch.reportErr);
      } else if (Api.err.isAuthErr(e) && errHandlers && errHandlers.auth) {
        errHandlers.auth().catch(Catch.reportErr);
      } else if (Api.err.isAuthPopupNeeded(e) && errHandlers && errHandlers.authPopup) {
        errHandlers.authPopup().catch(Catch.reportErr);
      } else if (errHandlers && errHandlers.other) {
        errHandlers.other(e).catch(Catch.reportErr);
      } else {
        Catch.reportErr(e);
      }
    },
    prevent: <THIS extends HTMLElement | void>(evName: PreventableEventName, cb: (el: HTMLElement, resetTimer: () => void) => void | Promise<void>, errHandler?: BrowserEventErrHandler) => {
      let eventTimer: number | undefined;
      let eventFiredOn: number | undefined;
      const cbResetTimer = () => {
        eventTimer = undefined;
        eventFiredOn = undefined;
      };
      const cbWithErrsHandled = (el: HTMLElement) => {
        let r;
        try {
          r = cb(el, cbResetTimer);
          if (typeof r === 'object' && typeof r.catch === 'function') {
            r.catch(e => Ui.event._dispatchErr(e, errHandler));
          }
        } catch (e) {
          Ui.event._dispatchErr(e, errHandler);
        }
      };
      return function (this: THIS) {
        if (evName === 'spree') {
          clearTimeout(eventTimer);
          eventTimer = Catch.setHandledTimeout(() => cbWithErrsHandled(this as HTMLElement), Ui.EVENT_SPREE_MS);
        } else if (evName === 'slowspree') {
          clearTimeout(eventTimer);
          eventTimer = Catch.setHandledTimeout(() => cbWithErrsHandled(this as HTMLElement), Ui.EVENT_SLOW_SPREE_MS);
        } else if (evName === 'veryslowspree') {
          clearTimeout(eventTimer);
          eventTimer = Catch.setHandledTimeout(() => cbWithErrsHandled(this as HTMLElement), Ui.EVENT_VERY_SLOW_SPREE_MS);
        } else {
          if (eventFiredOn) {
            if (evName === 'parallel') {
              // event handling is still being processed. Do not call back
            } else if (evName === 'double') {
              if (Date.now() - eventFiredOn > Ui.EVENT_DOUBLE_MS) {
                eventFiredOn = Date.now();
                cbWithErrsHandled(this as HTMLElement);
              }
            }
          } else {
            eventFiredOn = Date.now();
            cbWithErrsHandled(this as HTMLElement);
          }
        }
      };
    }
  };

  public static time = {
    wait: (untilThisFunctionEvalsTrue: () => boolean | undefined) => new Promise((success, error) => {
      const interval = Catch.setHandledInterval(() => {
        const result = untilThisFunctionEvalsTrue();
        if (result === true) {
          clearInterval(interval);
          if (success) {
            success();
          }
        } else if (result === false) {
          clearInterval(interval);
          if (error) {
            error();
          }
        }
      }, 50);
    }),
    sleep: (ms: number, setCustomTimeout: (code: () => void, t: number) => void = Catch.setHandledTimeout) => new Promise(resolve => setCustomTimeout(resolve, ms)),
  };

  public static e = (name: string, attrs: Dict<string>) => $(`<${name}/>`, attrs)[0].outerHTML; // xss-tested: jquery escapes attributes

  public static modal = {
    info: async (text: string): Promise<void> => {
      await Swal.fire({
        html: Xss.escape(text).replace(/\n/g, '<br>'),
        animation: false,
        allowOutsideClick: false,
        customClass: {
          popup: 'ui-modal-info',
          confirmButton: 'ui-modal-info-confirm',
        },
      });
    },
    warning: async (text: string): Promise<void> => {
      await Swal.fire({
        html: `<span class="orange">${Xss.escape(text).replace(/\n/g, '<br>')}</span>`,
        animation: false,
        allowOutsideClick: false,
        customClass: {
          popup: 'ui-modal-warning',
          confirmButton: 'ui-modal-warning-confirm',
        },
      });
    },
    error: async (text: string, isHTML: boolean = false): Promise<void> => {
      text = isHTML ? Xss.htmlSanitize(text) : Xss.escape(text).replace(/\n/g, '<br>');
      await Swal.fire({
        html: `<span class="red">${text}</span>`,
        animation: false,
        allowOutsideClick: false,
        customClass: {
          popup: 'ui-modal-error',
          confirmButton: 'ui-modal-error-confirm',
        },
      });
    },
    confirm: async (text: string): Promise<boolean> => {
      const { dismiss } = await Swal.fire({
        html: Xss.escape(text).replace(/\n/g, '<br>'),
        animation: false,
        allowOutsideClick: false,
        showCancelButton: true,
        customClass: {
          popup: 'ui-modal-confirm',
          confirmButton: 'ui-modal-confirm-confirm',
          cancelButton: 'ui-modal-confirm-cancel',
        },
      });
      return typeof dismiss === 'undefined';
    },
    confirmWithCheckbox: async (label: string, html: string = ''): Promise<boolean> => {
      const { dismiss } = await Swal.fire({
        html,
        input: 'checkbox',
        inputPlaceholder: label,
        animation: false,
        allowOutsideClick: false,
        customClass: {
          popup: 'ui-modal-confirm-checkbox',
          confirmButton: 'ui-modal-confirm-checkbox-confirm',
          cancelButton: 'ui-modal-confirm-checkbox-cancel',
          input: 'ui-modal-confirm-checkbox-input',
        },
        onOpen: () => {
          const input = Swal.getInput();
          const confirmButton = Swal.getConfirmButton();
          $(confirmButton).prop('disabled', true);
          $(input).on('change', () => {
            $(confirmButton).prop('disabled', !input.checked);
          });
        }
      });
      return typeof dismiss === 'undefined';
    },
  };

  public static toast = async (msg: string): Promise<void> => {
    await Swal.fire({
      toast: true,
      title: msg,
      showConfirmButton: false,
      animation: false,
      position: 'bottom',
      timer: 2000,
      customClass: {
        popup: 'ui-toast',
        title: 'ui-toast-title'
      }
    });
  }
}
