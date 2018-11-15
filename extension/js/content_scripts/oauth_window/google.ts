/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Value } from '../../common/common.js';
import { BrowserMsg, GoogleAuthWindowResult$result } from '../../common/extension.js';
import { Ui, Env } from '../../common/browser.js';
import { Google, AuthReq } from '../../common/api/google.js';
import { Catch } from '../../common/catch.js';

(async () => {

  const apiGoogleAuthStateUnpack = (statusString: string): AuthReq => {
    return JSON.parse(statusString.replace(Google.OAUTH.state_header, '')) as AuthReq; // todo - maybe can check with a type guard and throw if not
  };

  while (true) {
    if (document.title && Value.is(Google.OAUTH.state_header).in(document.title)) {
      // this is FlowCrypt's google oauth - based on a &state= passed on in auth request
      const parts = document.title.split(' ', 2);
      const result = parts[0];
      const params = Env.urlParams(['code', 'state', 'error'], parts[1]);
      const state = apiGoogleAuthStateUnpack(params.state as string);
      await BrowserMsg.send.await.googleAuthWindowResult(state.tabId, {
        result: result as GoogleAuthWindowResult$result,
        params: {
          code: String(params.code),
          error: String(params.error),
        },
        state,
      });
      const title = 'Close this window';
      $('title').text(title);
      BrowserMsg.send.bg.closePopup({ title });
      break;
    }
    await Ui.time.sleep(50);
  }

})().catch(Catch.handleErr);
