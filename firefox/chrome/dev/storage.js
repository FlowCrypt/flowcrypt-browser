/* Business Source License 1.0 © 2016 Tom James Holub (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/tomholub/cryptup-chrome/tree/master/src/LICENCE */

'use strict';

var url_params = tool.env.url_params(['filter', 'keys', 'controls', 'title']);

// this is for debugging
var controls = url_params.controls === true && (tool.value('blfdgihadmeigiiebaghlhhobipconfm').in(window.location.href) || tool.value('filter').in(['info@nvimp.com', 'mindoutofframe@gmail.com', 'tom@cryptup.org']));

if(url_params.title) {
  $('#content').prepend('<h1>' + url_params.title + '</h1>');
}

if(controls) {
  get_account_emails(function (account_emails) {
    $('.emails').append('<a href="' + tool.env.url_create('storage.htm', {controls: url_params.controls || ''}) + '">all</a>');
    $('.emails').append('<a href="' + tool.env.url_create('storage.htm', {filter: 'global', controls: url_params.controls || ''}) + '">global</a>');
    $('.namespace').append('<option value="global">global</option>');
    $.each(account_emails, function (i, account_email) {
      $('.emails').append('<a href="' + tool.env.url_create('storage.htm', { filter: account_email, controls: url_params.controls || ''}) + '">' + account_email + '</a>');
      $('.namespace').append('<option value="' + encodeURIComponent(account_email) + '">' + account_email + '</option>');
    });
  });
}

function render(obj) {
  $.each(obj, function(filtered_key, data) {
    var del = controls ? ' <span class="bad delete" key="' + data.key + '" style="cursor: pointer;">[X]</span>' : '';
    $('.pre').append('<div><b>' + filtered_key + del + '</b> ' + tool.str.pretty_print(data.value) + '</div>');
  });
  $('.delete').click(function() {
    chrome.storage.local.remove($(this).attr('key'), function () {
      window.location.reload();
    });
  });
}

chrome.storage.local.get(function (storage) {
  if(url_params.filter) {
    var real_filter = account_storage_key(url_params.filter, url_params.keys || '');
  } else {
    var real_filter = '';
  }
  var filtered = {};
  $.each(storage, function (key, value) {
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
        account_storage_set(account_email, storage_update, function () {
          window.location.reload();
        });
      }
    } catch(e) {
      $('.error').text(e.name + ':' + e.message);
    }
  });
}
