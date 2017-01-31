/* Business Source License 1.0 © 2016 Tom James Holub (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/tomholub/cryptup-chrome/tree/master/src/LICENCE */

'use strict';

var url_params = get_url_params(['filter']);

get_account_emails(function (account_emails) {
  $('.emails').append('<a href="storage.htm">all</a>');
  $('.emails').append('<a href="storage.htm?filter=global">global</a>');
  $('.namespace').append('<option value="global">global</option>');
  $.each(account_emails, function (i, account_email) {
    $('.emails').append('<a href="storage.htm?filter=' + encodeURIComponent(account_email) + '">' + account_email + '</a>');
    $('.namespace').append('<option value="' + encodeURIComponent(account_email) + '">' + account_email + '</option>');
  });
});

function render(obj) {
  $('.pre').html(tool.str.pretty_print(obj));
}

chrome.storage.local.get(function (storage) {
  if(url_params.filter) {
    var real_filter = account_storage_key(url_params.filter, '');
  } else {
    var real_filter = '';
  }
  var filtered = {};
  $.each(storage, function (key, value) {
    if(key.indexOf(real_filter) !== -1) {
      filtered['<b>' + key.replace(real_filter, '') + '</b>'] = value;
    }
  });
  render(filtered);
});

$('.save').click(function () {
  try {
    if($('.namespace').val() === '-- namespace --' || $('.type').val() === '-- type --' || !$('.key').val()) {
      alert('Namespace, key and type need to be filled');
    } else {
      var storage_update = {}
      storage_update[$('.key').val()] = JSON.parse($('.value').val());
      if($('.namespace').val() === 'global') {
        var account_email = null;
      } else {
        var account_email = decodeURIComponent($('.namespace').val());
      }
      account_storage_set(account_email, storage_update, function () {
        window.location.reload();
      });
    }
  } catch(e) {
    $('.error').text(e.name + ':' + e.message);
  }
});
