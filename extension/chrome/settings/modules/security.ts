/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Assert } from '../../../js/common/assert.js';
import { Settings } from '../../../js/common/settings.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { Url } from '../../../js/common/core/common.js';
import { View } from '../../../js/common/view.js';
import { initPassphraseToggle } from '../../../js/common/ui/passphrase-ui.js';
import { AcctStore } from '../../../js/common/platform/store/acct-store.js';
import { KeyStore } from '../../../js/common/platform/store/key-store.js';
import { KeyStoreUtil, ParsedKeyInfo } from '../../../js/common/core/crypto/key-store-util.js';
import { PassphraseStore } from '../../../js/common/platform/store/passphrase-store.js';
import { ClientConfiguration } from '../../../js/common/client-configuration.js';
import { AccountServer } from '../../../js/common/api/account-server.js';

View.run(
  class SecurityView extends View {
    private readonly acctEmail: string;
    private readonly parentTabId: string;
    private prvs!: ParsedKeyInfo[];
    private clientConfiguration!: ClientConfiguration;
    private acctServer: AccountServer;

    public constructor() {
      super();
      const uncheckedUrlParams = Url.parse(['acctEmail', 'parentTabId']);
      this.acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
      this.parentTabId = Assert.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');
      this.acctServer = new AccountServer(this.acctEmail);
    }

    public render = async () => {
      await this.acctServer.initialize();
      await initPassphraseToggle(['passphrase_entry']);
      this.prvs = await KeyStoreUtil.parse(await KeyStore.getRequired(this.acctEmail));
      const storage = await AcctStore.get(this.acctEmail, ['hide_message_password', 'outgoing_language']);
      this.clientConfiguration = await ClientConfiguration.newInstance(this.acctEmail);
      $('#hide_message_password').prop('checked', storage.hide_message_password === true);
      $('.password_message_language').val(storage.outgoing_language || 'EN');
      await this.renderPassPhraseOptionsIfStoredPermanently();
      if (this.clientConfiguration.mustAutogenPassPhraseQuietly()) {
        $('.hide_if_pass_phrase_not_user_configurable').hide();
      }
    };

    public setHandlers = () => {
      $('.action_change_passphrase').on(
        'click',
        this.setHandler(() => Settings.redirectSubPage(this.acctEmail, this.parentTabId, '/chrome/settings/modules/change_passphrase.htm'))
      );
      $('.action_test_passphrase').on(
        'click',
        this.setHandler(() => Settings.redirectSubPage(this.acctEmail, this.parentTabId, '/chrome/settings/modules/test_passphrase.htm'))
      );
      $('#hide_message_password').change(this.setHandler(el => this.hideMsgPasswordHandler(el)));
      $('.password_message_language').change(this.setHandler(() => this.onMsgLanguageUserChange()));
    };

    private renderPassPhraseOptionsIfStoredPermanently = async () => {
      if (await this.isAnyPassPhraseStoredPermanently(this.prvs)) {
        $('.forget_passphrase').css('display', '');
        $('.action_forget_pp').on(
          'click',
          this.setHandler(() => {
            $('.forget_passphrase').css('display', 'none');
            $('.passphrase_entry_container').css('display', '');
          })
        );
        $('.confirm_passphrase_requirement_change').on(
          'click',
          this.setHandler(async () => {
            const allPassPhrases = (await Promise.all(this.prvs.map(prv => PassphraseStore.get(this.acctEmail, prv.keyInfo)))).filter(pp => !!pp);
            if (allPassPhrases.includes(String($('input#passphrase_entry').val()))) {
              for (const key of this.prvs) {
                await PassphraseStore.set('local', this.acctEmail, key.keyInfo, undefined);
                await PassphraseStore.set('session', this.acctEmail, key.keyInfo, undefined);
              }
              window.location.reload();
            } else {
              await Ui.modal.warning('Pass phrase did not match, please try again.');
              $('input#passphrase_entry').val('').trigger('focus');
            }
          })
        );
        $('.cancel_passphrase_requirement_change').on('click', () => window.location.reload());
        $('#passphrase_entry').keydown(this.setEnterHandlerThatClicks('.confirm_passphrase_requirement_change'));
      }
    };

    private onMsgLanguageUserChange = async () => {
      const outgoingLanguage = String($('.password_message_language').val());
      if (['EN', 'DE'].includes(outgoingLanguage)) {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        await AcctStore.set(this.acctEmail, { outgoing_language: outgoingLanguage as 'DE' | 'EN' });
        window.location.reload();
      }
    };

    private hideMsgPasswordHandler = async (checkbox: HTMLElement) => {
      // eslint-disable-next-line @typescript-eslint/naming-convention
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
  }
);
