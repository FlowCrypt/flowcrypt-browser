
/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { BrowserEventErrHandler, PreventableEventName, Ui } from './browser/ui.js';

import { ApiErr } from './api/error/api-error.js';
import { Xss } from './platform/xss.js';

export abstract class View {

  public static run<VIEW extends View>(viewClass: new () => VIEW) {
    try {
      const view = new viewClass();
      (async () => {
        await view.render();
        view.setHandlers();
      })().catch(View.reportAndRenderErr);
    } catch (e) {
      View.reportAndRenderErr(e);
    }
  }

  private static reportAndRenderErr = (e: any) => {
    ApiErr.reportIfSignificant(e);
    Xss.sanitizeRender('body', `
      <br>
      <div data-test="container-err-title" style="width: 900px;display:inline-block;">${ApiErr.eli5(e)}</div>
      <br><br>
      <div data-test="container-err-text" style="width: 900px;display:inline-block;">${String(e)}</div>
      <br><br>
      ${Ui.retryLink()}
    `);
  }

  public abstract async render(): Promise<void>;

  public abstract setHandlers(): void;

  public setHandler = (cb: (e: HTMLElement, event: JQuery.Event<HTMLElement, null>) => void | Promise<void>, errHandlers?: BrowserEventErrHandler) => {
    return Ui.event.handle(cb, errHandlers, this);
  }

  public setHandlerPrevent = <THIS extends HTMLElement | void>(
    evName: PreventableEventName, cb: (el: HTMLElement, resetTimer: () => void) => void | Promise<void>, errHandlers?: BrowserEventErrHandler
  ) => {
    return Ui.event.prevent(evName, cb, errHandlers, this);
  }

  public setEnterHandlerThatClicks = (selector: string) => {
    return (event: JQuery.Event<HTMLElement, null>) => {
      if (event.which === 13) {
        $(selector).click();
      }
    };
  }

}
