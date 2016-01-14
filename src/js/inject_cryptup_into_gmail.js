

if (document.title.indexOf("Gmail") != -1 || document.title.indexOf("Mail") != -1) {

  // console.log(window.navigator.appVersion);
  // console.log(window.navigator.platform);

  $('body').append('<div class="cryptup_logo"></div>');
  $('body').append('<div class="T-I-KE T-I J-J5-Ji new_message_button">@</div>');
  // $('body').append('<link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/font-awesome/4.5.0/css/font-awesome.min.css" />');
  $('body').append('<link rel="stylesheet" href="' + chrome.extension.getURL('css/gmail.css') + '" />');
  // $('body').append('<script src="' + chrome.extension.getURL('lib/emailjs-mime-builder/node_modules/requirejs/require.js') + '"></script>');
  // $('body').append('<script src="' + chrome.extension.getURL('lib/gmail-api.js') + '"></script>');

  $('div.new_message_button').click(function(){
    if($('div.new_message').length == 0) {
      $('body').append('<div class="new_message" id="new_message"><iframe scrolling="no" src="' + chrome.extension.getURL('chrome/gmail_elements/new_message.htm') + '"></iframe></div>');
    }
  });

  // $('div.reply').click(function(){
  //   if($('div.reply_message').length == 0) {
  //     $('body').append('<div class="reply_message" id="reply_message"><iframe src="' + chrome.extension.getURL('elements/reply_message.htm') + '"></iframe></div>');
  //   }
  // });
}
