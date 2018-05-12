/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

tool.catch.try(() => {

  type RenderableStorage = Dict<{key: string, value: Serializable}>;

  var url_params = tool.env.url_params(['filter', 'keys', 'controls', 'title']);
  
  // this is for debugging
  var controls = url_params.controls === true && (tool.value('mjkiaimhi').in(window.location.href) || tool.value('filter').in(['info@nvimp.com', 'human@flowcrypt.com', 'flowcrypt.compatibility@gmail.com']));
  
  if(url_params.title) {
    $('#content').prepend('<h1>' + url_params.title + '</h1>');
  }
  
  if(controls) {
    Store.account_emails_get(function (account_emails) {
      $('.emails').append('<a href="' + tool.env.url_create('storage.htm', {controls: url_params.controls || ''}) + '">all</a>');
      $('.emails').append('<a href="' + tool.env.url_create('storage.htm', {filter: 'global', controls: url_params.controls || ''}) + '">global</a>');
      $('.namespace').append('<option value="global">global</option>');
      tool.each(account_emails, function (i, account_email) {
        $('.emails').append('<a href="' + tool.env.url_create('storage.htm', { filter: account_email, controls: url_params.controls || ''}) + '">' + account_email + '</a>');
        $('.namespace').append('<option value="' + encodeURIComponent(account_email) + '">' + account_email + '</option>');
      });
    });
  }
  
  function render(obj: RenderableStorage) {
    tool.each(obj, function(filtered_key, data) {
      var del = controls ? ' <span class="bad delete" key="' + data.key + '" style="cursor: pointer;">[X]</span>' : '';
      $('.pre').append('<div><b>' + filtered_key + del + '</b> ' + tool.str.pretty_print(data.value) + '</div>');
    });
    $('.delete').click(function() {9
      chrome.storage.local.remove($(this).attr('key')!, function () { // we set the attr key above
        window.location.reload();
      });
    });
  }
  
  chrome.storage.local.get(storage => {
    let real_filter: string;
    if(url_params.filter) {
      real_filter = Store.key(url_params.filter as string, url_params.keys as string || '') as string;
    } else {
      real_filter = '';
    }
    let filtered: RenderableStorage = {};
    tool.each(storage, function (key: string, value: Serializable) {
      if(tool.value(real_filter).in(key)) {
        filtered[key.replace(real_filter, '')] = {key: key, value: value};
      }
    });
    if(!Object.keys(filtered).length) {
      filtered = {'result': {key: 'result', value: 'nothing found'}};
    }
    render(filtered);
  });
  
  if(controls) {
    $('#controls, #filters').css('display', 'block');
    $('.save').click(function () {
      try {
        if($('.namespace').val() === '-- namespace --' || $('.type').val() === '-- type --' || !$('.key').val()) {
          alert('Namespace, key and type need to be filled');
        } else {
          var storage_update: Dict<Serializable> = {};
          storage_update[$('.key').val() as string] = JSON.parse($('.value').val() as string); // it's a text input
          var account_email = $('.namespace').val() === 'global' ? null : decodeURIComponent($('.namespace').val() as string); // it's a text input
          Store.set(account_email, storage_update, function () {
            window.location.reload();
          });
        }
      } catch(e) {
        $('.error').text(e.name + ':' + e.message);
      }
    });
  }  

})();
