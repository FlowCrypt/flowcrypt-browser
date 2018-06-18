/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

const google_oauth2 = (chrome.runtime.getManifest() as any as FlowCryptManifest).oauth2;

function api_google_auth_state_unpack(status_string: string): AuthRequest {
  return JSON.parse(status_string.replace(google_oauth2.state_header, ''));
}

let interval = setInterval(() => {
  if(!document.title) {
    return;
  }
  clearInterval(interval);
  if(tool.value(google_oauth2.state_header).in(document.title)) { // this is FlowCrypt's google oauth - based on a &state= passed on in auth request
    let parts = document.title.split(' ', 2);
    let result = parts[0];
    let params = tool.env.url_params(['code', 'state', 'error'], parts[1]);
    let state_object = api_google_auth_state_unpack(params.state as string);
    let broadcastable = { result: result, params: params, state: state_object };
    tool.browser.message.send(state_object.tab_id, 'google_auth_window_result', broadcastable, () => {
      let close_title = 'Close this window';
      $('title').text(close_title);
      tool.browser.message.send(null, 'close_popup', {title: close_title});
    });
  }
}, 50);