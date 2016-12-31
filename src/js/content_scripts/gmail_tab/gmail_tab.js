'use strict';

Try(function() {

  window.injected = true; // background page will test if scripts are already injected, and injectif not
  window.destruction_event = chrome.runtime.id + '_destroy'
  window.destroyable_class = chrome.runtime.id + '_destroyable';
  window.destroyable_intervals = [];
  window.destroyable_timeouts = [];

  window.destroy = function() { // not used yet
    console.log('Destroying CryptUP');
    document.removeEventListener(destruction_event, destroy);
    $.each(destroyable_intervals, function(i, id) {
      clearInterval(id);
    });
    $.each(destroyable_timeouts, function(i, id) {
      clearTimeout(id);
    });
    $('.' + destroyable_class).remove();
  };

  window.vacant = function() {
    return !$('.' + destroyable_class).length && !$('.gmail_notifications').length && !$('.new_message_button').length;
  };

  document.dispatchEvent(new CustomEvent(destruction_event));
  document.addEventListener(destruction_event, destroy);

  init_elements_factory_js();
  init_elements_inject_js();
  init_elements_notifications_js();
  init_elements_replace_js();
  init_setup_js();

  if(window.vacant()) {
    wait_for_account_email_then_setup();
  }

})();
