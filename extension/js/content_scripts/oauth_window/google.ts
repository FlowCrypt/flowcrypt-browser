/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Env, Value } from '../../common/common.js';
import { AuthReq } from '../../common/api.js';
import { FlowCryptManifest, BrowserMsg } from '../../common/extension.js';
import { Ui } from '../../common/browser.js';

(async () => {

  const googleOauth2 = (chrome.runtime.getManifest() as any as FlowCryptManifest).oauth2;

  let apiGoogleAuthStateUnpack = (statusString: string): AuthReq => {
    return JSON.parse(statusString.replace(googleOauth2.state_header, ''));
  };

  while (true) {
    if (document.title && Value.is(googleOauth2.state_header).in(document.title)) { // this is FlowCrypt's google oauth - based on a &state= passed on in auth request
      let parts = document.title.split(' ', 2);
      let result = parts[0];
      let params = Env.urlParams(['code', 'state', 'error'], parts[1]);
      let state = apiGoogleAuthStateUnpack(params.state as string);
      await BrowserMsg.sendAwait(state.tabId, 'google_auth_window_result', { result, params, state });
      let title = 'Close this window';
      $('title').text(title);
      BrowserMsg.send(null, 'close_popup', { title });
      break;
    }
    await Ui.time.sleep(50);
  }

})().catch(console.error);
