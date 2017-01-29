/* Business Source License 1.0 © 2016 Tom James Holub (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/tomholub/cryptup-chrome/tree/master/src/LICENCE */

'use strict';

var gmail_oauth2 = chrome.runtime.getManifest().oauth2;

if(document.title.indexOf(gmail_oauth2.state_header) !== -1) { // this is cryptup's google oauth - based on a &state= passed on in auth request
  chrome_message_send(null, 'gmail_auth_code_result', { title: document.title }, window.close);
}
