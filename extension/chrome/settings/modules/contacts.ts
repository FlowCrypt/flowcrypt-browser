/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { KeyUtil } from '../../../js/common/core/crypto/key.js';
import { Str, Url } from '../../../js/common/core/common.js';
import { ApiErr } from '../../../js/common/api/shared/api-error.js';
import { Assert } from '../../../js/common/assert.js';
import { Attachment } from '../../../js/common/core/attachment.js';
import { AttachmentUI } from '../../../js/common/ui/attachment-ui.js';
import { Browser } from '../../../js/common/browser/browser.js';
import { BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { Buf } from '../../../js/common/core/buf.js';
import { FetchKeyUI } from '../../../js/common/ui/fetch-key-ui.js';
import { KeyImportUi } from '../../../js/common/ui/key-import-ui.js';
import { PubLookup } from '../../../js/common/api/pub-lookup.js';
import { MsgBlockParser } from '../../../js/common/core/msg-block-parser.js';
import { OrgRules } from '../../../js/common/org-rules.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { View } from '../../../js/common/view.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { XssSafeFactory } from '../../../js/common/xss-safe-factory.js';
import { ContactStore } from '../../../js/common/platform/store/contact-store.js';

View.run(class ContactsView extends View {

  private acctEmail: string;

  private factory: XssSafeFactory | undefined; // set in render()
  private attachmentUI = new AttachmentUI(() => Promise.resolve({ sizeMb: 5, size: 5 * 1024 * 1024, count: 1 }));
  private orgRules!: OrgRules;
  private pubLookup!: PubLookup;
  private backBtn = '<a href="#" id="page_back_button" data-test="action-back-to-contact-list">back</a>';
  private space = '&nbsp;&nbsp;&nbsp;&nbsp;';

  constructor() {
    super();
    const uncheckedUrlParams = Url.parse(['acctEmail', 'parentTabId']);
    this.acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
  }

  public render = async () => {
    const tabId = await BrowserMsg.requiredTabId();
    BrowserMsg.listen(tabId); // set_css
    this.factory = new XssSafeFactory(this.acctEmail, tabId, undefined, undefined, { compact: true });
    this.orgRules = await OrgRules.newInstance(this.acctEmail);
    this.pubLookup = new PubLookup(this.orgRules);
    this.attachmentUI.initAttachmentDialog('fineuploader', 'fineuploader_button', { attachmentAdded: this.fileAddedHandler });
    const fetchKeyUI = new FetchKeyUI();
    fetchKeyUI.handleOnPaste($('.input_pubkey'));
    await this.loadAndRenderContactList();
  }

  public setHandlers = () => {
    $('.action_show_pubkey_list').off().click(this.setHandlerPrevent('double', this.actionRenderListPublicKeyHandler));
    $('#edit_contact .action_save_edited_pubkey').off().click(this.setHandlerPrevent('double', this.actionSaveEditedPublicKeyHandler));
    $('#bulk_import .action_process').off().click(this.setHandlerPrevent('double', this.actionProcessBulkImportTextInput));
    $('.action_remove').off().click(this.setHandlerPrevent('double', this.actionRemovePublicKey));
    $('.action_export_all').off().click(this.setHandlerPrevent('double', this.actionExportAllKeysHandler));
    $('.action_view_bulk_import').off().click(this.setHandlerPrevent('double', this.actionRenderBulkImportPageHandler));
    $('.input-search-contacts').off().keyup(this.setHandlerPrevent('double', this.loadAndRenderContactList));
  }

  // --- PRIVATE

  private loadAndRenderContactList = async () => {
    const contacts = await ContactStore.search(undefined, { hasPgp: true, limit: 500, substring: String($('.input-search-contacts').val()) });
    let lineActionsHtml = '&nbsp;&nbsp;<a href="#" class="action_export_all">export all</a>&nbsp;&nbsp;' +
      '&nbsp;&nbsp;<a href="#" class="action_view_bulk_import" data-test="action-show-import-public-keys-form">import public keys</a>&nbsp;&nbsp;';
    if (this.orgRules.getCustomSksPubkeyServer()) {
      lineActionsHtml += `&nbsp;&nbsp;<br><br><b class="bad">using custom SKS pubkeyserver: ${Xss.escape(this.orgRules!.getCustomSksPubkeyServer()!)}</b>`;
    } else {
      lineActionsHtml += '&nbsp;&nbsp;<a href="https://flowcrypt.com/docs/technical/keyserver-integration.html" target="_blank">use custom keyserver</a>&nbsp;&nbsp;';
    }
    Xss.sanitizeRender('.line.actions', lineActionsHtml);
    $('#emails').text('');
    $('.hide_when_rendering_subpage').css('display', 'block');
    $('h1').text('Contacts and their Public Keys');
    $('#view_contact, #edit_contact, #bulk_import').css('display', 'none');
    let tableContents = '';
    for (const email of contacts.map(preview => preview.email).filter((value, index, self) => !self.slice(0, index).find((el) => el === value))) {
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
  }

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
  }

  private actionExportAllKeysHandler = async () => {
    const allArmoredPublicKeys = (await ContactStore.searchPubkeys(undefined, { hasPgp: true })).map(a => a!.trim()).join('\n');
    const exportFile = new Attachment({ name: 'public-keys-export.asc', type: 'application/pgp-keys', data: Buf.fromUtfStr(allArmoredPublicKeys) });
    Browser.saveToDownloads(exportFile);
  }

  private actionRenderListPublicKeyHandler = async (emailRow: HTMLElement) => {
    $(emailRow).addClass('opened');
    const email = $(emailRow).attr('email')!;
    const contact = await ContactStore.getOneWithAllPubkeys(undefined, email);
    const e = Xss.escape(email);
    if (contact && contact.sortedPubkeys.length) {
      let tableContents = '';
      for (const pubkey of contact.sortedPubkeys) {
        const keyid = Xss.escape(pubkey.pubkey.id);
        const type = Xss.escape(pubkey.pubkey.type);
        let status: string;
        if (pubkey.revoked) {
          status = 'revoked';
        } else if (pubkey.pubkey?.usableForEncryption) {
          status = 'active';
        } else if (pubkey.pubkey?.usableForEncryptionButExpired) {
          status = 'expired';
        } else if (pubkey.pubkey?.usableForSigning) {
          status = 'sign only';
        } else {
          status = 'unusable';
        }
        const change = `<a href="#" title="Change" class="action_change" data-test="action-change-pubkey-${keyid}-${type}"></a>`;
        const remove = `<a href="#" title="Remove" class="action_remove" data-test="action-remove-pubkey-${keyid}-${type}"></a>`;
        const show = `<a href="#" title="Show" class="action_show" data-test="action-show-pubkey-${keyid}-${type}">${type} - ${status} - ${Str.spaced(keyid)}</a>`;
        tableContents += `<div class="contacts-pubkey" email="${e}" keyid="${keyid}" type="${type}">${show}${change}${remove}</div>`;
      }
      $(emailRow).after(tableContents);
      // remove all listeners from the old link by creating a new element
      const newElement = emailRow.cloneNode(true);
      emailRow!.parentNode!.replaceChild(newElement, emailRow);
      $('.action_show').off().click(this.setHandlerPrevent('double', this.actionRenderViewPublicKeyHandler));
      $('.action_change').off().click(this.setHandlerPrevent('double', this.actionRenderChangePublicKeyHandler));
    }
  }

  private actionRenderViewPublicKeyHandler = async (viewPubkeyButton: HTMLElement) => {
    const parentRow = $(viewPubkeyButton).closest('[email]');
    const id = parentRow.attr('keyid')!;
    const type = parentRow.attr('type')!;
    const email = parentRow.attr('email')!;
    const armoredPubkey = await ContactStore.getPubkey(undefined, { id, type });
    if (!armoredPubkey) {
      // todo: show error message like 'key disappeared'?
      return;
    }
    const key = await KeyUtil.parse(armoredPubkey);
    $('.hide_when_rendering_subpage').css('display', 'none');
    Xss.sanitizeRender('h1', `${this.backBtn}${this.space}${email}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`);
    $('#view_contact .key_dump').text(armoredPubkey);
    $('#view_contact #container-pubkey-details').text([
      `Type: ${key.type}`,
      `Fingerprint: ${Str.spaced(key.id || 'none')}`,
      `Users: ${key.emails?.join(', ')}`,
      `Created on: ${key.created ? new Date(key.created) : ''}`,
      `Expiration: ${key.expiration ? new Date(key.expiration) : 'Does not expire'}`,
      `Last signature: ${key.lastModified ? new Date(key.lastModified) : ''}`,
      `Expired: ${key.expiration && key.expiration < Date.now() ? 'yes' : 'no'}`,
      `Usable for encryption: ${key.usableForEncryption}`,
      `Usable for signing: ${key.usableForSigning}`,
    ].join('\n'));
    $('#view_contact').css('display', 'block');
    $('#page_back_button').click(this.setHandler(() => this.loadAndRenderContactList()));
  }

  private actionRenderChangePublicKeyHandler = (changePubkeyButton: HTMLElement) => {
    $('.hide_when_rendering_subpage').css('display', 'none');
    const email = $(changePubkeyButton).closest('[email]').attr('email')!;
    Xss.sanitizeRender('h1', `${this.backBtn}${this.space}${Xss.escape(email)}${this.space}(edit)`);
    $('#edit_contact').css('display', 'block');
    $('#edit_contact .input_pubkey').val('').attr('email', email);
    $('#page_back_button').click(this.setHandler(() => this.loadAndRenderContactList()));
  }

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
      } catch (e) {
        await Ui.modal.warning('Cannot recognize a valid public key, please try again. Let us know at human@flowcrypt.com if you need help.');
        $('#edit_contact .input_pubkey').val('').focus();
      }
    }
  }

  private actionRemovePublicKey = async (rmPubkeyButton: HTMLElement) => {
    await ContactStore.save(undefined, await ContactStore.obj({ email: $(rmPubkeyButton).closest('[email]').attr('email')! }));
    await this.loadAndRenderContactList();
  }

  private actionRenderBulkImportPageHandler = () => {
    $('.hide_when_rendering_subpage').css('display', 'none');
    Xss.sanitizeRender('h1', `${this.backBtn}${this.space}Bulk Public Key Import${this.space}`);
    $('#bulk_import').css('display', 'block');
    $('#bulk_import .input_pubkey').val('').css('display', 'inline-block');
    $('#bulk_import .action_process').css('display', 'inline-block');
    $('#bulk_import #processed').text('').css('display', 'none');
    $('#file_import').show();
    $('#file_import #fineuploader_button').css('display', 'inline-block');
    $('#page_back_button').click(this.setHandler(() => this.loadAndRenderContactList()));
  }

  private actionProcessBulkImportTextInput = async () => {
    try {
      const value = Str.normalize(String($('#bulk_import .input_pubkey').val())).trim();
      if (!value) {
        await Ui.modal.warning('Please paste public key(s).');
        return;
      }
      const normalizedFingerprintOrLongid = KeyImportUi.normalizeFingerprintOrLongId(value);
      let pub: string;
      if (normalizedFingerprintOrLongid) {
        const data = await this.pubLookup.lookupFingerprint(normalizedFingerprintOrLongid);
        if (data.pubkey) {
          pub = data.pubkey;
        } else {
          await Ui.modal.warning('Could not find any Public Key in our public records that matches this fingerprint or longid');
          return;
        }
      } else {
        pub = value;
      }
      let { blocks } = MsgBlockParser.detectBlocks(pub);
      blocks = blocks.filter((b, i) => blocks.findIndex(f => f.content === b.content) === i); // remove duplicates
      if (!blocks.length) {
        await Ui.modal.warning('Could not find any new public keys.');
      } else if (blocks.length === 1 && blocks[0].type === 'plainText') { // Show modal because users could make a mistake
        await Ui.modal.warning('Incorrect public key. Please check and try again.');
      } else { // Render Results
        const container = $('#bulk_import #processed');
        for (const block of blocks) {
          if (block.type === 'publicKey' || block.type === 'certificate') {
            const replacedHtmlSafe = XssSafeFactory.replaceRenderableMsgBlocks(this.factory!, block.content.toString(), '', '');
            if (replacedHtmlSafe && replacedHtmlSafe !== value) {
              container.append(replacedHtmlSafe); // xss-safe-factory
            }
          } else {
            Xss.sanitizeAppend(container, `<div class="bad">Skipping found ${block.type}</div>`);
          }
        }
        container.css('display', 'block');
        $('#bulk_import .input_pubkey, #bulk_import .action_process, #file_import #fineuploader_button').css('display', 'none');
      }
    } catch (e) {
      ApiErr.reportIfSignificant(e);
      await Ui.modal.error(`There was an error trying to find this public key.\n\n${ApiErr.eli5(e)}`);
    }
  }

});
