'use strict';

function gmail_api_call(account, resource, parameters, callback) {
  chrome.storage.local.get(['token'], function(storage){
    var token = storage['token'];
    if (typeof token === 'undefined' || token === null || token === '') {
      alert('Please click on plugin button for initial setup');
    }
    else {
      $.ajax({
          url: 'https://www.googleapis.com/gmail/v1/users/me/' + resource,
          method: 'POST',
          data: JSON.stringify(parameters),
          headers: {'Authorization': 'Bearer ' + token},
          crossDomain: true,
          contentType: 'application/json; charset=UTF-8',
          async: true,
          success: function(response) {
            callback(true, response);
          },
          error: function(response) {
            callback(false, response);
          },
      });
    }
  });
}

function base64url(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function gmail_api_message_send(account, to, subject, message, send_email_callback) {
  require.config({
      baseUrl: '../../js',
      paths: {
          'emailjs-mime-builder': './emailjs-mime-builder/src/emailjs-mime-builder',
          'emailjs-addressparser': './emailjs-mime-builder/node_modules/emailjs-addressparser/src/emailjs-addressparser',
          'emailjs-mime-types': './emailjs-mime-builder/node_modules/emailjs-mime-types/src/emailjs-mime-types',
          'emailjs-mime-codec': './emailjs-mime-builder/node_modules/emailjs-mime-codec/src/emailjs-mime-codec',
          'punycode': './emailjs-mime-builder/node_modules/punycode/punycode',
          'emailjs-stringencoding': './emailjs-mime-builder/node_modules/emailjs-stringencoding/src/emailjs-stringencoding',
          'sinon': './emailjs-mime-builder/node_modules/sinon/pkg/sinon',
      },
      shim: {
          sinon: {
              exports: 'sinon',
          }
      }
  });
  require(['emailjs-mime-builder'], function (MimeBuilder) {
    var raw_message = new MimeBuilder('multipart/alternative').setHeader([
      {key: 'To', value: to},
      {key: 'From', value: account},
      {key: 'Subject', value: subject}
    ]).setContent(message).build();
    gmail_api_call(account, 'messages/send', {'raw': base64url(raw_message)}, send_email_callback);
  });
};
