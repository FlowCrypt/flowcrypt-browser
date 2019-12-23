/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypcom */

'use strict';

import { RecipientStatuses, SendBtnTexts } from './composer-types.js';

import { ComposerComponent } from './composer-abstract-component.js';
import { KeyImportUi } from '../../../js/common/ui/key_import_ui.js';
import { Store } from '../../../js/common/platform/store.js';

export class ComposerPwdOrPubkeyContainer extends ComposerComponent {

  private keyImportUI = new KeyImportUi({});

  public initActions = async () => {
    this.composer.S.cached('input_password').keyup(this.view.setHandlerPrevent('spree', () => this.showHideContainerAndColorSendBtn()));
    this.composer.S.cached('input_password').focus(() => this.showHideContainerAndColorSendBtn());
    this.composer.S.cached('input_password').blur(() => this.showHideContainerAndColorSendBtn());
    const store = await Store.getAcct(this.view.acctEmail, ['hide_message_password']);
    if (store.hide_message_password) {
      this.composer.S.cached('input_password').attr('type', 'password');
    }
  }

  private rmPwdStrengthValidationElements: (() => void) | undefined;

  public showHideContainerAndColorSendBtn = () => {
    this.composer.sendBtn.resetSendBtn();
    this.composer.S.cached('send_btn_note').text('');
    this.composer.S.cached('send_btn').removeAttr('title');
    const wasPreviouslyVisible = this.composer.S.cached('password_or_pubkey').css('display') === 'table-row';
    if (!this.composer.recipients.getRecipients().length || !this.composer.sendBtn.popover.choices.encrypt) {
      this.hideMsgPwdUi(); // Hide 'Add Pasword' prompt if there are no recipients or message is not encrypted
      this.composer.sendBtn.enableBtn();
    } else if (this.composer.recipients.getRecipients().find(r => r.status === RecipientStatuses.NO_PGP)) {
      this.showMsgPwdUiAndColorBtn();
    } else if (this.composer.recipients.getRecipients().find(r => [RecipientStatuses.FAILED, RecipientStatuses.WRONG].includes(r.status))) {
      this.composer.S.now('send_btn_text').text(SendBtnTexts.BTN_WRONG_ENTRY);
      this.composer.S.cached('send_btn').attr('title', 'Notice the recipients marked in red: please remove them and try to enter them egain.');
      this.composer.sendBtn.disableBtn();
    } else {
      this.hideMsgPwdUi();
      this.composer.sendBtn.enableBtn();
    }
    if (this.view.isReplyBox) {
      if (!wasPreviouslyVisible && this.composer.S.cached('password_or_pubkey').css('display') === 'table-row') {
        this.composer.size.resizeComposeBox((this.composer.S.cached('password_or_pubkey').first().height() || 66) + 20);
      } else {
        this.composer.size.resizeComposeBox();
      }
    }
    this.composer.size.setInputTextHeightManuallyIfNeeded();
  }

  private showMsgPwdUiAndColorBtn = () => {
    this.composer.S.cached('password_or_pubkey').css('display', 'table-row');
    this.composer.S.cached('password_or_pubkey').css('display', 'table-row');
    if (this.composer.S.cached('input_password').val() || this.composer.S.cached('input_password').is(':focus')) {
      this.composer.S.cached('password_label').css('display', 'inline-block');
      this.composer.S.cached('input_password').attr('placeholder', '');
    } else {
      this.composer.S.cached('password_label').css('display', 'none');
      this.composer.S.cached('input_password').attr('placeholder', 'message password');
    }
    if (this.composer.S.cached('input_intro').is(':visible')) {
      this.composer.S.cached('add_intro').css('display', 'none');
    } else {
      this.composer.S.cached('add_intro').css('display', 'block');
    }
    this.composer.size.setInputTextHeightManuallyIfNeeded();
    if (!this.rmPwdStrengthValidationElements) {
      const { removeValidationElements } = this.keyImportUI.renderPassPhraseStrengthValidationInput($("#input_password"), undefined, 'pwd');
      this.rmPwdStrengthValidationElements = removeValidationElements;
    }
  }

  private hideMsgPwdUi = () => {
    this.composer.S.cached('password_or_pubkey').css('display', 'none');
    this.composer.S.cached('input_password').val('');
    this.composer.S.cached('add_intro').css('display', 'none');
    this.composer.S.cached('input_intro').text('');
    this.composer.S.cached('intro_container').css('display', 'none');
    if (this.rmPwdStrengthValidationElements) {
      this.rmPwdStrengthValidationElements();
      this.rmPwdStrengthValidationElements = undefined;
    }
    this.composer.size.setInputTextHeightManuallyIfNeeded();
  }

}
