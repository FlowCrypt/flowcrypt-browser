/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Bm } from './browser-msg.js';
import { Url } from '../core/common.js';

export class BrowserMsgCommonHandlers {

  // -- these few are set on every listener automatically

  public static setCss = async (data: Bm.SetCss) => {
    let el = $(data.selector);
    const traverseUpLevels = data.traverseUp as number || 0;
    for (let i = 0; i < traverseUpLevels; i++) {
      el = el.parent();
    }
    el.css(data.css);
  }

  public static addClass = async (data: Bm.AddOrRemoveClass) => {
    $(data.selector).addClass(data.class);
  }

  public static removeClass = async (data: Bm.AddOrRemoveClass) => {
    $(data.selector).removeClass(data.class);
  }

  // -- these below have to be set manually when appropriate

  public static replyPubkeyMismatch = async () => {
    const replyIframe = $('iframe.reply_message').get(0) as HTMLIFrameElement | undefined;
    if (replyIframe) {
      const bareSrc = Url.removeParamsFromUrl(replyIframe.src, ['ignoreDraft', 'disableDraftSaving', 'draftId', 'replyPubkeyMismatch', 'skipClickPrompt']);
      replyIframe.src = Url.create(bareSrc, { replyPubkeyMismatch: true, ignoreDraft: true, disableDraftSaving: true, draftId: '', skipClickPrompt: true });
    }
  }

}
