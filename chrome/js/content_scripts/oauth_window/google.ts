/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import {Env, Value, BrowserMsg, Ui} from '../../common/common.js';
import * as t from '../../../types/common';
import { AuthRequest } from '../../common/api.js';

(async () => {

  const google_oauth2 = (chrome.runtime.getManifest() as any as t.FlowCryptManifest).oauth2;

  let api_google_auth_state_unpack = (status_string: string): AuthRequest => {
    return JSON.parse(status_string.replace(google_oauth2.state_header, ''));
  };

  while(true) {
    if (document.title && Value.is(google_oauth2.state_header).in(document.title)) { // this is FlowCrypt's google oauth - based on a &state= passed on in auth request
      let parts = document.title.split(' ', 2);
      let result = parts[0];
      let params = Env.url_params(['code', 'state', 'error'], parts[1]);
      let state = api_google_auth_state_unpack(params.state as string);
      await BrowserMsg.send_await(state.tab_id, 'google_auth_window_result', {result, params, state});
      let title = 'Close this window';
      $('title').text(title);
      BrowserMsg.send(null, 'close_popup', {title});
      break;
    }
    await Ui.time.sleep(50);
  }

})().catch(console.error);
