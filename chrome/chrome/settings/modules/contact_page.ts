/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

tool.catch.try(async () => {

  let url_params = tool.env.url_params(['account_email', 'parent_tab_id']);
  let attach_js = new Attach(() => ({ size_mb: 5, size: 5 * 1024 * 1024, count: 1 }));
  let new_photo_file: Attachment;
  
  const S = tool.ui.build_jquery_selectors({
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
  
  S.cached('status').html('Loading..' + tool.ui.spinner('green'));
  
  try {
    let response = await tool.api.cryptup.account_update();
    render_fields(response.result)
  } catch(e) {
    if(e.internal === 'auth') {
      S.cached('status').html('Your email needs to be verified to set up a contact page. You can verify it by enabling a free trial. You do NOT need to pay or maintain the trial later. Your Contact Page will stay active even on Forever Free account. <a href="#" class="action_subscribe">Get trial</a>');
      S.now('subscribe').click(function () {
        Settings.redirect_sub_page(url_params.account_email as string, url_params.parent_tab_id as string, '/chrome/elements/subscribe.htm', '&source=auth_error');
      });
    } else {
      S.cached('status').text('Failed to load your Contact Page settings. Please try to reload this page. Let me know at human@flowcrypt.com if this persists.');
    }    
  }
  
  function render_fields(result: ApirFcAccountUpdate$result) {
    if(result.alias) {
      let me = tool.api.cryptup.url('me', result.alias);
      S.cached('status').html('Your contact page is currently <b class="good">enabled</b> at <a href="' + me + '" target="_blank">' + me.replace('https://', '') + '</a></span>');
      S.cached('hide_if_active').css('display', 'none');
      S.cached('show_if_active').css('display', 'inline-block');
      S.cached('input_email').val(result.email);
      S.cached('input_intro').val(result.intro);
      S.cached('input_alias').val(result.alias);
      S.cached('input_name').val(result.name);
      if(result.photo) {
        S.cached('photo').attr('src', result.photo);
      }
      attach_js.initialize_attach_dialog('fineuploader', 'select_photo');
      attach_js.set_attachment_added_callback((file: Attachment) => {
        new_photo_file = file;
        $('#select_photo').replaceWith(tool.e('span', {text: file.name}));
      });
    } else {
      S.cached('management_account').text(result.email).parent().removeClass('display_none');
      S.cached('status').html('Your contact page is currently <b class="bad">disabled</b>. <a href="#" class="action_enable">Enable contact page</a>');
      S.now('action_enable').click(tool.ui.event.prevent(tool.ui.event.double(), enable_contact_page));
    }
  }
  
  async function enable_contact_page () {
    S.cached('status').html('Enabling..' + tool.ui.spinner('green'));
    let auth_info = await Store.auth_info();
    let storage = await Store.get_account(auth_info.account_email!, ['full_name']);
    try {
      let alias = await find_available_alias(auth_info.account_email!)
      let initial = {alias: alias, name: storage.full_name || tool.str.capitalize(auth_info.account_email!.split('@')[0]), intro: 'Use this contact page to send me encrypted messages and files.'};
      let response = await tool.api.cryptup.account_update(initial);
      if(!response.updated) {
        alert('Failed to enable your Contact Page. Please try again');
      }
      window.location.reload();
    } catch(e) {
      tool.catch.handle_exception(e);
      alert('Failed to create account, possibly a network issue. Please try again.\n\n' + e.message);
      window.location.reload();
    }
  }

  S.cached('action_update').click(tool.ui.event.prevent(tool.ui.event.double(), async () => {
    if(!S.cached('input_name').val()) {
      alert('Please add your name');
    } else if (!S.cached('input_intro').val()) {
      alert('Please add intro text');
    } else {
      S.cached('show_if_active').css('display', 'none');
      S.cached('status').html('Updating' + tool.ui.spinner('green'));
      let update: Dict<Serializable> = {name: S.cached('input_name').val(), intro: S.cached('input_intro').val()};
      if(new_photo_file) {
        update.photo_content = btoa(tool.str.from_uint8(new_photo_file.content as Uint8Array));
      }
      await tool.api.cryptup.account_update(update);
      window.location.reload();
    }
  }));
  
  S.cached('action_close').click(function () {
    tool.browser.message.send(url_params.parent_tab_id as string, 'close_page');
  });
  
  async function find_available_alias(email: string): Promise<string> {
    let alias = email.split('@')[0].replace(/[^a-z0-9]/g, '');
    while(alias.length < 3) {
      alias += tool.str.random(1).toLowerCase();
    }
    let i = 0;
    while(true) {
      alias += (i || '');
      let response = await tool.api.cryptup.link_me(alias);
      if(!response.profile) {
        return alias;
      }
      i += tool.int.random(1, 9);
    }
  }

})();