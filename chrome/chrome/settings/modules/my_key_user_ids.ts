/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

tool.catch.try(() => {

  let url_params = tool.env.url_params(['account_email', 'longid']);

  $('.action_show_public_key').attr('href', tool.env.url_create('my_key.htm', url_params));

  Store.keys_get(url_params.account_email as string, [url_params.longid as string || 'primary']).then(([keyinfo]) => {

    if(keyinfo === null) {
      return $('body').text('Key not found. Is FlowCrypt well set up? Contact us at human@flowcrypt.com for help.');
    }

    let key = openpgp.key.readArmored(keyinfo.private).keys[0];

    let user_ids = key.users.map((u: any) => u.userId.userid); // todo - create a common function in settings.js for here and setup.js user_ids
    $('.user_ids').html(user_ids.map((uid: string) => '<div>' + tool.str.html_escape(uid) + '</div>').join(''));

    $('.email').text(url_params.account_email as string);
    $('.key_words').text(keyinfo.keywords);

  });

})();