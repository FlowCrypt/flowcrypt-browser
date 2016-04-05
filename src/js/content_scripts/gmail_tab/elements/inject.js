'use strict';

var logo = 'iVBORw0KGgoAAAANSUhEUgAAABMAAAAOCAYAAADNGCeJAAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH4AMdAREakDr07QAAAFFJREFUOMtjVOpWYqAWYGFgYGC4W3L3PwMDA4NyjzIjTAKfGDag3KPMyMRARcBCjiZcrqWqywbem7giYnBFAM1cRjtv4kvhhCKD6jmAkZoZHQBF3hzwjZcuRAAAAABJRU5ErkJggg==';

function inject_meta() {
  $('body').append('<link rel="stylesheet" href="' + chrome.extension.getURL('css/gmail.css') + '" />');
  $('body').append('<link rel="stylesheet" href="' + chrome.extension.getURL('css/font-awesome.min.css') + '" />');
  $('body').append('<center class="gmail_notifications"></center>');
}

function inject_buttons(account_email, tab_id) {
  $('body').append('<div class="T-I-KE T-I J-J5-Ji new_message_button"><img src="data:image/png;base64,' + logo + '" /></div>');
  $('div.new_message_button').click(function() {
    if($('div.new_message').length == 0) {
      var url = chrome.extension.getURL('chrome/gmail_elements/new_message.htm') +
        '?account_email=' + encodeURIComponent(account_email) +
        '&parent_tab_id=' + encodeURIComponent(tab_id);
      $('body').append('<div class="new_message" id="new_message"><iframe scrolling="no" src="' + url + '"></iframe></div>');
    }
  });
}
