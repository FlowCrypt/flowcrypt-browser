var gmail_oauth2 = chrome.runtime.getManifest().oauth2;

signal_scope_set(signal_scope_default_value);

if(document.title.indexOf(gmail_oauth2.state_header) !== -1) {  // this is cryptup's google oauth - based on a &state= passed on in auth request
  signal_send('background_process', 'gmail_auth_code_result', {
    title: document.title
  }, null, function() {
    window.close();
  });
}
