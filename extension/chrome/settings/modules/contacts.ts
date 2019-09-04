/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch } from '../../../js/common/platform/catch.js';
import { Store } from '../../../js/common/platform/store.js';
import { Att } from '../../../js/common/core/att.js';
import { Ui, Browser, Env } from '../../../js/common/browser.js';
import { BrowserMsg } from '../../../js/common/extension.js';
import { Pgp } from '../../../js/common/core/pgp.js';
import { Buf } from '../../../js/common/core/buf.js';
import { AttUI } from '../../../js/common/ui/att_ui.js';
import { KeyImportUi } from '../../../js/common/ui/key_import_ui.js';
import { XssSafeFactory } from '../../../js/common/xss_safe_factory.js';
import { Assert } from '../../../js/common/assert.js';
import { Api } from '../../../js/common/api/api.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { Rules } from '../../../js/common/rules.js';
import { Keyserver } from '../../../js/common/api/keyserver.js';
import { Str } from '../../../js/common/core/common.js';

Catch.try(async () => {
  const uncheckedUrlParams = Env.urlParams(['acctEmail', 'parentTabId']);

  const acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
  const tabId = await BrowserMsg.requiredTabId();

  const factory = new XssSafeFactory(acctEmail, tabId, undefined, undefined, { compact: true });
  const rules = await Rules.newInstance(acctEmail);

  const backBtn = '<a href="#" id="page_back_button" data-test="action-back-to-contact-list">back</a>';
  const space = '&nbsp;&nbsp;&nbsp;&nbsp;';

  BrowserMsg.listen(tabId); // set_css

  const attUI = new AttUI(() => Promise.resolve({ sizeMb: 5, size: 5 * 1024 * 1024, count: 1 }));
  attUI.initAttDialog('fineuploader', 'fineuploader_button');
  attUI.setAttAddedCb(async (file) => {
    attUI.clearAllAtts();
    const { keys, errs } = await Pgp.key.readMany(file.getData());
    if (keys.length) {
      if (errs.length) {
        await Ui.modal.warning(`some keys could not be processed due to errors:\n${errs.map(e => `-> ${e.message}\n`).join('')}`);
      }
      $('#bulk_import .input_pubkey').val(keys.map(key => key.armor()).join('\n\n'));
      $('#bulk_import .action_process').trigger('click');
      $('#file_import').hide();
    } else if (errs.length) {
      await Ui.modal.error(`error processing public keys:\n${errs.map(e => `-> ${e.message}\n`).join('')}`);
    }
  });

  const renderViewPublicKey = async (viewPubkeyButton: HTMLElement) => {
    const [contact] = await Store.dbContactGet(undefined, [$(viewPubkeyButton).closest('tr').attr('email')!]); // defined above
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
  };

  const renderChangePublicKey = (changePubkeyButton: HTMLElement) => {
    $('.hide_when_rendering_subpage').css('display', 'none');
    const email = $(changePubkeyButton).closest('tr').attr('email')!;
    Xss.sanitizeRender('h1', `${backBtn}${space}${Xss.escape(email)}${space}(edit)`);
    $('#edit_contact').css('display', 'block');
    $('#edit_contact .input_pubkey').val('').attr('email', email);
    $('#page_back_button').click(Ui.event.handle(() => renderContactList()));
  };

  const actionSaveEditedPublicKey = async () => {
    const armoredPubkey = String($('#edit_contact .input_pubkey').val());
    const email = $('#edit_contact .input_pubkey').attr('email');
    if (!armoredPubkey || !email) {
      await Ui.modal.warning('No public key entered');
    } else if (await Pgp.key.fingerprint(armoredPubkey)) {
      await Store.dbContactSave(undefined, await Store.dbContactObj({
        email, client: 'pgp', pubkey: armoredPubkey, lastUse: Date.now(), expiresOn: await Pgp.key.dateBeforeExpiration(armoredPubkey)
      }));
      await renderContactList();
    } else {
      await Ui.modal.warning('Cannot recognize a valid public key, please try again. Let us know at human@flowcrypt.com if you need help.');
      $('#edit_contact .input_pubkey').val('').focus();
    }
  };

  const actionRemovePublicKey = async (rmPubkeyButton: HTMLElement) => {
    await Store.dbContactSave(undefined, await Store.dbContactObj({ email: $(rmPubkeyButton).closest('tr').attr('email')! }));
    await renderContactList();
  };

  const renderBulkImportPage = () => {
    $('.hide_when_rendering_subpage').css('display', 'none');
    Xss.sanitizeRender('h1', `${backBtn}${space}Bulk Public Key Import${space}`);
    $('#bulk_import').css('display', 'block');
    $('#bulk_import .input_pubkey').val('').css('display', 'inline-block');
    $('#bulk_import .action_process').css('display', 'inline-block');
    $('#bulk_import #processed').text('').css('display', 'none');
    $('#file_import').show();
    $('#file_import #fineuploader_button').css('display', 'inline-block');
    $('#page_back_button').click(Ui.event.handle(() => renderContactList()));
  };

  const actionProcessBulkImportTextInput = async () => {
    try {
      const value = Str.normalize(String($('#bulk_import .input_pubkey').val())).trim();
      const normalizedLongid = KeyImportUi.normalizeLongId(value);
      let key: string;
      if (normalizedLongid) {
        const data = await Keyserver.lookupLongid(acctEmail, normalizedLongid);
        if (data.pubkey) {
          key = data.pubkey;
        } else {
          await Ui.modal.warning('Could not find any Public Key in our public records that matches this fingerprint or longid');
          return;
        }
      } else {
        key = value;
      }
      if (Pgp.key.isPossiblePublic(key)) {
        const replacedHtmlSafe = XssSafeFactory.replaceRenderableMsgBlocks(factory, key);
        if (replacedHtmlSafe && replacedHtmlSafe !== value) {
          $('#bulk_import #processed').html(replacedHtmlSafe).css('display', 'block'); // xss-safe-factory
          $('#bulk_import .input_pubkey, #bulk_import .action_process, #file_import #fineuploader_button').css('display', 'none');
        } else {
          await Ui.modal.warning('Could not find any new public keys');
        }
      } else if (Pgp.key.isPossiblePrivate(key)) {
        await Ui.modal.warning('Found Private Key.\nTo import Private Keys, see Additional Settings -> My Keys.');
      } else {
        await Ui.modal.warning('Incorrect Public Key. Please check and try again.');
      }
    } catch (e) {
      if (Api.err.isSignificant(e)) {
        Catch.reportErr(e);
      }
      await Ui.modal.error(`There was an error trying to find this public key.\n\n${Api.err.eli5(e)}`);
    }
  };

  const renderContactList = async () => {
    const contacts = await Store.dbContactSearch(undefined, { has_pgp: true });
    let lineActionsHtml = '&nbsp;&nbsp;<a href="#" class="action_export_all">export all</a>&nbsp;&nbsp;' +
      '&nbsp;&nbsp;<a href="#" class="action_view_bulk_import">import public keys</a>&nbsp;&nbsp;';
    if (rules.canUseCustomKeyserver() && rules.getCustomKeyserver()) {
      lineActionsHtml += `&nbsp;&nbsp;<br><br><b class="bad">using custom keyserver: ${Xss.escape(rules.getCustomKeyserver()!)}</b>`;
    } else {
      lineActionsHtml += '&nbsp;&nbsp;<a href="https://flowcrypt.com/docs/technical/keyserver-integration.html" target="_blank">use custom keyserver</a>&nbsp;&nbsp;';
    }
    const actionsLine = Xss.sanitizeRender('.line.actions', lineActionsHtml);
    actionsLine.find('.action_export_all').click(Ui.event.prevent('double', (self) => {
      const allArmoredPublicKeys = contacts.map(c => (c.pubkey || '').trim()).join('\n');
      const exportFile = new Att({ name: 'public-keys-export.asc', type: 'application/pgp-keys', data: Buf.fromUtfStr(allArmoredPublicKeys) });
      Browser.saveToDownloads(exportFile, Catch.browser().name === 'firefox' ? $('.line.actions') : undefined);
    }));
    actionsLine.find('.action_view_bulk_import').off().click(Ui.event.prevent('double', renderBulkImportPage));
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
    $('a.action_show').off().click(Ui.event.prevent('double', renderViewPublicKey));
    $('a.action_change').off().click(Ui.event.prevent('double', renderChangePublicKey));
    $('#edit_contact .action_save_edited_pubkey').off().click(Ui.event.prevent('double', actionSaveEditedPublicKey));
    $('#bulk_import .action_process').off().click(Ui.event.prevent('double', actionProcessBulkImportTextInput));
    $('a.action_remove').off().click(Ui.event.prevent('double', actionRemovePublicKey));
  };

  await renderContactList();

})();
