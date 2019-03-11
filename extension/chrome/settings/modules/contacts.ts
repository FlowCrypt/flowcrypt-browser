/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { VERSION } from '../../../js/common/core/const.js';
import { Catch } from '../../../js/common/platform/catch.js';
import { Store } from '../../../js/common/platform/store.js';
import { Att } from '../../../js/common/core/att.js';
import { Xss, Ui, XssSafeFactory, Env, Browser } from '../../../js/common/browser.js';
import { BrowserMsg } from '../../../js/common/extension.js';
import { Pgp } from '../../../js/common/core/pgp.js';
import { requireOpenpgp } from '../../../js/common/platform/require.js';
import { Buf } from '../../../js/common/core/buf.js';

const openpgp = requireOpenpgp();

if (typeof openpgp !== 'undefined') { // in certain environments, eg browser content scripts, openpgp is not included (not all functions below need it)
  openpgp.config.versionstring = `FlowCrypt ${VERSION} Gmail Encryption`;
  openpgp.config.commentstring = 'Seamlessly send and receive encrypted email';
  // openpgp.config.require_uid_self_cert = false;
}

Catch.try(async () => {

  const uncheckedUrlParams = Env.urlParams(['acctEmail', 'parentTabId']);
  const acctEmail = Env.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');

  const tabId = await BrowserMsg.requiredTabId();

  const factory = new XssSafeFactory(acctEmail, tabId, undefined, undefined, { compact: true });
  const backBtn = '<a href="#" id="page_back_button" data-test="action-back-to-contact-list">back</a>';
  const space = '&nbsp;&nbsp;&nbsp;&nbsp;';

  BrowserMsg.listen(tabId); // set_css

  const renderContactList = async () => {
    const contacts = await Store.dbContactSearch(undefined, { has_pgp: true });

    const exportAllHtml = '&nbsp;&nbsp;<a href="#" class="action_export_all">export all</a>&nbsp;&nbsp;';
    Xss.sanitizeRender('.line.actions', exportAllHtml).find('.action_export_all').click(Ui.event.prevent('double', (self) => {
      const allArmoredPublicKeys = contacts.map(c => (c.pubkey || '').trim()).join('\n');
      const exportFile = new Att({ name: 'public-keys-export.asc', type: 'application/pgp-keys', data: Buf.fromUtfStr(allArmoredPublicKeys) });
      Browser.saveToDownloads(exportFile, Catch.browser().name === 'firefox' ? $('.line.actions') : undefined);
    }));

    const importPublicKeysHtml = '&nbsp;&nbsp;<a href="#" class="action_view_bulk_import">import public keys</a>&nbsp;&nbsp;';
    Xss.sanitizeAppend('.line.actions', importPublicKeysHtml).find('.action_view_bulk_import').off().click(Ui.event.prevent('double', (self) => {
      $('.hide_when_rendering_subpage').css('display', 'none');
      Xss.sanitizeRender('h1', `${backBtn}${space}Bulk Public Key Import${space}`);
      $('#bulk_import').css('display', 'block');
      $('#bulk_import .input_pubkey').val('').css('display', 'inline-block');
      $('#bulk_import .action_process').css('display', 'inline-block');
      $('#bulk_import #processed').text('').css('display', 'none');
      $('#file_import .action_upload_keyfile').css('display', 'inline-block');
      $('#page_back_button').click(Ui.event.handle(() => renderContactList()));
    }));

    $('table#emails').text('');
    $('div.hide_when_rendering_subpage').css('display', 'block');
    $('table.hide_when_rendering_subpage').css('display', 'table');
    $('h1').text('Contacts and their Public Keys');
    $('#view_contact, #edit_contact, #bulk_import').css('display', 'none');

    let tableContents = '';
    for (const c of contacts) {
      const e = Xss.escape(c.email);
      const show = `<a href="#" class="action_show" data-test="action-show-pubkey"></a>`;
      const change = `<a href="#" class="action_change" data-test="action-change-pubkey"></a>`;
      const remove = `<a href="#" class="action_remove" data-test="action-remove-pubkey"></a>`;
      tableContents += `<tr email="${e}"><td>${e}</td><td>${show}</td><td>${change}</td><td>${remove}</td></tr>`;
    }
    Xss.sanitizeReplace('table#emails', `<table id="emails" class="hide_when_rendering_subpage">${tableContents}</table>`);

    $('a.action_show').off().click(Ui.event.prevent('double', async (self) => {
      const [contact] = await Store.dbContactGet(undefined, [$(self).closest('tr').attr('email')!]); // defined above
      $('.hide_when_rendering_subpage').css('display', 'none');
      Xss.sanitizeRender('h1', `${backBtn}${space}${contact!.email}`); // should exist - from list of contacts
      if (contact!.client === 'cryptup') {
        Xss.sanitizeAppend('h1', '&nbsp;&nbsp;&nbsp;&nbsp;<img src="/img/logo/flowcrypt-logo-19-19.png" />');
      } else {
        Xss.sanitizeAppend('h1', '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;');
      }
      $('#view_contact .key_dump').text(contact!.pubkey!); // should exist - from list of contacts && should have pgp - filtered
      $('#view_contact .key_fingerprint').text(contact!.fingerprint!); // should exist - from list of contacts && should have pgp - filtered
      $('#view_contact .key_words').text(contact!.keywords!); // should exist - from list of contacts && should have pgp - filtered
      $('#view_contact').css('display', 'block');
      $('#page_back_button').click(Ui.event.handle(() => renderContactList()));
    }));

    $('a.action_change').off().click(Ui.event.prevent('double', self => {
      $('.hide_when_rendering_subpage').css('display', 'none');
      const email = $(self).closest('tr').attr('email')!;
      Xss.sanitizeRender('h1', `${backBtn}${space}${Xss.escape(email)}${space}(edit)`);
      $('#edit_contact').css('display', 'block');
      $('#edit_contact .input_pubkey').val('').attr('email', email);
      $('#page_back_button').click(Ui.event.handle(() => renderContactList()));
    }));

    $('#edit_contact .action_save_edited_pubkey').off().click(Ui.event.prevent('double', async (self) => {
      const armoredPubkey = String($('#edit_contact .input_pubkey').val());
      const email = $('#edit_contact .input_pubkey').attr('email');
      if (!armoredPubkey || !email) {
        await Ui.modal.warning('No public key entered');
      } else if (await Pgp.key.fingerprint(armoredPubkey)) {
        await Store.dbContactSave(undefined, await Store.dbContactObj(email, undefined, 'pgp', armoredPubkey, undefined, false, Date.now()));
        await renderContactList();
      } else {
        await Ui.modal.warning('Cannot recognize a valid public key, please try again. Let us know at human@flowcrypt.com if you need help.');
        $('#edit_contact .input_pubkey').val('').focus();
      }
    }));

    $('.action_view_bulk_import').off().click(Ui.event.prevent('double', self => {
      $('.hide_when_rendering_subpage').css('display', 'none');
      Xss.sanitizeRender('h1', `${backBtn}${space}Bulk Public Key Import${space}`);
      $('#bulk_import').css('display', 'block');
      $('#bulk_import .input_pubkey').val('').css('display', 'inline-block');
      $('#bulk_import .action_process').css('display', 'inline-block');
      $('#bulk_import #processed').text('').css('display', 'none');
      $('#file_import .action_upload_keyfile').css('display', 'inline-block');
      $('#page_back_button').click(Ui.event.handle(() => renderContactList()));
    }));

    $('#bulk_import .action_process').off().click(Ui.event.prevent('double', async target => {
      const replacedHtmlSafe = Ui.replaceRenderableMsgBlocks(factory, String($('#bulk_import .input_pubkey').val()));
      if (!replacedHtmlSafe || replacedHtmlSafe === $('#bulk_import .input_pubkey').val()) {
        await Ui.modal.warning('Could not find any new public keys');
      } else {
        $('#bulk_import #processed').html(replacedHtmlSafe).css('display', 'block'); // xss-safe-factory
        $('#bulk_import .input_pubkey, #bulk_import .action_process, #file_import .action_upload_keyfile').css('display', 'none');
      }
    }));

    $('#file_import div.action_open_keyfile').click(Ui.event.prevent('double', async (self) => {
      $('#file_import  #keyfile_input').trigger('click');
    }));

    $('#file_import #keyfile_input').change(Ui.event.handle(async (self, event: JQuery.Event<HTMLInputElement, null>) => {
      if (event !== null && typeof event !== 'undefined') {
        if (event.target.files !== null && typeof event.target.files !== 'undefined' && event.target.files.length > 0) {
          try {
            const fileReader = new FileReader();
            fileReader.onload = async () => {
              const binaryKey = new Uint8Array(fileReader.result as ArrayBuffer);
              const key = await openpgp.key.read(binaryKey);
              console.log(key);
              // $('#bulk_import .input_pubkey').val(key.armor());
            };
            fileReader.readAsArrayBuffer(event.target.files[0]);
          } catch (err) {
            Catch.handleErr(err);
          }
        }
      }
    }));

    $('a.action_remove').off().click(Ui.event.prevent('double', async (self) => {
      await Store.dbContactSave(undefined, await Store.dbContactObj($(self).closest('tr').attr('email')!, undefined, undefined, undefined, undefined, false, undefined));
      await renderContactList();
    }));

  };

  await renderContactList();

})();
