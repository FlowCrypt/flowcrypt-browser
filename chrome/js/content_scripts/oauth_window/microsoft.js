/* Business Source License 1.0 © 2016 Tom James Holub (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/tomholub/cryptup-chrome/tree/master/src/LICENCE */

'use strict';

// todo - parse the reply tab url from the state
// for now broadcasting

if(window.location.hash) { // this is cryptup's microsoft oauth access_token result
  tool.browser.message.send('broadcast', 'microsoft_access_token_result', { fragment: window.location.hash });
}

document.write('<style type="text/undefined">');
$('html').append('<body>Grant processed, you can close the window now.</body>');


