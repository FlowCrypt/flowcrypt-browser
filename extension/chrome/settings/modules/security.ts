/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';


import { ApiErr } from '../../../js/common/api/shared/api-error.js';
import { Assert } from '../../../js/common/assert.js';
import { Catch } from '../../../js/common/platform/catch.js';
import { Settings } from '../../../js/common/settings.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { Url } from '../../../js/common/core/common.js';
import { View } from '../../../js/common/view.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { initPassphraseToggle } from '../../../js/common/ui/passphrase-ui.js';
import { AcctStore } from '../../../js/common/platform/store/acct-store.js';
import { KeyStore, KeyStoreUtil, ParsedKeyInfo } from '../../../js/common/platform/store/key-store.js';
import { PassphraseStore } from '../../../js/common/platform/store/passphrase-store.js';
import { OrgRules } from '../../../js/common/org-rules.js';
import { AccountServer } from '../../../js/common/api/account-server.js';
import { FcUuidAuth } from '../../../js/common/api/account-servers/flowcrypt-com-api.js';

View.run(class SecurityView extends View {

  private readonly acctEmail: string;
  private readonly parentTabId: string;
  private prvs!: ParsedKeyInfo[];
  private authInfo: FcUuidAuth | undefined;
  private orgRules!: OrgRules;
  private acctServer: AccountServer;

  constructor() {
    super();
    const uncheckedUrlParams = Url.parse(['acctEmail', 'parentTabId']);
    this.acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
    this.parentTabId = Assert.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');
    this.acctServer = new AccountServer(this.acctEmail);
  }

  public render = async () => {
    await initPassphraseToggle(['passphrase_entry']);
    this.prvs = await KeyStoreUtil.parse(await KeyStore.getRequired(this.acctEmail));
    this.authInfo = await AcctStore.authInfo(this.acctEmail);
    const storage = await AcctStore.get(this.acctEmail, ['hide_message_password', 'outgoing_language']);
    this.orgRules = await OrgRules.newInstance(this.acctEmail);
    $('#hide_message_password').prop('checked', storage.hide_message_password === true);
    $('.password_message_language').val(storage.outgoing_language || 'EN');
    await this.renderPassPhraseOptionsIfStoredPermanently();
    await this.loadAndRenderPwdEncryptedMsgSettings();
    if (this.orgRules.mustAutogenPassPhraseQuietly()) {
      $('.hide_if_pass_phrase_not_user_configurable').hide();
    }
  };

  public setHandlers = () => {
    $('.action_change_passphrase').click(this.setHandler(() => Settings.redirectSubPage(this.acctEmail, this.parentTabId, '/chrome/settings/modules/change_passphrase.htm')));
    $('.action_test_passphrase').click(this.setHandler(() => Settings.redirectSubPage(this.acctEmail, this.parentTabId, '/chrome/settings/modules/test_passphrase.htm')));
    $('#hide_message_password').change(this.setHandler((el) => this.hideMsgPasswordHandler(el)));
    $('.password_message_language').change(this.setHandler(() => this.onMsgLanguageUserChange()));
  };

  private renderPassPhraseOptionsIfStoredPermanently = async () => {
    if (await this.isAnyPassPhraseStoredPermanently(this.prvs)) {
      $('.forget_passphrase').css('display', '');
      $('.action_forget_pp').click(this.setHandler(() => {
        $('.forget_passphrase').css('display', 'none');
        $('.passphrase_entry_container').css('display', '');
      }));
      $('.confirm_passphrase_requirement_change').click(this.setHandler(async () => {
        // todo - for now checking just the most useful key. Should be checking that pp matches all
        //  but each key may have different pp, so the UI may get complicated.
        //  so for now we check that it matches any
        const allPassPhrases = (await Promise.all(this.prvs.map(prv => PassphraseStore.get(this.acctEmail, prv.keyInfo))))
          .filter(pp => !!pp);
        if (allPassPhrases.includes(String($('input#passphrase_entry').val()))) {
          for (const key of this.prvs) {
            await PassphraseStore.set('local', this.acctEmail, key.keyInfo, undefined);
            await PassphraseStore.set('session', this.acctEmail, key.keyInfo, undefined);
          }
          window.location.reload();
        } else {
          await Ui.modal.warning('Pass phrase did not match, please try again.');
          $('input#passphrase_entry').val('').focus();
        }
      }));
      $('.cancel_passphrase_requirement_change').click(() => window.location.reload());
      $('#passphrase_entry').keydown(this.setEnterHandlerThatClicks('.confirm_passphrase_requirement_change'));
    }
  };

  private loadAndRenderPwdEncryptedMsgSettings = async () => {
    Xss.sanitizeRender('.select_loader_container', Ui.spinner('green'));
    try {
      const response = await this.acctServer.accountGetAndUpdateLocalStore(this.authInfo!);
      $('.select_loader_container').text('');
      $('.default_message_expire').val(Number(response.account.default_message_expire).toString()).prop('disabled', false).css('display', 'inline-block');
      $('.default_message_expire').change(this.setHandler(() => this.onDefaultExpireUserChange()));
    } catch (e) {
      if (ApiErr.isAuthErr(e)) {
        Settings.offerToLoginWithPopupShowModalOnErr(this.acctEmail, () => window.location.reload());
      } else if (ApiErr.isNetErr(e)) {
        Xss.sanitizeRender('.expiration_container', '(network error: <a href="#">retry</a>)').find('a').click(() => window.location.reload()); // safe source
      } else {
        Catch.reportErr(e);
        Xss.sanitizeRender('.expiration_container', '(unknown error: <a href="#">retry</a>)').find('a').click(() => window.location.reload()); // safe source
      }
    }
  };

  private onDefaultExpireUserChange = async () => {
    Xss.sanitizeRender('.select_loader_container', Ui.spinner('green'));
    $('.default_message_expire').css('display', 'none');
    await this.acctServer.accountUpdate(this.authInfo!, { default_message_expire: Number($('.default_message_expire').val()) });
    window.location.reload();
  };

  private onMsgLanguageUserChange = async () => {
    const outgoingLanguage = String($('.password_message_language').val());
    if (['EN', 'DE'].includes(outgoingLanguage)) {
      await AcctStore.set(this.acctEmail, { outgoing_language: outgoingLanguage as 'DE' | 'EN' });
      window.location.reload();
    }
  };

  private hideMsgPasswordHandler = async (checkbox: HTMLElement) => {
    await AcctStore.set(this.acctEmail, { hide_message_password: $(checkbox).is(':checked') });
    window.location.reload();
  };

  private isAnyPassPhraseStoredPermanently = async (keys: ParsedKeyInfo[]) => {
    for (const key of keys) {
      if (await PassphraseStore.get(this.acctEmail, key.keyInfo, true)) {
        return true;
      }
    }
    return false;
  };
});
