/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store, Serializable } from '../../../js/common/store.js';
import { Catch, Env, Value, Str, Dict } from '../../../js/common/common.js';
import { Att } from '../../../js/common/att.js';
import { Xss, Ui, AttUI } from '../../../js/common/browser.js';
import { BrowserMsg } from '../../../js/common/extension.js';

import { Settings } from '../../../js/common/settings.js';
import { Api, R } from '../../../js/common/api.js';

Catch.try(async () => {

  let url_params = Env.urlParams(['account_email', 'parent_tab_id']);
  let account_email = Env.url_param_require.string(url_params, 'account_email');
  let parent_tab_id = Env.url_param_require.string(url_params, 'parent_tab_id');

  let attach_js = new AttUI(() => ({ size_mb: 5, size: 5 * 1024 * 1024, count: 1 }));
  let new_photo_file: Att;

  const S = Ui.build_jquery_selectors({
    'status': '.status',
    'subscribe': '.action_subscribe',
    'hide_if_active': '.hide_if_active',
    'show_if_active': '.show_if_active',
    'input_email': '.input_email',
    'input_name': '.input_name',
    'input_intro': '.input_intro',
    'input_alias': '.input_alias',
    'action_enable': '.action_enable',
    'action_update': '.action_update',
    'action_close': '.action_close',
    'management_account': '.management_account',
    'photo': '.profile_photo img',
  });

  let render_fields = (result: R.FcAccountUpdate$result) => {
    if (result.alias) {
      let me = Api.fc.url('me', result.alias);
      let me_escaped = Xss.htmlEscape(me);
      let me_escaped_display = Xss.htmlEscape(me.replace('https://', ''));
      Xss.sanitizeRender(S.cached('status'), `Your contact page is currently <b class="good">enabled</b> at <a href="${me_escaped}" target="_blank">${me_escaped_display}</a></span>`);
      S.cached('hide_if_active').css('display', 'none');
      S.cached('show_if_active').css('display', 'inline-block');
      S.cached('input_email').val(result.email);
      S.cached('input_intro').val(result.intro);
      S.cached('input_alias').val(result.alias);
      S.cached('input_name').val(result.name);
      if (result.photo) {
        S.cached('photo').attr('src', result.photo);
      }
      attach_js.initialize_attach_dialog('fineuploader', 'select_photo');
      attach_js.set_att_added_callback((file: Att) => {
        new_photo_file = file;
        Xss.sanitizeReplace('#select_photo', Ui.e('span', {text: file.name}));
      });
    } else {
      S.cached('management_account').text(result.email).parent().removeClass('display_none');
      Xss.sanitizeRender(S.cached('status'), 'Your contact page is currently <b class="bad">disabled</b>. <a href="#" class="action_enable">Enable contact page</a>');
      S.now('action_enable').click(Ui.event.prevent('double', enable_contact_page));
    }
  };

  let enable_contact_page = async () => {
    Xss.sanitizeRender(S.cached('status'), 'Enabling..' + Ui.spinner('green'));
    let auth_info = await Store.authInfo();
    let storage = await Store.getAccount(auth_info.account_email!, ['full_name']);
    try {
      let alias = await find_available_alias(auth_info.account_email!);
      let initial = {alias, name: storage.full_name || Str.capitalize(auth_info.account_email!.split('@')[0]), intro: 'Use this contact page to send me encrypted messages and files.'};
      let response = await Api.fc.accountUpdate(initial);
      if (!response.updated) {
        alert('Failed to enable your Contact Page. Please try again');
      }
      window.location.reload();
    } catch (e) {
      Catch.handle_exception(e);
      alert('Failed to create account, possibly a network issue. Please try again.\n\n' + e.message);
      window.location.reload();
    }
  };

  S.cached('action_update').click(Ui.event.prevent('double', async () => {
    if (!S.cached('input_name').val()) {
      alert('Please add your name');
    } else if (!S.cached('input_intro').val()) {
      alert('Please add intro text');
    } else {
      S.cached('show_if_active').css('display', 'none');
      Xss.sanitizeRender(S.cached('status'), 'Updating ' + Ui.spinner('green'));
      let update: Dict<Serializable> = {name: S.cached('input_name').val(), intro: S.cached('input_intro').val()};
      if (new_photo_file) {
        update.photo_content = btoa(new_photo_file.asText());
      }
      await Api.fc.accountUpdate(update);
      window.location.reload();
    }
  }));

  S.cached('action_close').click(Ui.event.handle(() => BrowserMsg.send(parent_tab_id, 'close_page')));

  let find_available_alias = async (email: string): Promise<string> => {
    let alias = email.split('@')[0].replace(/[^a-z0-9]/g, '');
    while(alias.length < 3) {
      alias += Str.random(1).toLowerCase();
    }
    let i = 0;
    while(true) {
      alias += (i || '');
      let response = await Api.fc.linkMe(alias);
      if (!response.profile) {
        return alias;
      }
      i += Value.int.random(1, 9);
    }
  };

  Xss.sanitizeRender(S.cached('status'), 'Loading..' + Ui.spinner('green'));
  try {
    let response = await Api.fc.accountUpdate();
    render_fields(response.result);
  } catch (e) {
    if (Api.err.isAuthErr(e)) {
      Xss.sanitizeRender(S.cached('status'), 'Your email needs to be verified to set up a contact page. You can verify it by enabling a free trial. You do NOT need to pay or maintain the trial later. Your Contact Page will stay active even on Forever Free account. <a href="#" class="action_subscribe">Get trial</a>');
      S.now('subscribe').click(Ui.event.handle(() => Settings.redirect_sub_page(account_email, parent_tab_id, '/chrome/elements/subscribe.htm', '&source=auth_error')));
    } else {
      S.cached('status').text('Failed to load your Contact Page settings. Please try to reload this page. Let me know at human@flowcrypt.com if this persists.');
    }
  }

})();
