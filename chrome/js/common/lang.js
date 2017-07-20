/* Business Source License 1.0 © 2016 FlowCrypt Limited (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/CryptUp/cryptup-browser/tree/master/src/LICENCE */

'use strict';


(function(){

  var _self = {
    account: {
      credit_or_debit: 'Enter credit or debit card to use. You can cancel anytime.',
    },
    pgp_block: {
      cant_open: 'Could not open this message with CryptUp.\n\n',
      your_key_cant_open_import_if_have: 'Your current key cannot open this message. If you have any other keys available, you should import them now.\n',
      encrypted_correctly_file_bug: 'It\'s correctly encrypted for you. Please file a bug report if you see this on multiple messages. ',
      single_sender: 'Normally, messages are encrypted for at least two people (sender and the receiver). It seems the sender encrypted this message manually for themselves, and forgot to add you as a receiver. ',
      account_info_outdated: 'Some of your account information is incorrect. Update it to prevent future errors. ',
      wrong_pubkey_used: 'It looks like it was encrypted for someone else. If you have more keys that may help decrypt this message, you can add them in the settings. ',
      ask_resend: 'Please ask them to send a new message.\n',
      receivers_hidden: 'Cannot tell if the message was encrypted correctly for you. ',
      bad_format: 'Message is either badly formatted or not compatible with CryptUp. ',
      no_private_key: 'No private key to decrypt this message. Try reloading the page. ',
      refresh_page: 'Refresh page to see more information.',
      question_decryt_prompt: 'Please enter password to decrypt the message',
      connection_error: 'Could not connect to email provider to open the message, please refresh the page to try again. ',
      dont_know_how_open: 'Please email me at tom@cryptup.org to submit a bug report, and mention what software was used to send this message to you. We usually fix similar incompatibilities within one week. ',
      enter_passphrase: 'Enter passphrase',
      to_open_message: 'to open this message.',
      write_me: 'Please write me at tom@cryptup.org so that I can fix it. I respond very promptly. ',
      refresh_window: 'Please refresh your web mail window to read encrypted messages. ',
      update_chrome_settings: 'Need to update chrome settings to view encrypted messages. ',
      not_properly_set_up: 'CryptUp is not properly set up to decrypt messages. This can also be caused by Incognito or Private Browsing mode. ',
      mdc_warning: 'This message was badly encrypted. Do not consider it private. The sender should update their encryption software.\n\nIt allows for a known vulnerability to be exploited (missing MDC in combination with modern cipher) that may allow unintended parties to read the contents.',
      message_expired_on: 'Message expired on ',
      messages_dont_expire: 'Messages don\'t expire if recipients also have encryption set up.',
      message_destroyed: 'Message was destroyed 30 days after expiration and cannot be renewed.',
      ask_sender_renew: 'Please ask the sender to renew the message if you still need the contents',
      cannot_locate: 'Could not locate this message.',
      broken_link: 'It seems it contains a broken link.',
    },
    compose: {
      message_encrypted_html: 'This&nbsp;message&nbsp;is&nbsp;encrypted: ',
      message_encrypted_text: 'This message is encrypted. Follow this link to open it: ',
      alternatively_copy_paste: 'Alternatively copy and paste the following link: ',
      open_message: 'Open Message',
      include_pubkey_icon_title: 'Include your Public Key with this message.\n\nThis allows people using non-CryptUp encryption to reply to you.',
      include_pubkey_icon_title_active: 'Your Public Key will be included with this message.\n\nThis allows people using non-CryptUp encryption to reply to you.',
      header_title_compose_encrypt: 'New Secure Message',
      header_title_compose_sign: 'New Signed Message (not encrypted)',
    },
    general: {
      something_went_wrong_try_again: 'Something went wrong, please try again. If this happens again, please write me at tom@cryptup.org to fix it. ',
      write_me_to_fix_it: 'Please write me at tom@cryptup.org to fix this if it happens repeatedly. ',
    }
  };


  if(typeof window === 'object') {
    window.lang = _self;
  }

  if(typeof exports === 'object') {
    exports.account = _self.account;
    exports.pgp_block = _self.pgp_block;
    exports.compose = _self.compose;
  }

})();