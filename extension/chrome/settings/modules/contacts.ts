/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { KeyFamily, KeyUtil } from '../../../js/common/core/crypto/key.js';
import { Str, Url } from '../../../js/common/core/common.js';
import { ApiErr } from '../../../js/common/api/shared/api-error.js';
import { Assert } from '../../../js/common/assert.js';
import { Attachment } from '../../../js/common/core/attachment.js';
import { AttachmentUI } from '../../../js/common/ui/attachment-ui.js';
import { Browser } from '../../../js/common/browser/browser.js';
import { BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { Buf } from '../../../js/common/core/buf.js';
import { FetchKeyUI } from '../../../js/common/ui/fetch-key-ui.js';
import { MsgBlockParser } from '../../../js/common/core/msg-block-parser.js';
import { ClientConfiguration } from '../../../js/common/client-configuration.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { View } from '../../../js/common/view.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { XssSafeFactory } from '../../../js/common/xss-safe-factory.js';
import { ContactStore } from '../../../js/common/platform/store/contact-store.js';
import { Lang } from '../../../js/common/lang.js';
import { AcctStore } from '../../../js/common/platform/store/acct-store.js';

View.run(
  class ContactsView extends View {
    protected fesUrl?: string;
    private acctEmail: string;

    private factory: XssSafeFactory | undefined; // set in render()
    private attachmentUI = new AttachmentUI(() => Promise.resolve({ sizeMb: 5, size: 5 * 1024 * 1024, count: 1 }));
    private clientConfiguration!: ClientConfiguration;
    private backBtn = '<a href="#" id="page_back_button" data-test="action-back-to-contact-list">Back</a>';
    private space = '&nbsp;&nbsp;&nbsp;&nbsp;';

    public constructor() {
      super();
      const uncheckedUrlParams = Url.parse(['acctEmail', 'parentTabId']);
      this.acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
    }

    public render = async () => {
      const tabId = BrowserMsg.generateTabId();
      BrowserMsg.listen(tabId); // set_css
      const storage = await AcctStore.get(this.acctEmail, ['fesUrl']);
      this.fesUrl = storage.fesUrl;
      this.factory = new XssSafeFactory(this.acctEmail, tabId, undefined, undefined, { compact: true });
      this.clientConfiguration = await ClientConfiguration.newInstance(this.acctEmail);
      this.attachmentUI.initAttachmentDialog('fineuploader', 'fineuploader_button', {
        attachmentAdded: this.fileAddedHandler,
      });
      const fetchKeyUI = new FetchKeyUI();
      fetchKeyUI.handleOnPaste($('.input_pubkey'));
      await this.loadAndRenderContactList();
    };

    public setHandlers = () => {
      $('.action_show_pubkey_list').off().on('click', this.setHandler(this.actionRenderListPublicKeyHandler));
      $('#edit_contact .action_save_edited_pubkey').off().on('click', this.setHandlerPrevent('double', this.actionSaveEditedPublicKeyHandler));
      $('#bulk_import .action_process').off().on('click', this.setHandlerPrevent('double', this.actionProcessBulkImportTextInput));
      $('.action_export_all').off().on('click', this.setHandlerPrevent('double', this.actionExportAllKeysHandler));
      $('.action_view_bulk_import').off().on('click', this.setHandlerPrevent('double', this.actionRenderBulkImportPageHandler));
      $('.input-search-contacts').off().on('keyup', this.setHandlerPrevent('double', this.loadAndRenderContactList));
    };

    // --- PRIVATE

    private loadAndRenderContactList = async () => {
      const contacts = await ContactStore.search(undefined, {
        hasPgp: true,
        limit: 500,
        substring: String($('.input-search-contacts').val()),
      });
      let lineActionsHtml =
        '&nbsp;&nbsp;<a href="#" class="action_export_all">Export all</a>&nbsp;&nbsp;' +
        '&nbsp;&nbsp;<a href="#" class="action_view_bulk_import" data-test="action-show-import-public-keys-form">Import public keys</a>&nbsp;&nbsp;';
      if (this.clientConfiguration.getCustomSksPubkeyServer()) {
        lineActionsHtml +=
          `&nbsp;&nbsp;<br><br><b class="bad" data-test="custom-key-server-description">` +
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          `using custom SKS pubkeyserver: ${Xss.escape(this.clientConfiguration.getCustomSksPubkeyServer()!)}</b>`;
      } else {
        lineActionsHtml +=
          '&nbsp;&nbsp;<a href="https://flowcrypt.com/docs/technical/enterprise/configuration/keyserver-integration.html" target="_blank">Use custom keyserver</a>&nbsp;&nbsp;';
      }
      Xss.sanitizeRender('.line.actions', lineActionsHtml);
      $('#emails').text('');
      $('.hide_when_rendering_subpage').css('display', 'block');
      $('h1').text('Contacts and their Public Keys');
      $('#view_contact, #edit_contact, #bulk_import').css('display', 'none');
      let tableContents = '';
      for (const email of contacts.map(preview => preview.email).filter((value, index, self) => !self.slice(0, index).find(el => el === value))) {
        const e = Xss.escape(email);
        tableContents += `
        <div email="${e}" class="action_show_pubkey_list" data-test="action-show-email-${e.replace(/[^a-z0-9]+/g, '')}">
          <img src="/img/svgs/chevron-left.svg" class="icon-chevron">
          ${e}
        </div>
      `;
      }
      Xss.sanitizeReplace('#emails', `<div id="emails" class="hide_when_rendering_subpage">${tableContents}</div>`);
      $('.container-table-note').text(contacts.length >= 500 ? '(showing first 500 results)' : '');
      this.setHandlers();
    };

    private fileAddedHandler = async (file: Attachment) => {
      this.attachmentUI.clearAllAttachments();
      const { keys, errs } = await KeyUtil.readMany(file.getData());
      if (keys.length) {
        if (errs.length) {
          await Ui.modal.warning(`some keys could not be processed due to errors:\n${errs.map(e => `-> ${e.message}\n`).join('')}`);
        }
        $('#bulk_import .input_pubkey').val(keys.map(key => KeyUtil.armor(key)).join('\n\n'));
        $('#bulk_import .action_process').trigger('click');
        $('#file_import').hide();
      } else if (errs.length) {
        await Ui.modal.error(`error processing public keys:\n${errs.map(e => `-> ${e.message}\n`).join('')}`);
      }
    };

    private actionExportAllKeysHandler = async () => {
      const allArmoredPublicKeys = (await ContactStore.searchPubkeys(undefined, { hasPgp: true })).map(a => a.trim()).join('\n');
      const exportFile = new Attachment({
        name: 'public-keys-export.asc',
        type: 'application/pgp-keys',
        data: Buf.fromUtfStr(allArmoredPublicKeys),
      });
      Browser.saveToDownloads(exportFile);
    };

    private actionRenderListPublicKeyHandler = async (emailRow: HTMLElement) => {
      if ($(emailRow).hasClass('opened')) {
        $(emailRow).removeClass('opened');
        $(emailRow).children('.contacts-pubkey').remove();
        return;
      }
      $(emailRow).addClass('opened');
      const email = $(emailRow).attr('email')!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
      const contact = await ContactStore.getOneWithAllPubkeys(undefined, email);
      const e = Xss.escape(email);
      if (contact?.sortedPubkeys.length) {
        let tableContents = '';
        for (const pubkey of contact.sortedPubkeys) {
          const keyid = Xss.escape(pubkey.pubkey.id);
          const type = Xss.escape(pubkey.pubkey.family);
          const change = `<a href="#" title="Change" class="action_change" data-test="action-change-pubkey-${keyid}-${type}"></a>`;
          const remove = `<a href="#" title="Remove" class="action_remove" data-test="action-remove-pubkey-${keyid}-${type}"></a>`;
          const show = `<a href="#" title="Show" class="action_show" data-test="action-show-pubkey-${keyid}-${type}">${Str.spaced(keyid)}</a>`;
          tableContents += `<div class="contacts-pubkey" email="${e}" keyid="${keyid}" type="${type}">
          <div class="contacts-pubkey-info">
            <span class="fc-badge fc-badge-gray" data-test="container-contact-key-type-${keyid}">${type}</span>&nbsp;
            ${KeyUtil.statusHtml(keyid, pubkey.pubkey)}
            ${show}
          </div>
          <div class="contacts-pubkey-actions">${change}${remove}</div></div>`;
        }
        $(emailRow).append(tableContents); // xss-safe-value
        $('.action_remove').off().on('click', this.setHandlerPrevent('double', this.actionRemovePublicKey));
        $('.action_show').off().on('click', this.setHandlerPrevent('double', this.actionRenderViewPublicKeyHandler));
        $('.action_change').off().on('click', this.setHandlerPrevent('double', this.actionRenderChangePublicKeyHandler));
      }
    };

    private actionRenderViewPublicKeyHandler = async (viewPubkeyButton: HTMLElement) => {
      const parentRow = $(viewPubkeyButton).closest('[email]');
      /* eslint-disable @typescript-eslint/no-non-null-assertion */
      const id = parentRow.attr('keyid')!;
      const family = parentRow.attr('type')! as KeyFamily;
      const email = parentRow.attr('email')!;
      /* eslint-enable @typescript-eslint/no-non-null-assertion */
      const armoredPubkey = await ContactStore.getPubkey(undefined, { id, family });
      if (!armoredPubkey) {
        // todo: show error message like 'key disappeared'?
        return;
      }
      const key = await KeyUtil.parse(armoredPubkey);
      $('.hide_when_rendering_subpage').css('display', 'none');
      Xss.sanitizeRender('h1', `${this.backBtn}${this.space}${email}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`);
      $('#view_contact .key_dump').text(armoredPubkey);
      $('#view_contact #container-pubkey-details').text(
        [
          `Type: ${key.family}`,
          `Fingerprint: ${Str.spaced(key.id || 'none')}`,
          `Users: ${key.emails?.join(', ')}`,
          `Created on: ${key.created ? new Date(key.created) : ''}`,
          `Expiration: ${key.expiration ? new Date(key.expiration) : 'Does not expire'}`,
          `Last signature: ${key.lastModified ? new Date(key.lastModified) : ''}`,
          `Expired: ${key.expiration && key.expiration < Date.now() ? 'yes' : 'no'}`,
          `Usable for encryption: ${key.usableForEncryption}`,
          `Usable for signing: ${key.usableForSigning}`,
        ].join('\n')
      );
      $('#view_contact').css('display', 'block');
      $('#page_back_button').on(
        'click',
        this.setHandler(() => this.loadAndRenderContactList())
      );
    };

    private actionRenderChangePublicKeyHandler = (changePubkeyButton: HTMLElement) => {
      $('.hide_when_rendering_subpage').css('display', 'none');
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const email = $(changePubkeyButton).closest('[email]').attr('email')!;
      Xss.sanitizeRender('h1', `${this.backBtn}${this.space}${Xss.escape(email)}${this.space}(edit)`);
      $('#edit_contact').css('display', 'block');
      $('#edit_contact .input_pubkey').val('').attr('email', email);
      $('#page_back_button').on(
        'click',
        this.setHandler(() => this.loadAndRenderContactList())
      );
    };

    private actionSaveEditedPublicKeyHandler = async () => {
      const armoredPubkey = String($('#edit_contact .input_pubkey').val());
      const email = $('#edit_contact .input_pubkey').attr('email');
      if (!armoredPubkey || !email) {
        await Ui.modal.warning('No public key entered');
      } else {
        try {
          // parse will throw if the key is not recognized
          const pubkey = await KeyUtil.parse(armoredPubkey);
          await ContactStore.update(undefined, email, { pubkey, lastUse: Date.now() });
          await this.loadAndRenderContactList();
        } catch {
          await Ui.modal.warning('Cannot recognize a valid public key, please try again. ' + Lang.general.contactIfNeedAssistance(!!this.fesUrl));
          $('#edit_contact .input_pubkey').val('').trigger('focus');
        }
      }
    };

    private actionRemovePublicKey = async (rmPubkeyButton: HTMLElement) => {
      const parentRow = $(rmPubkeyButton).closest('[email]');
      /* eslint-disable @typescript-eslint/no-non-null-assertion */
      const id = parentRow.attr('keyid')!;
      const family = parentRow.attr('type')! as KeyFamily; // todo - rename attr to "family"
      const email = parentRow.attr('email')!;
      /* eslint-enable @typescript-eslint/no-non-null-assertion */
      await ContactStore.unlinkPubkey(undefined, email, { id, family });
      await this.loadAndRenderContactList();
    };

    private actionRenderBulkImportPageHandler = () => {
      $('.hide_when_rendering_subpage').css('display', 'none');
      Xss.sanitizeRender('h1', `${this.backBtn}${this.space}Bulk Public Key Import${this.space}`);
      $('#bulk_import').css('display', 'block');
      $('#bulk_import .input_pubkey').val('').css('display', 'inline-block');
      $('#bulk_import .action_process').css('display', 'inline-block');
      $('#bulk_import #processed').text('').css('display', 'none');
      $('#file_import').show();
      $('#file_import #fineuploader_button').css('display', 'inline-block');
      $('#page_back_button').on(
        'click',
        this.setHandler(() => this.loadAndRenderContactList())
      );
    };

    private actionProcessBulkImportTextInput = async () => {
      try {
        const value = Str.normalize(String($('#bulk_import .input_pubkey').val())).trim();
        if (!value) {
          await Ui.modal.warning('Please paste public key(s).');
          return;
        }
        let { blocks } = MsgBlockParser.detectBlocks(value);
        blocks = blocks.filter((b, i) => blocks.findIndex(f => f.content === b.content) === i); // remove duplicates
        if (!blocks.length) {
          await Ui.modal.warning('Could not find any new public keys.');
        } else if (blocks.length === 1 && blocks[0].type === 'plainText') {
          // Show modal because users could make a mistake
          await Ui.modal.warning('Incorrect public key. Please check and try again.');
        } else {
          // Render Results
          const container = $('#bulk_import #processed');
          for (const block of blocks) {
            if (block.type === 'publicKey' || block.type === 'certificate') {
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              const replacedHtmlSafe = XssSafeFactory.renderableMsgBlock(this.factory!, block);
              if (replacedHtmlSafe && replacedHtmlSafe !== value) {
                container.append(replacedHtmlSafe); // xss-safe-factory
              }
            } else {
              Xss.sanitizeAppend(container, `<div class="bad">Skipping found ${block.type}</div>`);
            }
          }
          container.css('display', 'block');
          $('#bulk_import .input_pubkey, #bulk_import .action_process, #file_import, #fineuploader_button').css('display', 'none');
        }
      } catch (e) {
        ApiErr.reportIfSignificant(e);
        await Ui.modal.error(`There was an error trying to find this public key.\n\n${ApiErr.eli5(e)}`);
      }
    };
  }
);
