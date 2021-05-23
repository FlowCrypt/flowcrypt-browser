/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';


import { RecipientStatus, SendBtnTexts } from './compose-types.js';
import { KeyImportUi } from '../../../js/common/ui/key-import-ui.js';
import { Catch } from '../../../js/common/platform/catch.js';
import { Str } from '../../../js/common/core/common.js';
import { ApiErr } from '../../../js/common/api/shared/api-error.js';
import { ViewModule } from '../../../js/common/view-module.js';
import { ComposeView } from '../compose.js';
import { AcctStore } from '../../../js/common/platform/store/acct-store.js';

export class ComposePwdOrPubkeyContainerModule extends ViewModule<ComposeView> {

  private MSG_EXPIRE_DAYS_DEFAULT = 3; // todo - update to 7 (needs backend work)
  private keyImportUI = new KeyImportUi({});
  private rmPwdStrengthValidationElements: (() => void) | undefined;

  constructor(view: ComposeView, hideMsgPwd: boolean | undefined) {
    super(view);
    if (hideMsgPwd) {
      this.view.S.cached('input_password').attr('type', 'password');
    }
  }

  public setHandlers = () => {
    this.view.S.cached('input_password').keyup(this.view.setHandlerPrevent('spree', () => this.showHideContainerAndColorSendBtn()));
    this.view.S.cached('input_password').focus(this.view.setHandlerPrevent('spree', () => this.inputPwdFocusHandler()));
    this.view.S.cached('input_password').blur(this.view.setHandler(() => this.inputPwdBlurHandler()));
    this.view.S.cached('expiration_note').find('#expiration_note_settings_link').click(this.view.setHandler(async (el, e) => {
      e.preventDefault();
      await this.view.renderModule.openSettingsWithDialog('security');
    }, this.view.errModule.handle(`render settings dialog`)));
  }

  public inputPwdFocusHandler = () => {
    const passwordContainerHeight = this.view.S.cached('password_or_pubkey').outerHeight() || 0;
    const footerHeight = this.view.S.cached('footer').outerHeight() || 0;
    this.view.S.cached('expiration_note').css({ bottom: (passwordContainerHeight + footerHeight) + 'px' });
    this.view.S.cached('expiration_note').fadeIn();
    this.showHideContainerAndColorSendBtn(); // tslint:disable-line:no-floating-promises
  }

  public inputPwdBlurHandler = () => {
    Catch.setHandledTimeout(() => { // timeout here is needed so <a> will be visible once clicked
      this.view.S.cached('expiration_note').fadeOut();
    }, 100);
    this.showHideContainerAndColorSendBtn(); // tslint:disable-line:no-floating-promises
  }

  public showHideContainerAndColorSendBtn = async () => {
    this.view.sendBtnModule.resetSendBtn();
    this.view.S.cached('send_btn_note').text('');
    this.view.S.cached('send_btn').removeAttr('title');
    const wasPreviouslyVisible = this.view.S.cached('password_or_pubkey').css('display') === 'table-row';
    if (!this.view.recipientsModule.getRecipients().length || !this.view.sendBtnModule.popover.choices.encrypt) {
      this.hideMsgPwdUi(); // Hide 'Add Pasword' prompt if there are no recipients or message is not encrypted
      this.view.sendBtnModule.enableBtn();
    } else if (this.view.recipientsModule.getRecipients().find(r => [RecipientStatus.NO_PGP, RecipientStatus.REVOKED].includes(r.status))) {
      await this.showMsgPwdUiAndColorBtn(
        this.view.recipientsModule.getRecipients().some(r => r.status === RecipientStatus.NO_PGP),
        this.view.recipientsModule.getRecipients().some(r => r.status === RecipientStatus.REVOKED),
      ).catch(Catch.reportErr);
    } else if (this.view.recipientsModule.getRecipients().find(r => [RecipientStatus.FAILED, RecipientStatus.WRONG].includes(r.status))) {
      this.view.S.now('send_btn_text').text(SendBtnTexts.BTN_WRONG_ENTRY);
      this.view.S.cached('send_btn').attr('title', 'Notice the recipients marked in red: please remove them and try to enter them egain.');
      this.view.sendBtnModule.disableBtn();
    } else {
      this.hideMsgPwdUi();
      this.view.sendBtnModule.enableBtn();
    }
    if (this.view.isReplyBox) {
      if (!wasPreviouslyVisible && this.view.S.cached('password_or_pubkey').css('display') === 'table-row') {
        this.view.sizeModule.resizeComposeBox((this.view.S.cached('password_or_pubkey').first().height() || 66) + 20);
      } else {
        this.view.sizeModule.resizeComposeBox();
      }
    }
    this.view.sizeModule.setInputTextHeightManuallyIfNeeded();
  }

  public isVisible = () => {
    return !this.view.S.cached('password_or_pubkey').is(':hidden');
  }

  private showMsgPwdUiAndColorBtn = async (anyNopgp: boolean, anyRevoked: boolean) => {
    if (!this.isVisible()) {
      const authInfo = await AcctStore.authInfo(this.view.acctEmail);
      const expirationTextEl = this.view.S.cached('expiration_note').find('#expiration_note_message_expire');
      if (!authInfo) {
        expirationTextEl.text(Str.pluralize(this.MSG_EXPIRE_DAYS_DEFAULT, 'day'));
      } else {
        try {
          const response = await this.view.acctServer.accountGetAndUpdateLocalStore(authInfo);
          expirationTextEl.text(Str.pluralize(response.account.default_message_expire, 'day'));
        } catch (e) {
          ApiErr.reportIfSignificant(e);
          expirationTextEl.text(`(unknown days: ${ApiErr.eli5(e)})`);
        }
      }
      this.view.S.cached('password_or_pubkey').css('display', 'table-row');
    }
    if (this.view.S.cached('input_password').val() || this.view.S.cached('input_password').is(':focus')) {
      this.view.S.cached('password_label').css('display', 'inline-block');
      this.view.S.cached('input_password').attr('placeholder', '');
    } else {
      this.view.S.cached('password_label').css('display', 'none');
      this.view.S.cached('input_password').attr('placeholder', 'message password');
    }
    if (this.view.S.cached('input_intro').is(':visible')) {
      this.view.S.cached('add_intro').css('display', 'none');
    } else {
      this.view.S.cached('add_intro').css('display', 'block');
    }
    this.view.S.cached('warning_nopgp').css('display', anyNopgp ? 'inline-block' : 'none');
    this.view.S.cached('warning_revoked').css('display', anyRevoked ? 'inline-block' : 'none');
    this.view.sizeModule.setInputTextHeightManuallyIfNeeded();
    if (!this.rmPwdStrengthValidationElements) {
      const { removeValidationElements } = this.keyImportUI.renderPassPhraseStrengthValidationInput($("#input_password"), undefined, 'pwd');
      this.rmPwdStrengthValidationElements = removeValidationElements;
    }
  }

  private hideMsgPwdUi = () => {
    this.view.S.cached('password_or_pubkey').css('display', 'none');
    this.view.S.cached('input_password').val('');
    this.view.S.cached('add_intro').css('display', 'none');
    this.view.S.cached('input_intro').text('');
    this.view.S.cached('intro_container').css('display', 'none');
    if (this.rmPwdStrengthValidationElements) {
      this.rmPwdStrengthValidationElements();
      this.rmPwdStrengthValidationElements = undefined;
    }
    this.view.sizeModule.setInputTextHeightManuallyIfNeeded();
  }

}
