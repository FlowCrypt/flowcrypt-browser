/* Business Source License 1.0 © 2016 FlowCrypt Limited (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/CryptUp/cryptup-browser/tree/master/src/LICENCE */

'use strict';

var url_params = tool.env.url_params(['account_email', 'parent_tab_id']);

var S = tool.ui.build_jquery_selectors({
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
});

S.cached('status').html('Loading..' + tool.ui.spinner('green'));

tool.api.cryptup.account_update({}, function(success, result) {
  if(success === tool.api.cryptup.auth_error) {
    S.cached('status').html('Your email needs to be verified to set up a contact page. You can verify it by enabling a free trial. You do NOT need to pay or maintain the trial later. Your Contact Page will stay active even on Forever Free account. <a href="#" class="action_subscribe">Get trial</a>');
    S.now('subscribe').click(function () {
      show_settings_page('/chrome/elements/subscribe.htm', '&source=auth_error');
    });
  } else if (success && result && result.result) {
    render_fields(result.result);
  } else {
    S.cached('status').text('Failed to load your Contact Page settings. Please try to reload this page. Let me know at tom@cryptup.org if this persists.');
  }
});

function render_fields(result) {
  if(result.alias) {
    var me = tool.api.cryptup.url('me', result.alias);
    S.cached('status').html('Your contact page is currently <b class="good">enabled</b> at <a href="' + me + '" target="_blank">' + me.replace('https://', '') + '</a></span>');
    S.cached('hide_if_active').css('display', 'none');
    S.cached('show_if_active').css('display', 'inline-block');
    S.cached('input_email').val(result.email);
    S.cached('input_intro').val(result.intro);
    S.cached('input_alias').val(result.alias);
    S.cached('input_name').val(result.name);
  } else {
    S.cached('management_account').text(result.email).parent().removeClass('display_none');
    S.cached('status').html('Your contact page is currently <b class="bad">disabled</b>. <a href="#" class="action_enable">Enable contact page</a>');
    S.now('action_enable').click(tool.ui.event.prevent(tool.ui.event.double(), function (self) {
      S.cached('status').html('Enabling..' + tool.ui.spinner('green'));
      storage_cryptup_auth_info(function(email) {
        account_storage_get(email, ['full_name'], function(storage) {
          find_available_alias(email, function(alias) {
            var initial = {alias: alias, name: storage.full_name || tool.str.capitalize(email.split('@')[0]), intro: 'Use this contact page to send me encrypted messages and files.'};
            tool.api.cryptup.account_update(initial, function (s, r) {
              if(s && r && r.updated && r.result && r.result.alias && r.result.token) {
                window.location.reload();
              } else {
                alert('Failed to enable your Contact Page. Please try again.\n\n' + (s && r && r.error && r.error.message ? r.error.message : 'Network error'));
                window.location.reload();
              }
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
    tool.api.cryptup.account_update({name: S.cached('input_name').val(), intro: S.cached('input_intro').val()}, function () {
      window.location.reload();
    });
  }
}));

S.cached('action_close').click(function () {
  tool.browser.message.send(url_params.parent_tab_id, 'close_page');
});

function find_available_alias(email, callback, i) {
  var alias = email.split('@')[0].replace(/[^a-z0-9]/g, '');
  while(alias.length < 3) {
    alias += tool.str.random(1).toLowerCase();
  }
  tool.api.cryptup.link_me(alias + (i || ''), function(success, result) {
    if(success && result) {
      if(!result.profile) {
        callback(alias);
      } else {
        find_available_alias(callback, (i || 0) + tool.int.random(1, 9));
      }
    } else {
      alert('Failed to create account, possibly a network issue. Please try again.');
      window.location.reload();
    }
  });
}