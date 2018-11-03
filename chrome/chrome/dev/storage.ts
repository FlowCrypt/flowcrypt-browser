/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store, Storable, BaseStore } from '../../js/common/storage.js';
import { Catch, Env, Value, Str, Dict } from '../../js/common/common.js';
import { Xss, Ui } from '../../js/common/browser.js';

Catch.try(async () => {

  type RenderableStorage = Dict<{key: string, value: Storable}>;

  let url_params = Env.url_params(['filter', 'keys', 'controls', 'title']);

  // this is for debugging
  let controls = url_params.controls === true && (Value.is('mjkiaimhi').in(window.location.href) || Value.is('filter').in(['info@nvimp.com', 'human@flowcrypt.com', 'flowcrypt.compatibility@gmail.com']));

  if (url_params.title) {
    Xss.sanitize_prepend('#content', `<h1>${Xss.html_escape(String(url_params.title))}</h1>`);
  }

  if (controls) {
    let account_emails = await Store.account_emails_get();
    let emails_selector = $('.emails');
    Xss.sanitize_append(emails_selector, `<a href="${Xss.html_escape(Env.url_create('storage.htm', {controls: url_params.controls || ''}))}">all</a>`);
    Xss.sanitize_append(emails_selector, `<a href="${Xss.html_escape(Env.url_create('storage.htm', {filter: 'global', controls: url_params.controls || ''}))}">global</a>`);
    Xss.sanitize_append('.namespace', '<option value="global">global</option>');
    for (let account_email of account_emails) {
      Xss.sanitize_append('.emails', `<a href="${Xss.html_escape(Env.url_create('storage.htm', { filter: account_email, controls: url_params.controls || ''}))}">${Xss.html_escape(account_email)}</a>`);
      Xss.sanitize_append('.namespace', `<option value="${Xss.html_escape(account_email)}">${Xss.html_escape(account_email)}</option>`);
    }
  }

  const render = (obj: RenderableStorage) => {
    for (let filtered_key of Object.keys(obj)) {
      let del = controls ? ' <span class="bad delete" key="' + obj[filtered_key].key + '" style="cursor: pointer;">[X]</span>' : '';
      Xss.sanitize_append('.pre', `<div><b>${filtered_key + del}</b> ${Str.pretty_print(obj[filtered_key].value)}</div>`);
    }
    $('.delete').click(Ui.event.handle(self => {
      chrome.storage.local.remove($(self).attr('key')!, () => window.location.reload()); // we set the attr key above
    }));
  };

  chrome.storage.local.get(storage => {
    let real_filter: string;
    if (url_params.filter) {
      real_filter = Store.index(url_params.filter as string, url_params.keys as string || '') as string;
    } else {
      real_filter = '';
    }
    let filtered: RenderableStorage = {};
    for (let key of Object.keys(storage)) {
      if (Value.is(real_filter).in(key)) {
        filtered[key.replace(real_filter, '')] = {key, value: storage[key]};
      }
    }
    if (!Object.keys(filtered).length) {
      filtered = {result: {key: 'result', value: 'nothing found'}};
    }
    render(filtered);
  });

  if (controls) {
    $('#controls, #filters').css('display', 'block');
    $('.save').click(Ui.event.handle(async () => {
      try {
        let namespace_selector = $('.namespace');
        let key_selector = $('.key');
        if (namespace_selector.val() === '-- namespace --' || $('.type').val() === '-- type --' || !key_selector.val()) {
          alert('Namespace, key and type need to be filled');
        } else {
          let storage_update: BaseStore = {};
          storage_update[key_selector.val() as string] = JSON.parse($('.value').val() as string); // it's a text input
          let account_email = namespace_selector.val() === 'global' ? null : decodeURIComponent(namespace_selector.val() as string); // it's a text input
          await Store.set(account_email, storage_update);
          window.location.reload();
        }
      } catch (e) {
        $('.error').text(e.name + ':' + e.message);
      }
    }));
  }

})();
