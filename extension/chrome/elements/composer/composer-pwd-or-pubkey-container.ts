/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Backend } from '../../../js/common/api/backend.js';

import { RecipientStatuses, SendBtnTexts } from './composer-types.js';

import { ComposerComponent } from './composer-abstract-component.js';
import { KeyImportUi } from '../../../js/common/ui/key-import-ui.js';
import { Store } from '../../../js/common/platform/store.js';
import { Catch } from '../../../js/common/platform/catch.js';
import { Str } from '../../../js/common/core/common.js';
import { ApiErr } from '../../../js/common/api/error/api-error.js';

export class ComposerPwdOrPubkeyContainer extends ComposerComponent {

  private MSG_EXPIRE_DAYS_DEFAULT = 3; // todo - update to 7 (needs backend work)
  private keyImportUI = new KeyImportUi({});
  private rmPwdStrengthValidationElements: (() => void) | undefined;

  public initActions = async () => {
    this.composer.S.cached('input_password').keyup(this.view.setHandlerPrevent('spree', () => this.showHideContainerAndColorSendBtn()));
    this.composer.S.cached('input_password').focus(this.view.setHandlerPrevent('spree', () => {
      const passwordContainerHeight = this.composer.S.cached('password_or_pubkey').outerHeight() || 0;
      const footerHeight = this.composer.S.cached('footer').outerHeight() || 0;
      this.composer.S.cached('expiration_note').css({
        bottom: (passwordContainerHeight + footerHeight) + 'px'
      });
      this.composer.S.cached('expiration_note').fadeIn();
      this.showHideContainerAndColorSendBtn();
    }));
    this.composer.S.cached('input_password').blur(() => {
      Catch.setHandledTimeout(() => { // timeout here is needed so <a> will be visible once clicked
        this.composer.S.cached('expiration_note').fadeOut();
      }, 100);
      this.showHideContainerAndColorSendBtn();
    });
    this.composer.S.cached('expiration_note').find('#expiration_note_settings_link').click(this.view.setHandler((el, e) => {
      e.preventDefault();
      this.composer.render.renderSettingsWithDialog('security');
    }, this.composer.errs.handlers(`render settings dialog`)));

    const store = await Store.getAcct(this.view.acctEmail, ['hide_message_password']);
    if (store.hide_message_password) {
      this.composer.S.cached('input_password').attr('type', 'password');
    }
  }

  public showHideContainerAndColorSendBtn = () => {
    this.composer.sendBtn.resetSendBtn();
    this.composer.S.cached('send_btn_note').text('');
    this.composer.S.cached('send_btn').removeAttr('title');
    const wasPreviouslyVisible = this.composer.S.cached('password_or_pubkey').css('display') === 'table-row';
    if (!this.composer.recipients.getRecipients().length || !this.composer.sendBtn.popover.choices.encrypt) {
      this.hideMsgPwdUi(); // Hide 'Add Pasword' prompt if there are no recipients or message is not encrypted
      this.composer.sendBtn.enableBtn();
    } else if (this.composer.recipients.getRecipients().find(r => r.status === RecipientStatuses.NO_PGP)) {
      this.showMsgPwdUiAndColorBtn().catch(Catch.reportErr);
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
  private showMsgPwdUiAndColorBtn = async () => {
    if (this.composer.S.cached('password_or_pubkey').is(':hidden')) {
      const authInfo = await Store.authInfo(this.view.acctEmail);
      const expirationTextEl = this.composer.S.cached('expiration_note').find('#expiration_note_message_expire');
      if (!authInfo) {
        expirationTextEl.text(Str.pluralize(this.MSG_EXPIRE_DAYS_DEFAULT, 'day'));
      } else {
        try {
          const response = await Backend.accountGetAndUpdateLocalStore(authInfo);
          expirationTextEl.text(Str.pluralize(response.account.default_message_expire, 'day'));
        } catch (e) {
          ApiErr.reportIfSignificant(e);
          expirationTextEl.text(`(unknown days: ${ApiErr.eli5(e)})`);
        }
      }
      this.composer.S.cached('password_or_pubkey').css('display', 'table-row');
    }
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
