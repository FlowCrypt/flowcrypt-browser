/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store, Storable, BaseStore } from '../../js/common/store.js';
import { Catch, Env, Value, Str, Dict } from '../../js/common/common.js';
import { Xss, Ui } from '../../js/common/browser.js';

Catch.try(async () => {

  type RenderableStorage = Dict<{key: string, value: Storable}>;

  let urlParams = Env.urlParams(['filter', 'keys', 'controls', 'title']);

  // this is for debugging
  let controls = urlParams.controls === true && (Value.is('mjkiaimhi').in(window.location.href) || Value.is('filter').in(['info@nvimp.com', 'human@flowcrypt.com', 'flowcrypt.compatibility@gmail.com']));

  if (urlParams.title) {
    Xss.sanitizePrepend('#content', `<h1>${Xss.htmlEscape(String(urlParams.title))}</h1>`);
  }

  if (controls) {
    let acctEmails = await Store.acctEmailsGet();
    let emailsSel = $('.emails');
    Xss.sanitizeAppend(emailsSel, `<a href="${Xss.htmlEscape(Env.urlCreate('storage.htm', {controls: urlParams.controls || ''}))}">all</a>`);
    Xss.sanitizeAppend(emailsSel, `<a href="${Xss.htmlEscape(Env.urlCreate('storage.htm', {filter: 'global', controls: urlParams.controls || ''}))}">global</a>`);
    Xss.sanitizeAppend('.namespace', '<option value="global">global</option>');
    for (let acctEmail of acctEmails) {
      Xss.sanitizeAppend('.emails', `<a href="${Xss.htmlEscape(Env.urlCreate('storage.htm', { filter: acctEmail, controls: urlParams.controls || ''}))}">${Xss.htmlEscape(acctEmail)}</a>`);
      Xss.sanitizeAppend('.namespace', `<option value="${Xss.htmlEscape(acctEmail)}">${Xss.htmlEscape(acctEmail)}</option>`);
    }
  }

  const render = (obj: RenderableStorage) => {
    for (let filteredKey of Object.keys(obj)) {
      let del = controls ? ' <span class="bad delete" key="' + obj[filteredKey].key + '" style="cursor: pointer;">[X]</span>' : '';
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
    for (let key of Object.keys(storage)) {
      if (Value.is(realFilter).in(key)) {
        filtered[key.replace(realFilter, '')] = {key, value: storage[key]};
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
        let namespaceSel = $('.namespace');
        let keySel = $('.key');
        if (namespaceSel.val() === '-- namespace --' || $('.type').val() === '-- type --' || !keySel.val()) {
          alert('Namespace, key and type need to be filled');
        } else {
          let storageUpdate: BaseStore = {};
          storageUpdate[keySel.val() as string] = JSON.parse($('.value').val() as string); // it's a text input
          let acctEmail = namespaceSel.val() === 'global' ? null : decodeURIComponent(namespaceSel.val() as string); // it's a text input
          await Store.set(acctEmail, storageUpdate);
          window.location.reload();
        }
      } catch (e) {
        $('.error').text(e.name + ':' + e.message);
      }
    }));
  }

})();
