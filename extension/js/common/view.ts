/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { BrowserEventErrHandler, PreventableEventName, Ui } from './browser/ui.js';

import { ApiErr } from './api/shared/api-error.js';
import { Xss } from './platform/xss.js';

export abstract class View {

  public static run<VIEW extends View>(viewClass: new () => VIEW) {
    try {
      const view = new viewClass();
      (async () => {
        await view.render();
        await Promise.resolve(view.setHandlers()); // allow both sync and async
        View.setTestViewStateLoaded();
      })().catch(View.reportAndRenderErr);
    } catch (e) {
      View.reportAndRenderErr(e);
    }
  }

  private static setTestViewStateLoaded = () => {
    $('body').attr('data-test-view-state', 'loaded');
  };

  private static reportAndRenderErr = (e: any) => {
    ApiErr.reportIfSignificant(e);
    Xss.sanitizeRender('body', `
      <br>
      <div data-test="container-err-title">${ApiErr.eli5(e)}</div>
      <br><br>
      <div data-test="container-err-text">${String(e)}</div>
      <br><br>
      ${Ui.retryLink()}
    `);
    Ui.setTestState('ready');
    View.setTestViewStateLoaded();
  };

  public abstract render(): Promise<void>;

  public abstract setHandlers(): void | Promise<void>;

  public setHandler = (cb: (e: HTMLElement, event: JQuery.Event<HTMLElement, null>) => void | Promise<void>, errHandlers?: BrowserEventErrHandler) => {
    return Ui.event.handle(cb, errHandlers, this);
  };

  public setHandlerPrevent = (
    evName: PreventableEventName, cb: (el: HTMLElement, event: Event, resetTimer: () => void) => void | Promise<void>, errHandlers?: BrowserEventErrHandler
  ) => {
    return Ui.event.prevent(evName, cb, errHandlers, this);
  };

  public setEnterHandlerThatClicks = (selector: string) => {
    return (event: JQuery.Event<HTMLElement, null>) => {
      if (event.which === 13) {
        $(selector).click();
      }
    };
  };

}
