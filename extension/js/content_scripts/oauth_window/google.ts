/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Value } from '../../common/common.js';
import { AuthReq } from '../../common/api.js';
import { FlowCryptManifest, BrowserMsg } from '../../common/extension.js';
import { Ui, Env } from '../../common/browser.js';

(async () => {

  const googleOauth2 = (chrome.runtime.getManifest() as any as FlowCryptManifest).oauth2;

  const apiGoogleAuthStateUnpack = (statusString: string): AuthReq => {
    return JSON.parse(statusString.replace(googleOauth2.state_header, ''));
  };

  while (true) {
    if (document.title && Value.is(googleOauth2.state_header).in(document.title)) { // this is FlowCrypt's google oauth - based on a &state= passed on in auth request
      const parts = document.title.split(' ', 2);
      const result = parts[0];
      const params = Env.urlParams(['code', 'state', 'error'], parts[1]);
      const state = apiGoogleAuthStateUnpack(params.state as string);
      await BrowserMsg.sendAwait(state.tabId, 'google_auth_window_result', { result, params, state });
      const title = 'Close this window';
      $('title').text(title);
      BrowserMsg.send(null, 'close_popup', { title });
      break;
    }
    await Ui.time.sleep(50);
  }

})().catch(console.error);
