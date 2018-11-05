/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store, Storable, BaseStore } from '../../js/common/store.js';
import { Value, Str, Dict } from '../../js/common/common.js';
import { Xss, Ui, Env } from '../../js/common/browser.js';
import { Catch } from '../../js/common/catch.js';

Catch.try(async () => {

  type RenderableStorage = Dict<{ key: string, value: Storable }>;

  const urlParams = Env.urlParams(['filter', 'keys', 'controls', 'title']);

  // this is for debugging
  const debugEmails = ['info@nvimp.com', 'human@flowcrypt.com', 'flowcrypt.compatibility@gmail.com'];
  const controls = urlParams.controls === true && (Value.is('mjkiaimhi').in(window.location.href) || Value.is('filter').in(debugEmails));

  if (urlParams.title) {
    Xss.sanitizePrepend('#content', `<h1>${Xss.escape(String(urlParams.title))}</h1>`);
  }

  if (controls) {
    const acctEmails = await Store.acctEmailsGet();
    const emailsSel = $('.emails');
    Xss.sanitizeAppend(emailsSel, `<a href="${Xss.escape(Env.urlCreate('storage.htm', { controls: urlParams.controls || '' }))}">all</a>`);
    Xss.sanitizeAppend(emailsSel, `<a href="${Xss.escape(Env.urlCreate('storage.htm', { filter: 'global', controls: urlParams.controls || '' }))}">global</a>`);
    Xss.sanitizeAppend('.namespace', '<option value="global">global</option>');
    for (const acctEmail of acctEmails) {
      Xss.sanitizeAppend('.emails', `<a href="${Xss.escape(Env.urlCreate('storage.htm', { filter: acctEmail, controls: urlParams.controls || '' }))}">${Xss.escape(acctEmail)}</a>`);
      Xss.sanitizeAppend('.namespace', `<option value="${Xss.escape(acctEmail)}">${Xss.escape(acctEmail)}</option>`);
    }
  }

  const render = (obj: RenderableStorage) => {
    for (const filteredKey of Object.keys(obj)) {
      const del = controls ? ' <span class="bad delete" key="' + obj[filteredKey].key + '" style="cursor: pointer;">[X]</span>' : '';
      Xss.sanitizeAppend('.pre', `<div><b>${filteredKey + del}</b> ${Str.prettyPrint(obj[filteredKey].value)}</div>`);
    }
    $('.delete').click(Ui.event.handle(self => {
      chrome.storage.local.remove($(self).attr('key')!, () => window.location.reload()); // we set the attr key above
    }));
  };

  chrome.storage.local.get(storage => {
    let realFilter: string;
    if (urlParams.filter) {
      realFilter = Store.index(urlParams.filter as string, urlParams.keys as string || '') as string;
    } else {
      realFilter = '';
    }
    let filtered: RenderableStorage = {};
    for (const key of Object.keys(storage)) {
      if (Value.is(realFilter).in(key)) {
        filtered[key.replace(realFilter, '')] = { key, value: storage[key] };
      }
    }
    if (!Object.keys(filtered).length) {
      filtered = { result: { key: 'result', value: 'nothing found' } };
    }
    render(filtered);
  });

  if (controls) {
    $('#controls, #filters').css('display', 'block');
    $('.save').click(Ui.event.handle(async () => {
      try {
        const namespaceSel = $('.namespace');
        const keySel = $('.key');
        if (namespaceSel.val() === '-- namespace --' || $('.type').val() === '-- type --' || !keySel.val()) {
          alert('Namespace, key and type need to be filled');
        } else {
          const storageUpdate: BaseStore = {};
          storageUpdate[keySel.val() as string] = JSON.parse($('.value').val() as string); // it's a text input
          const acctEmail = namespaceSel.val() === 'global' ? null : decodeURIComponent(namespaceSel.val() as string); // it's a text input
          await Store.set(acctEmail, storageUpdate);
          window.location.reload();
        }
      } catch (e) {
        $('.error').text(e.name + ':' + e.message);
      }
    }));
  }

})();
