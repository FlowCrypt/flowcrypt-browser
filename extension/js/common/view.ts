
/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Api } from './api/api.js';
import { Xss } from './platform/xss.js';
import { Ui, BrowserEventErrHandler, PreventableEventName } from './browser/ui.js';

export abstract class View {

  abstract async render(): Promise<void>;

  abstract setHandlers(): void;

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

  private static reportAndRenderErr(e: any) {
    Api.err.reportIfSignificant(e);
    Xss.sanitizeRender('body', `${Api.err.eli5(e)}<br>${String(e)}<br><br>${Ui.retryLink()}`);
  }

  public setHandler(cb: (e: HTMLElement, event: JQuery.Event<HTMLElement, null>) => void | Promise<void>, errHandlers?: BrowserEventErrHandler) {
    return Ui.event.handle(cb, errHandlers, this);
  }

  public setHandlerPrevent<THIS extends HTMLElement | void>(
    evName: PreventableEventName, cb: (el: HTMLElement, resetTimer: () => void) => void | Promise<void>, errHandlers?: BrowserEventErrHandler
  ) {
    return Ui.event.prevent(evName, cb, errHandlers, this);
  }

  public setEnterHandlerThatClicks(selector: string) {
    return (event: JQuery.Event<HTMLElement, null>) => {
      if (event.which === 13) {
        $(selector).click();
      }
    };
  }

}
