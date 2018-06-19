/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

tool.catch.try(async () => {

  type RenderableStorage = Dict<{key: string, value: Storable}>;

  let url_params = tool.env.url_params(['filter', 'keys', 'controls', 'title']);
  
  // this is for debugging
  let controls = url_params.controls === true && (tool.value('mjkiaimhi').in(window.location.href) || tool.value('filter').in(['info@nvimp.com', 'human@flowcrypt.com', 'flowcrypt.compatibility@gmail.com']));
  
  if(url_params.title) {
    $('#content').prepend('<h1>' + url_params.title + '</h1>');
  }
  
  if(controls) {
    let account_emails = await Store.account_emails_get();
    let emails_selector = $('.emails');
    emails_selector.append('<a href="' + tool.env.url_create('storage.htm', {controls: url_params.controls || ''}) + '">all</a>');
    emails_selector.append('<a href="' + tool.env.url_create('storage.htm', {filter: 'global', controls: url_params.controls || ''}) + '">global</a>');
    $('.namespace').append('<option value="global">global</option>');
    for(let account_email of account_emails) {
      $('.emails').append('<a href="' + tool.env.url_create('storage.htm', { filter: account_email, controls: url_params.controls || ''}) + '">' + account_email + '</a>');
      $('.namespace').append('<option value="' + encodeURIComponent(account_email) + '">' + account_email + '</option>');
    }
  }
  
  function render(obj: RenderableStorage) {
    for(let filtered_key of Object.keys(obj)) {
      let del = controls ? ' <span class="bad delete" key="' + obj[filtered_key].key + '" style="cursor: pointer;">[X]</span>' : '';
      $('.pre').append('<div><b>' + filtered_key + del + '</b> ' + tool.str.pretty_print(obj[filtered_key].value) + '</div>');
    }
    $('.delete').click(function() {
      chrome.storage.local.remove($(this).attr('key')!, function () { // we set the attr key above
        window.location.reload();
      });
    });
  }
  
  chrome.storage.local.get(storage => {
    let real_filter: string;
    if(url_params.filter) {
      real_filter = Store.index(url_params.filter as string, url_params.keys as string || '') as string;
    } else {
      real_filter = '';
    }
    let filtered: RenderableStorage = {};
    for(let key of Object.keys(storage)) {
      if(tool.value(real_filter).in(key)) {
        filtered[key.replace(real_filter, '')] = {key: key, value: storage[key]};
      }
    }
    if(!Object.keys(filtered).length) {
      filtered = {'result': {key: 'result', value: 'nothing found'}};
    }
    render(filtered);
  });
  
  if(controls) {
    $('#controls, #filters').css('display', 'block');
    $('.save').click(function () {
      try {
        let namespace_selector = $('.namespace');
        let key_selector = $('.key');
        if(namespace_selector.val() === '-- namespace --' || $('.type').val() === '-- type --' || !key_selector.val()) {
          alert('Namespace, key and type need to be filled');
        } else {
          let storage_update: BaseStore = {};
          storage_update[key_selector.val() as string] = JSON.parse($('.value').val() as string); // it's a text input
          let account_email = namespace_selector.val() === 'global' ? null : decodeURIComponent(namespace_selector.val() as string); // it's a text input
          Store.set(account_email, storage_update).then(() => window.location.reload());
        }
      } catch(e) {
        $('.error').text(e.name + ':' + e.message);
      }
    });
  }  

})();
