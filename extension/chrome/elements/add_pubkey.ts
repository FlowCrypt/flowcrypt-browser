/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch } from '../../js/common/platform/catch.js';
import { Store } from '../../js/common/platform/store.js';
import { Ui } from '../../js/common/browser/ui.js';
import { BrowserMsg } from '../../js/common/browser/browser-msg.js';
import { Assert } from '../../js/common/assert.js';
import { KeyImportUi, UserAlert, } from '../../js/common/ui/key_import_ui.js';
import { AttUI } from '../../js/common/ui/att_ui.js';
import { Xss } from '../../js/common/platform/xss.js';
import { FetchKeyUI } from '../../js/common/ui/fetch_key_ui.js';
import { Url } from '../../js/common/core/common.js';
import { View } from '../../js/common/view.js';
import { PgpKey } from '../../js/common/core/pgp-key.js';

View.run(class AddPubkeyView extends View {
  private readonly acctEmail: string;
  private readonly parentTabId: string;
  private readonly missingPubkeyEmails: string[];
  private readonly fetchKeyUi = new FetchKeyUI();
  private readonly attUI = new AttUI(() => Promise.resolve({ size_mb: 5, size: 5 * 1024 * 1024, count: 1 }));

  constructor() {
    super();
    const uncheckedUrlParams = Url.parse(['acctEmail', 'parentTabId', 'emails']);
    this.acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
    this.parentTabId = Assert.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');
    this.missingPubkeyEmails = Assert.urlParamRequire.string(uncheckedUrlParams, 'emails').split(',');
  }

  public render = async () => {
    Ui.event.protect();
    for (const missingPubkeyEmail of this.missingPubkeyEmails) {
      Xss.sanitizeAppend('select.email', `<option value="${Xss.escape(missingPubkeyEmail)}">${Xss.escape(missingPubkeyEmail)}</option>`);
    }
    for (const contact of await Store.dbContactSearch(undefined, { has_pgp: true })) {
      Xss.sanitizeAppend('select.copy_from_email', `<option value="${Xss.escape(contact.email)}">${Xss.escape(contact.email)}</option>`);
    }
    this.fetchKeyUi.handleOnPaste($('.pubkey'));
    $('.action_settings').click(this.setHandler(() => BrowserMsg.send.bg.settings({ path: 'index.htm', page: '/chrome/settings/modules/contacts.htm', acctEmail: this.acctEmail })));
  }

  public setHandlers = () => {
    this.attUI.initAttDialog('fineuploader', 'fineuploader_button', {
      attAdded: async (file) => {
        this.attUI.clearAllAtts();
        const { keys, errs } = await PgpKey.readMany(file.getData());
        if (keys.length) {
          if (errs.length) {
            await Ui.modal.warning(`some keys could not be processed due to errors:\n${errs.map(e => `-> ${e.message}\n`).join('')}`);
          }
          $('.pubkey').val(String(keys[0].armor()));
          $('.action_ok').trigger('click');
        } else if (errs.length) {
          await Ui.modal.error(`error processing public keys:\n${errs.map(e => `-> ${e.message}\n`).join('')}`);
        }
      }
    });
    $('select.copy_from_email').change(this.setHandler((el) => this.copyFromEmailHandler(el)));
    $('.action_ok').click(this.setHandler(() => this.submitHandler()));
    $('.action_close').click(this.setHandler(() => this.closeDialog()));
  }

  private closeDialog = () => {
    BrowserMsg.send.closeDialog(this.parentTabId);
  }

  private copyFromEmailHandler = async (fromSelect: HTMLElement) => {
    if ($(fromSelect).val()) {
      const [contact] = await Store.dbContactGet(undefined, [String($(fromSelect).val())]);
      if (contact?.pubkey) {
        $('.pubkey').val(contact.pubkey).prop('disabled', true);
      } else {
        Catch.report('Contact unexpectedly not found when copying pubkey by email in add_pubkey.htm');
        await Ui.modal.error('Contact not found.');
      }
    } else {
      $('.pubkey').val('').prop('disabled', false);
    }
  }

  private submitHandler = async () => {
    try {
      const keyImportUi = new KeyImportUi({ checkEncryption: true });
      const normalized = await keyImportUi.checkPub(String($('.pubkey').val()));
      await Store.dbContactSave(undefined, await Store.dbContactObj({
        email: String($('select.email').val()), client: 'pgp', pubkey: normalized,
        lastUse: Date.now(), expiresOn: await PgpKey.dateBeforeExpiration(normalized)
      }));
      this.closeDialog();
    } catch (e) {
      if (e instanceof UserAlert) {
        await Ui.modal.warning(e.message);
      } else {
        Catch.reportErr(e);
        await Ui.modal.error(`Error happened when processing the public key: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }
});
