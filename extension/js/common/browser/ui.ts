/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { ApiErr } from '../api/shared/api-error.js';
import { Catch } from '../platform/catch.js';
import { Dict, Str, Url } from '../core/common.js';
import Swal, { SweetAlertIcon, SweetAlertPosition, SweetAlertResult } from 'sweetalert2';
import { Xss } from '../platform/xss.js';
import { Bm, BrowserMsg, ChildFrame, ScreenDimensions } from './browser-msg.js';

type NamedSels = Dict<JQuery>;

type ProvidedEventHandler = (e: HTMLElement, event: JQuery.TriggeredEvent<HTMLElement>) => void | Promise<void>;

export interface BrowserMsgResponseTracker extends ChildFrame {
  getDest: () => string;
}

export type ConfirmationResultTracker = BrowserMsgResponseTracker;

export class CommonHandlers {
  protected static respondMap = new Map<string, (result: unknown) => void>();

  public static createAsyncResultHandler = <T>() => {
    return async ({ payload, requestUid }: Bm.AsyncResult<T>) => {
      const respond = CommonHandlers.respondMap.get(requestUid);
      if (respond) {
        respond(payload);
        CommonHandlers.respondMap.delete(requestUid);
      }
    };
  };

  public static sendRequestAndHandleAsyncResult = async <T>(send: (requestUid: string) => void): Promise<T> => {
    const requestUid = Str.sloppyRandom(10);
    const p = new Promise((resolve: (value: T) => void) => {
      CommonHandlers.respondMap.set(requestUid, resolve);
    });
    send(requestUid);
    return await p;
  };

  // for specific types
  public static showConfirmationHandler: Bm.AsyncRespondingHandler = async ({ text, isHTML, footer, requestUid }: Bm.ShowConfirmation) => {
    const payload = await Ui.modal.confirm(text, isHTML, footer);
    return { requestUid, payload };
  };
}

export type SelCache = {
  cached: (name: string) => JQuery;
  now: (name: string) => JQuery;
  sel: (name: string) => string;
};
export type PreventableEventName = 'double' | 'parallel' | 'spree' | 'slowspree' | 'veryslowspree';
export type BrowserEventErrHandler = {
  auth?: () => Promise<void>;
  authPopup?: () => Promise<void>;
  network?: () => Promise<void>;
  other?: (e: unknown) => Promise<void>;
};

export class Ui {
  public static EVENT_DOUBLE_MS = 1000;
  public static EVENT_SPREE_MS = 50;
  public static EVENT_SLOW_SPREE_MS = 200;
  public static EVENT_VERY_SLOW_SPREE_MS = 500;

  public static event = {
    clicked: (selector: string | JQuery): Promise<HTMLElement> =>
      new Promise(resolve =>
        $(selector as string).one('click', function () {
          resolve(this);
        })
      ),
    stop: () => (e: JQuery.Event) => {
      // returns a function
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
      return function uiEventHandle(this: HTMLElement, event: JQuery.TriggeredEvent<HTMLElement>) {
        try {
          const r = cb.bind(originalThis)(this, event);
          if (typeof r === 'object' && typeof r.catch === 'function') {
            // eslint-disable-next-line no-underscore-dangle
            r.catch((e: unknown) => Ui.event._dispatchErr(e, errHandlers));
          }
        } catch (e) {
          // eslint-disable-next-line no-underscore-dangle
          Ui.event._dispatchErr(e, errHandlers);
        }
      };
    },
    _dispatchErr: (e: unknown, errHandlers?: BrowserEventErrHandler) => {
      if (ApiErr.isNetErr(e) && errHandlers?.network) {
        errHandlers.network().catch(Catch.reportErr);
      } else if (ApiErr.isAuthErr(e) && errHandlers?.auth) {
        errHandlers.auth().catch(Catch.reportErr);
      } else if (errHandlers?.other) {
        errHandlers.other(e).catch(Catch.reportErr);
      } else {
        Catch.reportErr(e);
      }
    },
    // eslint-disable-next-line @typescript-eslint/no-invalid-void-type, @typescript-eslint/no-unnecessary-type-parameters
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
          // eslint-disable-next-line @typescript-eslint/no-deprecated
          const r = cb.bind(originalThis)(el, event, cbResetTimer);
          if (typeof r === 'object' && typeof r.catch === 'function') {
            // eslint-disable-next-line no-underscore-dangle
            r.catch((e: unknown) => Ui.event._dispatchErr(e, errHandler));
          }
        } catch (e) {
          // eslint-disable-next-line no-underscore-dangle
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
    },
  };

  public static modal = {
    info: async (text: string, isHTML = false): Promise<void> => {
      text = isHTML ? Xss.htmlSanitize(text) : Xss.escape(text).replace(/\n/g, '<br>');
      const userResponsePromise = Ui.swal().fire({
        html: text,
        allowOutsideClick: false,
        customClass: {
          popup: 'ui-modal-info',
          confirmButton: 'ui-modal-info-confirm',
        },
      });
      Ui.activateModalPageLinkTags(); // in case the page itself has data-swal-page links
      await userResponsePromise;
    },
    warning: async (text: string, footer?: string): Promise<void> => {
      const userResponsePromise = Ui.swal().fire({
        html: `<span class="orange">${Xss.escape(text).replace(/\n/g, '<br>')}</span>`,
        footer: footer ? Xss.htmlSanitize(footer) : '',
        allowOutsideClick: false,
        customClass: {
          popup: 'ui-modal-warning',
          confirmButton: 'ui-modal-warning-confirm',
        },
      });
      Ui.activateModalPageLinkTags(); // in case the page itself has data-swal-page links
      await userResponsePromise;
    },
    error: async (text: string, isHTML = false, footer?: string): Promise<void> => {
      text = isHTML ? Xss.htmlSanitize(text) : Xss.escape(text).replace(/\n/g, '<br>');
      const userResponsePromise = Ui.swal().fire({
        html: `<span class="red" data-test="container-error-modal-text">${text}</span>`,
        footer: footer ? Xss.htmlSanitize(footer) : '',
        allowOutsideClick: false,
        customClass: {
          popup: 'ui-modal-error',
          confirmButton: 'ui-modal-error-confirm',
        },
      });
      Ui.activateModalPageLinkTags(); // in case the page itself has data-swal-page links
      await userResponsePromise;
    },
    /**
     * Presents a modal where user can respond with confirm or cancel.
     * Awaiting this will give you the users choice as a boolean.
     */
    confirm: async (text: string, isHTML = false, footer?: string): Promise<boolean> => {
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
    confirmWithCheckbox: async (label: string, html = ''): Promise<boolean> => {
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
          /* eslint-disable @typescript-eslint/no-non-null-assertion */
          const input = Swal.getInput()!;
          const confirmButton = Swal.getConfirmButton()!;
          /* eslint-enable @typescript-eslint/no-non-null-assertion */
          $(confirmButton).prop('disabled', true);
          $(input).on('change', () => {
            $(confirmButton).prop('disabled', !input.checked);
          });
        },
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
      const userResponsePromise = Ui.swal().fire({
        didOpen: () => {
          Swal.getCloseButton()?.blur();
        },
        html,
        width: 750,
        showCloseButton: true,
        scrollbarPadding: true,
        showConfirmButton: false,
        customClass: {
          container: 'ui-modal-page',
          popup: 'ui-modal-iframe',
        },
      });
      Ui.activateModalPageLinkTags(); // in case the page itself has data-swal-page links
      await userResponsePromise;
    },
    iframe: async (iframeUrl: string, iframeHeight?: number, dataTest?: string): Promise<SweetAlertResult> => {
      /* eslint-disable @typescript-eslint/no-non-null-assertion */
      const iframeWidth = Math.min(800, $('body').width()! - 200);
      iframeHeight = iframeHeight || $('body').height()! - ($('body').height()! > 800 ? 150 : 75);
      return await Ui.swal().fire({
        didOpen: () => {
          $(Swal.getPopup()!).attr('data-test', dataTest || 'dialog');
          $(Swal.getCloseButton()!).attr('data-test', 'dialog-close').trigger('blur');
        },
        /* eslint-enable @typescript-eslint/no-non-null-assertion */
        willClose: () => {
          const urlWithoutPageParam = Url.removeParamsFromUrl(window.location.href, ['page']);
          window.history.pushState('', '', urlWithoutPageParam);
        },
        keydownListenerCapture: true,
        html: `<iframe src="${Xss.escape(iframeUrl)}" width="${iframeWidth}" height="${iframeHeight}" style="border: 0"></iframe>`,
        width: 'auto',
        backdrop: 'rgba(0, 0, 0, 0.6)',
        showCloseButton: true,
        scrollbarPadding: true,
        showConfirmButton: false,
        customClass: {
          popup: 'ui-modal-iframe',
        },
      });
    },
    fullscreen: async (html: string): Promise<void> => {
      await Ui.swal().fire({
        didOpen: () => {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          $(Swal.getPopup()!).attr('data-test', 'dialog');
        },
        html: Xss.htmlSanitize(html),
        grow: 'fullscreen',
        showConfirmButton: false,
        customClass: {
          container: 'ui-modal-fullscreen',
        },
      });
    },
    attachmentPreview: async (iframeUrl: string): Promise<void> => {
      await Ui.swal().fire({
        didOpen: () => {
          /* eslint-disable @typescript-eslint/no-non-null-assertion */
          $(Swal.getPopup()!).attr('data-test', 'attachment-dialog');
          $(Swal.getCloseButton()!).attr('data-test', 'dialog-close');
          /* eslint-enable @typescript-eslint/no-non-null-assertion */
        },
        html: `<iframe src="${Xss.escape(iframeUrl)}" style="border: 0" sandbox="allow-scripts allow-same-origin allow-downloads"></iframe>`,
        showConfirmButton: false,
        showCloseButton: true,
        grow: 'fullscreen',
        customClass: {
          container: 'ui-modal-attachment',
        },
      });
    },
  };

  public static getTestCompatibilityLink = (acctEmail: string): string => {
    return `<a href="/chrome/settings/modules/compatibility.htm?acctEmail=${acctEmail}" target="_blank">Test your OpenPGP key compatibility</a>`;
  };

  public static getScreenDimensions = (): ScreenDimensions => {
    const { availLeft, availTop } = window.screen as unknown as { availLeft?: number; availTop?: number };

    return {
      width: window.screen.width,
      height: window.screen.height,
      availLeft: availLeft ?? 0,
      availTop: availTop ?? 0,
    };
  };

  public static modalInParentTab = (confirmationResultTracker: ConfirmationResultTracker) => {
    return {
      /**
       * Presents a modal where user can respond with confirm or cancel.
       * Awaiting this will give you the users choice as a boolean.
       */
      confirm: (text: string, isHTML = false, footer?: string): Promise<boolean> => {
        return CommonHandlers.sendRequestAndHandleAsyncResult(requestUid => {
          BrowserMsg.send.showConfirmation(confirmationResultTracker, {
            text,
            isHTML,
            footer,
            messageSender: confirmationResultTracker.getDest(),
            requestUid,
          });
        });
      },
    };
  };

  public static activateModalPageLinkTags = () => {
    $('[data-swal-page]').on(
      'click',
      Ui.event.handle(async target => {
        const jsAllowedSwalPage = $(target).data('swal-page-allow-js') as boolean; // use this flag is the swal-page contains javascript
        const htmlUrl = $(target).data('swal-page') as string;
        if (jsAllowedSwalPage) {
          await Ui.modal.iframe(htmlUrl);
        } else {
          await Ui.modal.page(htmlUrl);
        }
      })
    );
  };

  public static retryLink = (caption = 'retry') => {
    return `<a href="${Xss.escape(window.location.href)}" data-test="action-retry-by-reloading">${Xss.escape(caption)}</a>`;
  };

  public static delay = async (ms: number): Promise<void> => {
    return await new Promise(resolve => Catch.setHandledTimeout(resolve, ms));
  };

  public static spinner = (color: string, placeholderCls: 'small_spinner' | 'large_spinner' = 'small_spinner') => {
    const path = `/img/svgs/spinner-${color}-small.svg`;

    const url = typeof chrome !== 'undefined' && chrome.runtime?.getURL ? chrome.runtime.getURL(path) : path;
    return `<i class="${placeholderCls}" data-test="spinner"><img src="${url}" /></i>`;
  };

  public static renderOverlayPromptAwaitUserChoice = async (
    btns: Dict<{ title?: string; color?: string }>,
    prompt: string,
    details: string | undefined,
    contactSentence: string
  ): Promise<string> => {
    return await new Promise(resolve => {
      const getEscapedColor = (id: string) => Xss.escape(btns[id].color || 'green');
      const getEscapedTitle = (id: string) => Xss.escape(btns[id].title || id.replace(/_/g, ' '));
      const formatBtn = (id: string) => {
        return `<button class="button ${getEscapedColor(id)} overlay_action_${Xss.escape(id)}" data-test="action-overlay-${Xss.escape(id)}">${getEscapedTitle(
          id
        )}</button>`;
      };
      const formattedBtns = Object.keys(btns).map(formatBtn).join('&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;');
      if (details) {
        const a = `<a href="#" class="action-show-overlay-details" data-test="action-show-overlay-details" style="display:block;text-align:center;">Show technical details</a>`;
        details = `${a}<pre style="font-size:10px;width:900px;overflow-x:scroll;margin:0 auto;" class="display_none" data-test="container-overlay-details">
          ${details.replace(/\n/g, '<br>')}
        </pre>`;
      }
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      Ui.modal.fullscreen(`
        <div class="line" data-test="container-overlay-prompt-text">${prompt.replace(/\n/g, '<br>')}</div>
        <div class="line">${formattedBtns}</div>
        <div class="line">&nbsp;</div>
        <div style="font-size:12px;">${details || ''}</div>
        <div class="line">&nbsp;</div>
        <div class="line">${contactSentence}</div>
      `);
      const overlay = $(Swal.getHtmlContainer()!); // eslint-disable-line @typescript-eslint/no-non-null-assertion
      overlay.find('.action-show-overlay-details').one(
        'click',
        Ui.event.handle(target => {
          $(target).hide().siblings('pre').show();
        })
      );
      for (const id of Object.keys(btns)) {
        overlay.find(`.overlay_action_${id}`).one(
          'click',
          Ui.event.handle(() => {
            Swal.close();
            resolve(id);
          })
        );
      }
    });
  };

  public static escape = (callback: () => void) => {
    return (e: JQuery.Event) => {
      // returns a function
      if (!e.metaKey && !e.ctrlKey && e.key === 'Escape') {
        callback();
      }
    };
  };

  public static tab = (callback: (e: JQuery.Event) => void) => {
    return (e: JQuery.Event) => {
      // returns a function
      if (!e.metaKey && !e.ctrlKey && !e.shiftKey && e.key === 'Tab') {
        callback(e);
      }
    };
  };

  public static shiftTab = (callback: (e: JQuery.Event) => void) => {
    return (e: JQuery.Event) => {
      // returns a function
      if (!e.metaKey && !e.ctrlKey && e.shiftKey && e.key === 'Tab') {
        callback(e);
      }
    };
  };

  public static enter = (callback: () => void) => {
    return (e: JQuery.Event) => {
      // returns a function
      if (!e.metaKey && !e.ctrlKey && e.key === 'Enter') {
        callback();
      }
    };
  };

  public static ctrlEnter = (callback: () => void) => {
    return (e: JQuery.Event) => {
      // returns a function
      if (
        (e.metaKey || e.ctrlKey) &&
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        (e.key === 'Enter' || e.keyCode === 10) // https://bugs.chromium.org/p/chromium/issues/detail?id=79407
      ) {
        callback();
      }
    };
  };

  public static setTestState = (state: 'ready' | 'working' | 'waiting') => {
    document.querySelector('body')?.setAttribute('data-test-state', state); // for automated tests
  };

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
      },
    };
  };

  public static scroll = (sel: string | JQuery, repeat: number[] = []) => {
    const el = $(sel as string).first()[0]; // as string due to JQuery TS quirk. Do not convert to String() as this may actually be JQuery<HTMLElement>
    if (el) {
      el.scrollIntoView();
      for (const delay of repeat) {
        // useful if mobile keyboard is about to show up
        Catch.setHandledTimeout(() => el.scrollIntoView(), delay);
      }
    }
  };

  public static e(name: string, attrs: Dict<string>) {
    return $(`<${name}/>`, attrs)[0].outerHTML; // xss-tested: jquery escapes attributes
  }

  public static toast = (text: string, isHTML = false, seconds = 2, position: SweetAlertPosition = 'bottom', icon?: SweetAlertIcon) => {
    text = isHTML ? Xss.htmlSanitize(text) : Xss.escape(text).replace(/\n/g, '<br>');
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    Ui.swal().fire({
      toast: true,
      title: text,
      icon,
      showConfirmButton: false,
      position,
      timer: seconds * 1000,
      timerProgressBar: true,
      customClass: {
        container: 'ui-toast-container',
        popup: 'ui-toast',
        title: 'ui-toast-title',
      },
      didOpen: toast => {
        toast.addEventListener('mouseenter', Swal.stopTimer);
        toast.addEventListener('mouseleave', Swal.resumeTimer);
      },
    });
  };

  private static swal = () =>
    Swal.mixin({
      showClass: { popup: 'swal2-noanimation', backdrop: 'swal2-noanimation' },
      hideClass: { popup: '', backdrop: '' },
    });
}
