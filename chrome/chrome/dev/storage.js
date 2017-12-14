/* Business Source License 1.0 © 2016-2017 FlowCrypt Limited. Use limitations apply. Contact human@flowcrypt.com */

'use strict';

var url_params = tool.env.url_params(['filter', 'keys', 'controls', 'title']);

// this is for debugging
var controls = url_params.controls === true && (tool.value('mjkiaimhi').in(window.location.href) || tool.value('filter').in(['info@nvimp.com', 'human@flowcrypt.com', 'flowcrypt.compatibility@gmail.com']));

if(url_params.title) {
  $('#content').prepend('<h1>' + url_params.title + '</h1>');
}

if(controls) {
  window.flowcrypt_storage.account_emails_get(function (account_emails) {
    $('.emails').append('<a href="' + tool.env.url_create('storage.htm', {controls: url_params.controls || ''}) + '">all</a>');
    $('.emails').append('<a href="' + tool.env.url_create('storage.htm', {filter: 'global', controls: url_params.controls || ''}) + '">global</a>');
    $('.namespace').append('<option value="global">global</option>');
    tool.each(account_emails, function (i, account_email) {
      $('.emails').append('<a href="' + tool.env.url_create('storage.htm', { filter: account_email, controls: url_params.controls || ''}) + '">' + account_email + '</a>');
      $('.namespace').append('<option value="' + encodeURIComponent(account_email) + '">' + account_email + '</option>');
    });
  });
}

function render(obj) {
  tool.each(obj, function(filtered_key, data) {
    var del = controls ? ' <span class="bad delete" key="' + data.key + '" style="cursor: pointer;">[X]</span>' : '';
    $('.pre').append('<div><b>' + filtered_key + del + '</b> ' + tool.str.pretty_print(data.value) + '</div>');
  });
  $('.delete').click(function() {
    chrome.storage.local.remove($(this).attr('key'), function () {
      window.location.reload();
    });
  });
}

chrome.storage.local.get(storage => {
  if(url_params.filter) {
    var real_filter = window.flowcrypt_storage.key(url_params.filter, url_params.keys || '');
  } else {
    var real_filter = '';
  }
  var filtered = {};
  tool.each(storage, function (key, value) {
    if(tool.value(real_filter).in(key)) {
      filtered[key.replace(real_filter, '')] = {key: key, value: value};
    }
  });
  render(Object.keys(filtered).length ? filtered : {'result': {key: 'result', value: 'nothing found'}});
});

if(controls) {
  $('#controls, #filters').css('display', 'block');
  $('.save').click(function () {
    try {
      if($('.namespace').val() === '-- namespace --' || $('.type').val() === '-- type --' || !$('.key').val()) {
        alert('Namespace, key and type need to be filled');
      } else {
        var storage_update = {};
        storage_update[$('.key').val()] = JSON.parse($('.value').val());
        var account_email = $('.namespace').val() === 'global' ? null : decodeURIComponent($('.namespace').val());
        window.flowcrypt_storage.set(account_email, storage_update, function () {
          window.location.reload();
        });
      }
    } catch(e) {
      $('.error').text(e.name + ':' + e.message);
    }
  });
}
