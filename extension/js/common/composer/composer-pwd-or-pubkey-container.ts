/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypcom */

'use strict';

import { ComposerComponent } from './interfaces/composer-component.js';
import { Ui } from '../browser.js';
import { RecipientStatuses, SendBtnTexts } from './interfaces/composer-types.js';
import { KeyImportUi } from '../ui/key_import_ui.js';

export class ComposerPwdOrPubkeyContainer extends ComposerComponent {

  private keyImportUI = new KeyImportUi({});

  public initActions() {
    this.composer.S.cached('input_password').keyup(Ui.event.prevent('spree', () => this.showHideContainerAndColorSendBtn()));
    this.composer.S.cached('input_password').focus(() => this.showHideContainerAndColorSendBtn());
    this.composer.S.cached('input_password').blur(() => this.showHideContainerAndColorSendBtn());
  }

  private rmPwdStrengthValidationElements: (() => void) | undefined;

  public showHideContainerAndColorSendBtn = () => {
    this.composer.composerSendBtn.resetSendBtn();
    this.composer.S.cached('send_btn_note').text('');
    this.composer.S.cached('send_btn').removeAttr('title');
    const wasPreviouslyVisible = this.composer.S.cached('password_or_pubkey').css('display') === 'table-row';
    if (!this.composer.getRecipients().length || !this.composer.composerSendBtn.popover.choices.encrypt) { // Hide 'Add Pasword' prompt if there are no recipients or message is not encrypted
      this.hideMsgPwdUi();
      this.composer.composerSendBtn.setBtnColor('green');
    } else if (this.composer.getRecipients().find(r => r.status === RecipientStatuses.NO_PGP)) {
      this.showMsgPwdUiAndColorBtn();
    } else if (this.composer.getRecipients().find(r => [RecipientStatuses.FAILED, RecipientStatuses.WRONG].includes(r.status))) {
      this.composer.S.now('send_btn_text').text(SendBtnTexts.BTN_WRONG_ENTRY);
      this.composer.S.cached('send_btn').attr('title', 'Notice the recipients marked in red: please remove them and try to enter them egain.');
      this.composer.composerSendBtn.setBtnColor('gray');
    } else {
      this.hideMsgPwdUi();
      this.composer.composerSendBtn.setBtnColor('green');
    }
    if (this.urlParams.isReplyBox) {
      if (!wasPreviouslyVisible && this.composer.S.cached('password_or_pubkey').css('display') === 'table-row') {
        this.composer.composerWindowSize.resizeComposeBox((this.composer.S.cached('password_or_pubkey').first().height() || 66) + 20);
      } else {
        this.composer.composerWindowSize.resizeComposeBox();
      }
    }
    this.composer.composerWindowSize.setInputTextHeightManuallyIfNeeded();
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
    this.composer.composerWindowSize.setInputTextHeightManuallyIfNeeded();
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
    this.composer.composerWindowSize.setInputTextHeightManuallyIfNeeded();
  }

}
