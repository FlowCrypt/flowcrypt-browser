/* Business Source License 1.0 © 2016-2017 FlowCrypt Limited. Use limitations apply. Contact human@flowcrypt.com */

'use strict';

let url_params = tool.env.url_params(['account_email', 'longid']);

$('.action_show_public_key').attr('href', tool.env.url_create('my_key.htm', url_params));

window.flowcrypt_storage.keys_get(url_params.account_email, url_params.longid || 'primary').then(keyinfo => {

  let key = openpgp.key.readArmored(keyinfo.private).keys[0];

  let user_ids = key.users.map(u => u.userId.userid); // todo - create a common function in settings.js for here and setup.js user_ids
  $('.user_ids').html(user_ids.map(uid => '<div>' + tool.str.html_escape(uid) + '</div>').join(''));

  $('.email').text(url_params.account_email);
  $('.key_words').text(keyinfo.keywords);

});