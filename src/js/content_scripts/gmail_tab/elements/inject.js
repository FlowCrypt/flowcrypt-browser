'use strict';

function inject_meta() {
  $('body').append('<link rel="stylesheet" href="' + chrome.extension.getURL('css/gmail.css') + '" />');
  $('body').append('<link rel="stylesheet" href="' + chrome.extension.getURL('css/font-awesome.min.css') + '" />');
  $('body').append('<center class="gmail_notifications"></center>');
}

function inject_buttons(account_email, tab_id) {
  if($('div.aic').length === 0) { // don't inject too early
    setInterval(inject_buttons, 100);
  } else {
    $('div.aic').prepend('<div class="z0"><div class="T-I J-J5-Ji T-I-KE L3 new_message_button" role="button" tabindex="0" style="user-select: none;background: #31A217;" gh="cm">SECURE COMPOSE</div></div>')
    $('div.new_message_button').click(function() {
      if($('div.new_message').length == 0) {
        $('body').append(compose_message_iframe(account_email, tab_id));
      }
    });
  }
}
