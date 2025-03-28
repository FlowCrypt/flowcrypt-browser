/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { KeyImportUi, UserAlert } from '../../js/common/ui/key-import-ui.js';

import { Assert } from '../../js/common/assert.js';
import { AttachmentUI } from '../../js/common/ui/attachment-ui.js';
import { Browser } from '../../js/common/browser/browser.js';
import { BrowserMsg } from '../../js/common/browser/browser-msg.js';
import { Catch } from '../../js/common/platform/catch.js';
import { FetchKeyUI } from '../../js/common/ui/fetch-key-ui.js';
import { Ui } from '../../js/common/browser/ui.js';
import { Url } from '../../js/common/core/common.js';
import { View } from '../../js/common/view.js';
import { Xss } from '../../js/common/platform/xss.js';
import { ContactStore } from '../../js/common/platform/store/contact-store.js';
import { KeyUtil } from '../../js/common/core/crypto/key.js';

View.run(
  class AddPubkeyView extends View {
    public readonly parentTabId: string;
    private readonly acctEmail: string;
    private readonly missingPubkeyEmails: string[];
    private readonly fetchKeyUi = new FetchKeyUI();
    private readonly attachmentUI = new AttachmentUI(() =>
      // eslint-disable-next-line @typescript-eslint/naming-convention
      Promise.resolve({ size_mb: 5, size: 5 * 1024 * 1024, count: 1 })
    );

    public constructor() {
      super();
      const uncheckedUrlParams = Url.parse(['acctEmail', 'parentTabId', 'emails']);
      this.acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
      this.parentTabId = Assert.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');
      this.missingPubkeyEmails = Assert.urlParamRequire.string(uncheckedUrlParams, 'emails').split(',');
    }

    public render = async () => {
      Ui.event.protect();
      for (const missingPubkeyEmail of this.missingPubkeyEmails) {
        const escapedMissingPubkeyEmail = Xss.escape(missingPubkeyEmail);
        Xss.sanitizeAppend('select.email', `<option value="${escapedMissingPubkeyEmail}">${escapedMissingPubkeyEmail}</option>`);
      }
      const uniqueEmails = new Set<string>();
      for (const contact of await ContactStore.search(undefined, { hasPgp: true })) {
        uniqueEmails.add(contact.email);
      }
      for (const email of Array.from(uniqueEmails).sort()) {
        const escapedEmail = Xss.escape(email);
        Xss.sanitizeAppend('select.copy_from_email', `<option value="${escapedEmail}">${escapedEmail}</option>`);
      }
      this.fetchKeyUi.handleOnPaste($('.pubkey'));
      $('.action_settings').on(
        'click',
        this.setHandler(async () => {
          await Browser.openSettingsPage('index.htm', this.acctEmail, '/chrome/settings/modules/contacts.htm');
        })
      );
    };

    public setHandlers = () => {
      this.attachmentUI.initAttachmentDialog('fineuploader', 'fineuploader_button', {
        attachmentAdded: async file => {
          this.attachmentUI.clearAllAttachments();
          const { keys, errs } = await KeyUtil.readMany(file.getData());
          if (keys.length) {
            if (errs.length) {
              await Ui.modal.warning(`some keys could not be processed due to errors:\n${errs.map(e => `-> ${e.message}\n`).join('')}`);
            }
            $('.copy_from_email').val('');
            $('.pubkey').val(String(KeyUtil.armor(keys[0])));
            $('.action_ok').trigger('click');
          } else if (errs.length) {
            await Ui.modal.error(`error processing public keys:\n${errs.map(e => `-> ${e.message}\n`).join('')}`);
          }
        },
      });
      $('select.copy_from_email').on(
        'change',
        this.setHandler(el => this.copyFromEmailHandler(el))
      );
      $('.action_ok').on(
        'click',
        this.setHandler(() => this.submitHandler())
      );
      $('.action_close').on(
        'click',
        this.setHandler(() => {
          this.closeDialog();
        })
      );
    };

    private closeDialog = () => {
      BrowserMsg.send.closeDialog(this);
    };

    private copyFromEmailHandler = async (fromSelect: HTMLElement) => {
      if ($(fromSelect).val()) {
        const pubkeys = (await ContactStore.getEncryptionKeys(undefined, [String($(fromSelect).val())]))[0].keys;
        if (pubkeys.length > 0) {
          $('.pubkey').val('').prop('disabled', true).prop('style', 'display: none;');
          $('#manual-import-warning').prop('style', 'display: none;');
        } else {
          Catch.report('Contact unexpectedly not found when copying pubkey by email in add_pubkey.htm');
          await Ui.modal.error('Contact not found.');
        }
      } else {
        $('.pubkey').val('').prop('disabled', false).prop('style', 'display: inline;');
        $('#manual-import-warning').prop('style', 'display: inline;');
      }
    };

    private submitHandler = async () => {
      try {
        const email = String($('select.email').val());
        if ($('.copy_from_email').val()) {
          const fromEmail = String($('.copy_from_email').val());
          const keys = await ContactStore.getEncryptionKeys(undefined, [fromEmail]);
          for (const keyArray of keys) {
            for (const key of keyArray.keys) {
              await ContactStore.update(undefined, email, { pubkey: key });
            }
          }
        } else {
          const keyImportUi = new KeyImportUi({ checkEncryption: true });
          const normalized = await keyImportUi.checkPub(String($('.pubkey').val()));
          await ContactStore.update(undefined, email, { pubkey: normalized });
        }
        this.closeDialog();
      } catch (e) {
        if (e instanceof UserAlert) {
          await Ui.modal.warning(e.message);
        } else {
          Catch.reportErr(e);
          await Ui.modal.error(`Error happened when processing the public key: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    };
  }
);
