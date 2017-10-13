/* Business Source License 1.0 © 2016-2017 FlowCrypt Limited. Use limitations apply. Contact human@flowcrypt.com */

'use strict';

const google_oauth2 = chrome.runtime.getManifest().oauth2;

function api_google_auth_state_unpack(status_string) {
  return JSON.parse(status_string.replace(google_oauth2.state_header, '', 1));
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
    let state_object = api_google_auth_state_unpack(params.state);
    tool.browser.message.send('broadcast', 'google_auth_window_result', { result: result, params: params, state: state_object }, () => {
      let close_title = 'Close this window';
      $('title').text(close_title);
      tool.browser.message.send(null, 'close_popup', {title: close_title});
    });
  }
}, 50);