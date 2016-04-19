'use strict';

function inject_meta() {
  $('body').append('<link rel="stylesheet" href="' + chrome.extension.getURL('css/gmail.css') + '" />');
  $('body').append('<link rel="stylesheet" href="' + chrome.extension.getURL('css/font-awesome.min.css') + '" />');
  $('body').append('<center class="gmail_notifications"></center>');
}

function inject_buttons(account_email, tab_id) {
  $('body').append('<div class="T-I-KE T-I J-J5-Ji new_message_button"><img src="' + get_logo_src(true) + '" /></div>');
  $('div.new_message_button').click(function() {
    if($('div.new_message').length == 0) {
      $('body').append(compose_message_iframe(account_email, tab_id));
    }
  });
}
