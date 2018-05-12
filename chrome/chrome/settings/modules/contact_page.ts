/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

tool.catch.try(() => {

  let url_params = tool.env.url_params(['account_email', 'parent_tab_id']);
  let attach_js = (window as FlowCryptWindow).flowcrypt_attach.init(function () { return { size_mb: 5, size: 5 * 1024 * 1024, count: 1 }; });
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
  
  tool.api.cryptup.account_update().then(response => render_fields(response.result), error => {
    if(error.internal === 'auth') {
      S.cached('status').html('Your email needs to be verified to set up a contact page. You can verify it by enabling a free trial. You do NOT need to pay or maintain the trial later. Your Contact Page will stay active even on Forever Free account. <a href="#" class="action_subscribe">Get trial</a>');
      S.now('subscribe').click(function () {
        show_settings_page('/chrome/elements/subscribe.htm', '&source=auth_error');
      });
    } else {
      S.cached('status').text('Failed to load your Contact Page settings. Please try to reload this page. Let me know at human@flowcrypt.com if this persists.');
    }
  });
  
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
      S.now('action_enable').click(tool.ui.event.prevent(tool.ui.event.double(), function (self) {
        S.cached('status').html('Enabling..' + tool.ui.spinner('green'));
        (window as FlowCryptWindow).flowcrypt_storage.auth_info(function(email: string) {  // @ts-doublecheck - is it really always a string?
          (window as FlowCryptWindow).flowcrypt_storage.get(email, ['full_name'], (storage: {full_name: string|null}) => {
            find_available_alias(email, function(alias) {
              let initial = {alias: alias, name: storage.full_name || tool.str.capitalize(email.split('@')[0]), intro: 'Use this contact page to send me encrypted messages and files.'};
              // @ts-ignore
              tool.api.cryptup.account_update(initial).validate(r => r.updated).then(response => window.location.reload(), error => {
                alert('Failed to enable your Contact Page. Please try again.\n\n' + error.message);
                window.location.reload();
              });
            });
          });
        });
      }));
    }
  }
  
  S.cached('action_update').click(tool.ui.event.prevent(tool.ui.event.double(), function() {
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
      // @ts-ignore
      tool.api.cryptup.account_update(update).done(() => window.location.reload());
    }
  }));
  
  S.cached('action_close').click(function () {
    tool.browser.message.send(url_params.parent_tab_id as string, 'close_page');
  });
  
  function find_available_alias(email: string, callback: (alias: string) => void, _internal_i=0) {
    let alias = email.split('@')[0].replace(/[^a-z0-9]/g, '');
    while(alias.length < 3) {
      alias += tool.str.random(1).toLowerCase();
    }
    alias += (_internal_i || '');
    tool.api.cryptup.link_me(alias).then(response => {
      if(!response.profile) {
        callback(alias);
      } else {
        find_available_alias(email, callback, _internal_i + tool.int.random(1, 9));
      }
    }, error => {
      alert('Failed to create account, possibly a network issue. Please try again.');
      window.location.reload();
    });
  }

})();