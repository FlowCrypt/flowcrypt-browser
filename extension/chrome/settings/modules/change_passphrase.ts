/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Assert } from '../../../js/common/assert.js';
import { Catch } from '../../../js/common/platform/catch.js';
import { KeyImportUi } from '../../../js/common/ui/key-import-ui.js';
import { KeyUtil } from '../../../js/common/core/crypto/key.js';
import { Settings } from '../../../js/common/settings.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { Url } from '../../../js/common/core/common.js';
import { View } from '../../../js/common/view.js';
import { initPassphraseToggle } from '../../../js/common/ui/passphrase-ui.js';
import { PassphraseStore } from '../../../js/common/platform/store/passphrase-store.js';
import { KeyStore } from '../../../js/common/platform/store/key-store.js';
import { KeyStoreUtil, ParsedKeyInfo } from '../../../js/common/core/crypto/key-store-util.js';
import { ClientConfiguration } from '../../../js/common/client-configuration.js';
import { BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { Lang } from '../../../js/common/lang.js';
import { AcctStore } from '../../../js/common/platform/store/acct-store.js';
import { BruteForceProtection } from '../../../js/common/brute-force-protection.js';

View.run(
  class ChangePassPhraseView extends View {
    protected fesUrl?: string;
    private readonly acctEmail: string;
    private readonly parentTabId: string;
    private readonly keyImportUi = new KeyImportUi({});
    private readonly bruteForceProtection: BruteForceProtection;

    private mostUsefulPrv: ParsedKeyInfo | undefined;
    private clientConfiguration!: ClientConfiguration;

    public constructor() {
      super();
      const uncheckedUrlParams = Url.parse(['acctEmail', 'parentTabId']);
      this.acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
      this.parentTabId = Assert.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');
      this.bruteForceProtection = new BruteForceProtection(this.acctEmail);
    }

    public render = async () => {
      const storage = await AcctStore.get(this.acctEmail, ['fesUrl']);
      await this.bruteForceProtection.init();
      this.fesUrl = storage.fesUrl;
      this.clientConfiguration = await ClientConfiguration.newInstance(this.acctEmail);
      await initPassphraseToggle(['current_pass_phrase', 'new_pass_phrase', 'new_pass_phrase_confirm']);
      const privateKeys = await KeyStore.get(this.acctEmail);
      if (privateKeys.length > 1) {
        $('#step_0_enter_current .sentence').text('Enter the current passphrase for your key');
        $('#step_0_enter_current #current_pass_phrase').attr('placeholder', 'Current key pass phrase');
        $('#step_1_enter_new #new_pass_phrase').attr('placeholder', 'Enter a new key pass phrase');
      }
      // todo - should be working across all keys. Existing keys may be encrypted for various pass phrases,
      //  which will complicate UI once implemented
      this.mostUsefulPrv = KeyStoreUtil.chooseMostUseful(await KeyStoreUtil.parse(await KeyStore.getRequired(this.acctEmail)), 'EVEN-IF-UNUSABLE');
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const storedOrSessionPp = await PassphraseStore.get(this.acctEmail, this.mostUsefulPrv!.keyInfo);
      if (
        this.mostUsefulPrv?.key.fullyDecrypted ||
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        (storedOrSessionPp && (await KeyUtil.decrypt(this.mostUsefulPrv!.key, storedOrSessionPp)))
      ) {
        this.displayBlock('step_1_enter_new'); // current pp is already known
        $('#new_pass_phrase').trigger('focus');
      } else {
        this.displayBlock('step_0_enter_current');
        $('#current_pass_phrase').trigger('focus');
      }
      this.keyImportUi.renderPassPhraseStrengthValidationInput($('#new_pass_phrase'), $('.action_set_pass_phrase'));
    };

    public setHandlers = () => {
      $('#step_0_enter_current .action_test_current_passphrase').on(
        'click',
        this.setHandler(() => this.actionTestCurrentPassPhraseHandler())
      );
      $('#step_1_enter_new .action_set_pass_phrase').on(
        'click',
        this.setHandler(el => this.actionSetPassPhraseHandler(el))
      );
      $('#step_2_confirm_new .action_use_another').on(
        'click',
        this.setHandler(() => this.actionUseAnotherPassPhraseHandler())
      );
      $('#step_2_confirm_new .action_change').on(
        'click',
        this.setHandlerPrevent('double', () => this.actionDoChangePassPhraseHandler())
      );
      $('#current_pass_phrase').on('keydown', this.setEnterHandlerThatClicks('#step_0_enter_current .action_test_current_passphrase'));
      $('#new_pass_phrase').on('keydown', this.setEnterHandlerThatClicks('#step_1_enter_new .action_set_pass_phrase'));
      $('#new_pass_phrase_confirm').on('keydown', this.setEnterHandlerThatClicks('#step_2_confirm_new .action_change'));
    };

    private actionTestCurrentPassPhraseHandler = async () => {
      if (await this.bruteForceProtection.shouldDisablePassphraseCheck()) {
        return;
      }
      if (!this.mostUsefulPrv) {
        return;
      }
      const prv = await KeyUtil.parse(this.mostUsefulPrv.keyInfo.private);
      if (await KeyUtil.decrypt(prv, String($('#current_pass_phrase').val()))) {
        await this.bruteForceProtection.passphraseCheckSucceed();
        this.mostUsefulPrv.key = prv;
        this.displayBlock('step_1_enter_new');
        $('#new_pass_phrase').trigger('focus');
      } else {
        await this.bruteForceProtection.passphraseCheckFailed();
        await Ui.modal.error('Pass phrase did not match, please try again.');
        $('#current_pass_phrase').val('').trigger('focus');
      }
    };

    private actionSetPassPhraseHandler = async (target: HTMLElement) => {
      if ($(target).hasClass('green')) {
        this.displayBlock('step_2_confirm_new');
        $('#new_pass_phrase_confirm').trigger('focus');
      } else {
        await Ui.modal.warning('Please select a stronger pass phrase. Combinations of 4 to 5 uncommon words are the best.');
      }
    };

    private actionUseAnotherPassPhraseHandler = () => {
      $('#new_pass_phrase').val('').trigger('input');
      $('#new_pass_phrase_confirm').val('');
      this.displayBlock('step_1_enter_new');
      $('#new_pass_phrase').trigger('focus');
    };

    private actionDoChangePassPhraseHandler = async () => {
      const newPp = String($('#new_pass_phrase').val());
      if (newPp !== $('#new_pass_phrase_confirm').val()) {
        await Ui.modal.warning('The two pass phrases do not match, please try again.');
        $('#new_pass_phrase_confirm').val('');
        $('#new_pass_phrase_confirm').trigger('focus');
        return;
      }
      try {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        await KeyUtil.encrypt(this.mostUsefulPrv!.key, newPp);
      } catch (e) {
        Catch.reportErr(e);
        await Ui.modal.error(
          `There was an unexpected error. ${Lang.general.contactForSupportSentence(!!this.fesUrl)}\n\n${e instanceof Error ? e.stack : String(e)}`
        );
        return;
      }
      /* eslint-disable @typescript-eslint/no-non-null-assertion */
      await KeyStore.add(this.acctEmail, this.mostUsefulPrv!.key);
      const shouldSavePassphraseInStorage =
        !this.clientConfiguration.forbidStoringPassPhrase() && !!(await PassphraseStore.get(this.acctEmail, this.mostUsefulPrv!.keyInfo, true));
      await PassphraseStore.set('local', this.acctEmail, this.mostUsefulPrv!.keyInfo, shouldSavePassphraseInStorage ? newPp : undefined);
      await PassphraseStore.set('session', this.acctEmail, this.mostUsefulPrv!.keyInfo, shouldSavePassphraseInStorage ? undefined : newPp);
      /* eslint-enable @typescript-eslint/no-non-null-assertion */
      if (this.clientConfiguration.canBackupKeys()) {
        await Ui.modal.info('Now that you changed your pass phrase, you should back up your key. New backup will be protected with new passphrase.');
        Settings.redirectSubPage(this.acctEmail, this.parentTabId, '/chrome/settings/modules/backup.htm', '&action=backup_manual');
      } else {
        await Ui.modal.info('Pass phrase changed for this device');
        BrowserMsg.send.closePage(this.parentTabId);
      }
    };

    private displayBlock = (name: string) => {
      const blocks = ['step_0_enter_current', 'step_1_enter_new', 'step_2_confirm_new', 'step_3_done'];
      for (const block of blocks) {
        $(`#${block}`).css('display', 'none');
      }
      $(`#${name}`).css('display', 'block');
    };
  }
);
