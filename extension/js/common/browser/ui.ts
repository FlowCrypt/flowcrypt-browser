/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { ApiErr } from '../api/shared/api-error.js';
import { Catch } from '../platform/catch.js';
import { Dict, Url } from '../core/common.js';
import Swal, { SweetAlertResult } from 'sweetalert2';
import { Xss } from '../platform/xss.js';

type NamedSels = Dict<JQuery<HTMLElement>>;
type ProvidedEventHandler = (e: HTMLElement, event: JQuery.Event<HTMLElement, null>) => void | Promise<void>;

export type SelCache = { cached: (name: string) => JQuery<HTMLElement>; now: (name: string) => JQuery<HTMLElement>; sel: (name: string) => string; };
export type PreventableEventName = 'double' | 'parallel' | 'spree' | 'slowspree' | 'veryslowspree';
export type BrowserEventErrHandler = { auth?: () => Promise<void>, authPopup?: () => Promise<void>, network?: () => Promise<void>, other?: (e: any) => Promise<void> };

export class Ui {

  public static EVENT_DOUBLE_MS = 1000;
  public static EVENT_SPREE_MS = 50;
  public static EVENT_SLOW_SPREE_MS = 200;
  public static EVENT_VERY_SLOW_SPREE_MS = 500;

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
    handle: (cb: ProvidedEventHandler, errHandlers?: BrowserEventErrHandler, originalThis?: unknown) => {
      return function uiEventHandle(this: HTMLElement, event: JQuery.Event<HTMLElement, null>) {
        try {
          const r = cb.bind(originalThis)(this, event) as void | Promise<void>; // tslint:disable-line:no-unsafe-any
          if (typeof r === 'object' && typeof r.catch === 'function') { // tslint:disable-line:no-unbound-method - only testing if exists
            r.catch(e => Ui.event._dispatchErr(e, errHandlers));
          }
        } catch (e) {
          Ui.event._dispatchErr(e, errHandlers);
        }
      };
    },
    _dispatchErr: (e: any, errHandlers?: BrowserEventErrHandler) => {
      if (ApiErr.isNetErr(e) && errHandlers && errHandlers.network) {
        errHandlers.network().catch(Catch.reportErr);
      } else if (ApiErr.isAuthErr(e) && errHandlers && errHandlers.auth) {
        errHandlers.auth().catch(Catch.reportErr);
      } else if (errHandlers && errHandlers.other) {
        errHandlers.other(e).catch(Catch.reportErr);
      } else {
        Catch.reportErr(e);
      }
    },
    prevent: <THIS extends HTMLElement | void>(
      evName: PreventableEventName,
      cb: (el: HTMLElement, event: Event | undefined, resetTimer: () => void) => void | Promise<void>,
      errHandler?: BrowserEventErrHandler,
      originalThis?: unknown
    ) => {
      let eventTimer: number | undefined;
      let eventFiredOn: number | undefined;
      const cbResetTimer = () => {
        eventTimer = undefined;
        eventFiredOn = undefined;
      };
      const cbWithErrsHandled = (el: HTMLElement) => {
        try {
          const r = cb.bind(originalThis)(el, event, cbResetTimer) as void | Promise<void>; // tslint:disable-line:no-unsafe-any
          if (typeof r === 'object' && typeof r.catch === 'function') { // tslint:disable-line:no-unbound-method - only testing if exists
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
    wait: (untilThisFunctionEvalsTrue: () => boolean | undefined): Promise<void> => new Promise((success, error) => {
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
    sleep: (ms: number, setCustomTimeout: (code: () => void, t: number) => void = Catch.setHandledTimeout): Promise<void> => new Promise(resolve => setCustomTimeout(resolve, ms)),
  };

  public static modal = {
    info: async (text: string, isHTML: boolean = false): Promise<void> => {
      text = isHTML ? Xss.htmlSanitize(text) : Xss.escape(text).replace(/\n/g, '<br>');
      await Ui.swal().fire({
        html: text,
        allowOutsideClick: false,
        customClass: {
          popup: 'ui-modal-info',
          confirmButton: 'ui-modal-info-confirm',
        },
      });
      Ui.activateModalPageLinkTags(); // in case the page itself has data-swal-page links
    },
    warning: async (text: string, footer?: string): Promise<void> => {
      await Ui.swal().fire({
        html: `<span class="orange">${Xss.escape(text).replace(/\n/g, '<br>')}</span>`,
        footer: footer ? Xss.htmlSanitize(footer) : '',
        allowOutsideClick: false,
        customClass: {
          popup: 'ui-modal-warning',
          confirmButton: 'ui-modal-warning-confirm',
        },
      });
      Ui.activateModalPageLinkTags(); // in case the page itself has data-swal-page links
    },
    error: async (text: string, isHTML: boolean = false, footer?: string): Promise<void> => {
      text = isHTML ? Xss.htmlSanitize(text) : Xss.escape(text).replace(/\n/g, '<br>');
      await Ui.swal().fire({
        html: `<span class="red">${text}</span>`,
        footer: footer ? Xss.htmlSanitize(footer) : '',
        allowOutsideClick: false,
        customClass: {
          popup: 'ui-modal-error',
          confirmButton: 'ui-modal-error-confirm',
        },
      });
      Ui.activateModalPageLinkTags(); // in case the page itself has data-swal-page links
    },
    /**
     * Presents a modal where user can respond with confirm or cancel.
     * Awaiting this will give you the users choice as a boolean.
     */
    confirm: async (text: string, isHTML: boolean = false, footer?: string): Promise<boolean> => {
      const html = isHTML ? Xss.htmlSanitize(text) : Xss.escape(text).replace(/\n/g, '<br>');
      const userResponsePromise = Ui.swal().fire({
        html,
        footer: footer ? Xss.htmlSanitize(footer) : '',
        allowOutsideClick: false,
        showCancelButton: true,
        customClass: {
          popup: 'ui-modal-confirm',
          confirmButton: 'ui-modal-confirm-confirm',
          cancelButton: 'ui-modal-confirm-cancel',
        },
      });
      Ui.activateModalPageLinkTags(); // in case the page itself has data-swal-page links
      const { dismiss } = await userResponsePromise;
      return typeof dismiss === 'undefined';
    },
    confirmWithCheckbox: async (label: string, html: string = ''): Promise<boolean> => {
      const userResponsePromise = Ui.swal().fire({
        html,
        input: 'checkbox',
        inputPlaceholder: label,
        allowOutsideClick: false,
        customClass: {
          popup: 'ui-modal-confirm-checkbox',
          confirmButton: 'ui-modal-confirm-checkbox-confirm',
          cancelButton: 'ui-modal-confirm-checkbox-cancel',
          input: 'ui-modal-confirm-checkbox-input',
        },
        didOpen: () => {
          const input = Swal.getInput()!;
          const confirmButton = Swal.getConfirmButton()!;
          $(confirmButton).prop('disabled', true);
          $(input).on('change', () => {
            $(confirmButton).prop('disabled', !input.checked);
          });
        }
      });
      Ui.activateModalPageLinkTags(); // in case the page itself has data-swal-page links
      const { dismiss } = await userResponsePromise;
      return typeof dismiss === 'undefined';
    },
    page: async (htmlUrl: string, replaceNewlines = false): Promise<void> => {
      let html = await (await fetch(htmlUrl)).text();
      html = Xss.htmlSanitize(html);
      if (replaceNewlines) {
        html = html.replace(/\n/g, '<br>');
      }
      await Ui.swal().fire({
        didOpen: () => {
          Swal.getCloseButton()!.blur();
        },
        html,
        width: 750,
        showCloseButton: true,
        scrollbarPadding: true,
        showConfirmButton: false,
        customClass: {
          container: 'ui-modal-page',
          popup: 'ui-modal-iframe'
        }
      });
      Ui.activateModalPageLinkTags(); // in case the page itself has data-swal-page links
    },
    iframe_DANGEROUS: async (iframeUrl_MUST_BE_XSS_SAFE: string): Promise<SweetAlertResult> => { // xss-dangerous-function
      const iframeWidth = Math.min(800, $('body').width()! - 200);
      const iframeHeight = $('body').height()! - ($('body').height()! > 800 ? 150 : 75);
      return await Ui.swal().fire({
        didOpen: () => {
          debugger
          $(Swal.getPopup()!).attr('data-test', 'dialog');
          $(Swal.getCloseButton()!).attr('data-test', 'dialog-close').blur();
        },
        willClose: () => {
          const urlWithoutPageParam = Url.removeParamsFromUrl(window.location.href, ['page']);
          window.history.pushState('', '', urlWithoutPageParam);
        },
        keydownListenerCapture: true,
        html: `<iframe src="${iframeUrl_MUST_BE_XSS_SAFE}" width="${iframeWidth}" height="${iframeHeight}" style="border: 0"></iframe>`,
        width: 'auto',
        backdrop: 'rgba(0, 0, 0, 0.6)',
        showCloseButton: true,
        scrollbarPadding: true,
        showConfirmButton: false,
        customClass: {
          popup: 'ui-modal-iframe'
        }
      });
    },
    fullscreen: async (html: string): Promise<void> => {
      await Ui.swal().fire({
        didOpen: () => {
          $(Swal.getPopup()!).attr('data-test', 'dialog');
        },
        html: Xss.htmlSanitize(html),
        grow: 'fullscreen',
        showConfirmButton: false,
        customClass: {
          container: 'ui-modal-fullscreen'
        }
      });
    },
    attachmentPreview: async (iframeUrl: string): Promise<void> => {
      await Ui.swal().fire({
        didOpen: () => {
          $(Swal.getPopup()!).attr('data-test', 'attachment-dialog');
          $(Swal.getCloseButton()!).attr('data-test', 'dialog-close');
        },
        html: `<iframe src="${Xss.escape(iframeUrl)}" style="border: 0" sandbox="allow-scripts allow-same-origin allow-downloads"></iframe>`,
        showConfirmButton: false,
        showCloseButton: true,
        grow: 'fullscreen',
        customClass: {
          container: 'ui-modal-attachment'
        }
      });
    },
  };


  public static testCompatibilityLink = '<a href="/chrome/settings/modules/compatibility.htm" target="_blank">Test your OpenPGP key compatibility</a>';

  public static activateModalPageLinkTags = () => {
    $('[data-swal-page]').click(Ui.event.handle(async (target) => {
      await Ui.modal.page($(target).data('swal-page') as string);
    }));
  }

  public static retryLink = (caption: string = 'retry') => {
    return `<a href="${Xss.escape(window.location.href)}" data-test="action-retry-by-reloading">${Xss.escape(caption)}</a>`;
  }

  public static delay = async (ms: number): Promise<void> => {
    return await new Promise(resolve => Catch.setHandledTimeout(resolve, ms));
  }

  public static spinner = (color: string, placeholderCls: "small_spinner" | "large_spinner" = 'small_spinner') => {
    const path = `/img/svgs/spinner-${color}-small.svg`;
    const url = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL ? chrome.runtime.getURL(path) : path;
    return `<i class="${placeholderCls}" data-test="spinner"><img src="${url}" /></i>`;
  }

  public static renderOverlayPromptAwaitUserChoice = async (btns: Dict<{ title?: string, color?: string }>, prompt: string, details?: string): Promise<string> => {
    return await new Promise(resolve => {
      const getEscapedColor = (id: string) => Xss.escape(btns[id].color || 'green');
      const getEscapedTitle = (id: string) => Xss.escape(btns[id].title || id.replace(/_/g, ' '));
      const formatBtn = (id: string) => {
        return `<button class="button ${getEscapedColor(id)} overlay_action_${Xss.escape(id)}" data-test="action-overlay-${Xss.escape(id)}">${getEscapedTitle(id)}</button>`;
      };
      const formattedBtns = Object.keys(btns).map(formatBtn).join('&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;');
      if (details) {
        const a = `<a href="#" class="action-show-overlay-details" data-test="action-show-overlay-details" style="display:block;text-align:center;">Show technical details</a>`;
        details = `${a}<pre style="font-size:10px;width:900px;overflow-x:scroll;margin:0 auto;" class="display_none" data-test="container-overlay-details">
          ${details.replace(/\n/g, '<br>')}
        </pre>`;
      }
      // tslint:disable-next-line:no-floating-promises
      Ui.modal.fullscreen(`
        <div class="line" data-test="container-overlay-prompt-text">${prompt.replace(/\n/g, '<br>')}</div>
        <div class="line">${formattedBtns}</div>
        <div class="line">&nbsp;</div>
        <div style="font-size:12px;">${details || ''}</div>
        <div class="line">&nbsp;</div>
        <div class="line">Email human@flowcrypt.com if you need assistance.</div>
      `);
      const overlay = $(Swal.getHtmlContainer()!);
      overlay.find('.action-show-overlay-details').one('click', Ui.event.handle(target => {
        $(target).hide().siblings('pre').show();
      }));
      for (const id of Object.keys(btns)) {
        overlay.find(`.overlay_action_${id}`).one('click', Ui.event.handle(() => {
          Swal.close();
          resolve(id);
        }));
      }
    });
  }

  public static escape = (callback: () => void) => {
    return (e: JQuery.Event<HTMLElement, null>) => { // returns a function
      if (!e.metaKey && !e.ctrlKey && e.key === 'Escape') {
        callback();
      }
    };
  }

  public static tab = (callback: (e: JQuery.Event<HTMLElement>) => void) => {
    return (e: JQuery.Event<HTMLElement>) => { // returns a function
      if (!e.metaKey && !e.ctrlKey && !e.shiftKey && e.key === 'Tab') {
        callback(e);
      }
    };
  }

  public static shiftTab = (callback: (e: JQuery.Event<HTMLElement>) => void) => {
    return (e: JQuery.Event<HTMLElement>) => { // returns a function
      if (!e.metaKey && !e.ctrlKey && e.shiftKey && e.key === 'Tab') {
        callback(e);
      }
    };
  }

  public static enter = (callback: () => void) => {
    return (e: JQuery.Event<HTMLElement, null>) => { // returns a function
      if (!e.metaKey && !e.ctrlKey && e.key === 'Enter') {
        callback();
      }
    };
  }

  public static ctrlEnter = (callback: () => void) => {
    return (e: JQuery.Event<HTMLElement, null>) => { // returns a function
      if (
        (e.metaKey || e.ctrlKey) &&
        (e.key === 'Enter' || e.keyCode === 10) // https://bugs.chromium.org/p/chromium/issues/detail?id=79407
      ) {
        callback();
      }
    };
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

  public static e(name: string, attrs: Dict<string>) {
    return $(`<${name}/>`, attrs)[0].outerHTML; // xss-tested: jquery escapes attributes
  }

  public static toast = (msg: string, seconds = 2) => {
    // tslint:disable-next-line:no-floating-promises
    Ui.swal().fire({
      toast: true,
      title: msg,
      showConfirmButton: false,
      position: 'bottom',
      timer: seconds * 1000,
      timerProgressBar: true,
      customClass: {
        container: 'ui-toast-container',
        popup: 'ui-toast',
        title: 'ui-toast-title'
      },
      didOpen: (toast) => {
        toast.addEventListener('mouseenter', Swal.stopTimer);
        toast.addEventListener('mouseleave', Swal.resumeTimer);
      }
    });
  }

  private static swal = () => Swal.mixin({
    showClass: { popup: 'swal2-noanimation', backdrop: 'swal2-noanimation' },
    hideClass: { popup: '', backdrop: '' },
  })
}
