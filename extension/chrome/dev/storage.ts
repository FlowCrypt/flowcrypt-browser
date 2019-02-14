/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch } from '../../js/common/platform/catch.js';
import { Store, Storable, AccountStore, GlobalStore, GlobalIndex, AccountIndex, RawStore } from '../../js/common/platform/store.js';
import { Value, Str, Dict } from '../../js/common/core/common.js';
import { Xss, Ui, Env } from '../../js/common/browser.js';

Catch.try(async () => {

  type RenderableStorage = Dict<{ key: string, value: Storable }>;

  const DEBUG_EMAILS = ['info@nvimp.com', 'human@flowcrypt.com', 'flowcrypt.compatibility@gmail.com'];

  const uncheckedUrlParams = Env.urlParams(['filter', 'keys', 'controls', 'title']);
  const filter = Env.urlParamRequire.optionalString(uncheckedUrlParams, 'filter');
  const keys = Env.urlParamRequire.optionalString(uncheckedUrlParams, 'keys');
  const title = Env.urlParamRequire.optionalString(uncheckedUrlParams, 'title');
  const controls = uncheckedUrlParams.controls === true && (Value.is(':dev').in(Catch.environment()) || Value.is(filter).in(DEBUG_EMAILS));

  if (title) {
    Xss.sanitizePrepend('#content', `<h1>${Xss.escape(title)}</h1>`);
  }

  if (controls) {
    const acctEmails = await Store.acctEmailsGet();
    const emailsSel = $('.emails');
    Xss.sanitizeAppend(emailsSel, `<a href="${Xss.escape(Env.urlCreate('storage.htm', { controls }))}">all</a>`);
    Xss.sanitizeAppend(emailsSel, `<a href="${Xss.escape(Env.urlCreate('storage.htm', { filter: 'global', controls }))}">global</a>`);
    Xss.sanitizeAppend('.namespace', '<option value="global">global</option>');
    for (const acctEmail of acctEmails) {
      Xss.sanitizeAppend('.emails', `<a href="${Xss.escape(Env.urlCreate('storage.htm', { filter: acctEmail, controls }))}">${Xss.escape(acctEmail)}</a>`);
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

  chrome.storage.local.get((storage: RawStore) => {
    let realFilter: string;
    if (filter) {
      realFilter = Store.singleScopeRawIndex(filter, keys || '');
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
        const keySelVal = String($('.key').val());
        if (namespaceSel.val() === '-- namespace --' || $('.type').val() === '-- type --' || !keySelVal) {
          await Ui.modal.info('Namespace, key and type need to be filled');
        } else {
          const acctEmail = namespaceSel.val() === 'global' ? undefined : decodeURIComponent(String(namespaceSel.val())); // it's a text input
          const newValue: Storable = JSON.parse(String($('.value').val())) as Storable; // tslint:disable:no-unsafe-any
          if (!acctEmail) {
            const globalStoreUpdate: GlobalStore = {};
            globalStoreUpdate[keySelVal as GlobalIndex] = newValue as any;
            await Store.setGlobal(globalStoreUpdate);
          } else {
            const accountStoreUpdate: AccountStore = {};
            accountStoreUpdate[keySelVal as AccountIndex] = newValue as any;
            await Store.setAcct(acctEmail, accountStoreUpdate);
          }
          window.location.reload();
        }
      } catch (e) {
        $('.error').text(e.name + ':' + e.message);
      }
    }));
  }

})();
