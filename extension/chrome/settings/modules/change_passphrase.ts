/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Assert } from '../../../js/common/assert.js';
import { Catch } from '../../../js/common/platform/catch.js';
import { KeyImportUi } from '../../../js/common/ui/key-import-ui.js';
import { KeyInfo, Key, KeyUtil } from '../../../js/common/core/crypto/key.js';
import { Settings } from '../../../js/common/settings.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { Url } from '../../../js/common/core/common.js';
import { View } from '../../../js/common/view.js';
import { initPassphraseToggle } from '../../../js/common/ui/passphrase-ui.js';
import { PassphraseStore } from '../../../js/common/platform/store/passphrase-store.js';
import { KeyStore } from '../../../js/common/platform/store/key-store.js';

View.run(class ChangePassPhraseView extends View {

  private readonly acctEmail: string;
  private readonly parentTabId: string;
  private readonly keyImportUi = new KeyImportUi({});

  private primaryKi: KeyInfo | undefined;
  private primaryPrv: Key | undefined;

  constructor() {
    super();
    const uncheckedUrlParams = Url.parse(['acctEmail', 'parentTabId']);
    this.acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
    this.parentTabId = Assert.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');
  }

  public render = async () => {
    await initPassphraseToggle(['current_pass_phrase', 'new_pass_phrase', 'new_pass_phrase_confirm']);
    const privateKeys = await KeyStore.get(this.acctEmail);
    if (privateKeys.length > 1) {
      $('#step_0_enter_current .sentence').text('Enter the current passphrase for your primary key');
      $('#step_0_enter_current #current_pass_phrase').attr('placeholder', 'Current primary key pass phrase');
      $('#step_1_enter_new #new_pass_phrase').attr('placeholder', 'Enter a new primary key pass phrase');
    }
    const primaryKi = await KeyStore.getFirst(this.acctEmail);
    this.primaryKi = primaryKi;
    Assert.abortAndRenderErrorIfKeyinfoEmpty(this.primaryKi);
    const storedOrSessionPp = await PassphraseStore.get(this.acctEmail, this.primaryKi.fingerprints[0]);
    const key = await KeyUtil.parse(this.primaryKi.private);
    this.primaryPrv = key;
    if (this.primaryPrv.fullyDecrypted || (storedOrSessionPp && await KeyUtil.decrypt(this.primaryPrv, storedOrSessionPp))) {
      this.displayBlock('step_1_enter_new'); // current pp is already known
      $('#new_pass_phrase').focus();
    } else {
      this.displayBlock('step_0_enter_current');
      $('#current_pass_phrase').focus();
    }
    this.keyImportUi.renderPassPhraseStrengthValidationInput($('#new_pass_phrase'), $('.action_set_pass_phrase'));
  }

  public setHandlers = () => {
    $('#step_0_enter_current .action_test_current_passphrase').click(this.setHandler(() => this.actionTestCurrentPassPhraseHandler()));
    $('#step_1_enter_new .action_set_pass_phrase').click(this.setHandler(el => this.actionSetPassPhraseHandler(el)));
    $('#step_2_confirm_new .action_use_another').click(this.setHandler(() => this.actionUseAnotherPassPhraseHandler()));
    $('#step_2_confirm_new .action_change').click(this.setHandlerPrevent('double', () => this.actionDoChangePassPhraseHandler()));
    $('#current_pass_phrase').on('keydown', this.setEnterHandlerThatClicks('#step_0_enter_current .action_test_current_passphrase'));
    $('#new_pass_phrase').on('keydown', this.setEnterHandlerThatClicks('#step_1_enter_new .action_set_pass_phrase'));
    $("#new_pass_phrase_confirm").on('keydown', this.setEnterHandlerThatClicks('#step_2_confirm_new .action_change'));
  }

  private actionTestCurrentPassPhraseHandler = async () => {
    const prv = await KeyUtil.parse(this.primaryKi!.private);
    if (await KeyUtil.decrypt(prv, String($('#current_pass_phrase').val())) === true) {
      this.primaryPrv = prv;
      this.displayBlock('step_1_enter_new');
      $('#new_pass_phrase').focus();
    } else {
      await Ui.modal.error('Pass phrase did not match, please try again.');
      $('#current_pass_phrase').val('').focus();
    }
  }

  private actionSetPassPhraseHandler = async (target: HTMLElement) => {
    if ($(target).hasClass('green')) {
      this.displayBlock('step_2_confirm_new');
      $('#new_pass_phrase_confirm').focus();
    } else {
      await Ui.modal.warning('Please select a stronger pass phrase. Combinations of 4 to 5 uncommon words are the best.');
    }
  }

  private actionUseAnotherPassPhraseHandler = () => {
    $('#new_pass_phrase').val('').keyup();
    $('#new_pass_phrase_confirm').val('');
    this.displayBlock('step_1_enter_new');
    $('#new_pass_phrase').focus();
  }

  private actionDoChangePassPhraseHandler = async () => {
    const newPp = String($('#new_pass_phrase').val());
    if (newPp !== $('#new_pass_phrase_confirm').val()) {
      await Ui.modal.warning('The two pass phrases do not match, please try again.');
      $('#new_pass_phrase_confirm').val('');
      $('#new_pass_phrase_confirm').focus();
      return;
    }
    try {
      await KeyUtil.encrypt(this.primaryPrv!, newPp);
    } catch (e) {
      Catch.reportErr(e);
      await Ui.modal.error(`There was an unexpected error. Please ask for help at human@flowcrypt.com:\n\n${e instanceof Error ? e.stack : String(e)}`);
      return;
    }
    await KeyStore.add(this.acctEmail, KeyUtil.armor(this.primaryPrv!));
    const persistentlyStoredPp = await PassphraseStore.get(this.acctEmail, this.primaryKi!.fingerprints[0], true);
    await PassphraseStore.set('local', this.acctEmail, this.primaryKi!.fingerprints[0], typeof persistentlyStoredPp === 'undefined' ? undefined : newPp);
    await PassphraseStore.set('session', this.acctEmail, this.primaryKi!.fingerprints[0], typeof persistentlyStoredPp === 'undefined' ? newPp : undefined);
    await Ui.modal.info('Now that you changed your pass phrase, you should back up your key. New backup will be protected with new passphrase.');
    Settings.redirectSubPage(this.acctEmail, this.parentTabId, '/chrome/settings/modules/backup.htm', '&action=backup_manual');
  }

  private displayBlock = (name: string) => {
    const blocks = ['step_0_enter_current', 'step_1_enter_new', 'step_2_confirm_new', 'step_3_done'];
    for (const block of blocks) {
      $(`#${block}`).css('display', 'none');
    }
    $(`#${name}`).css('display', 'block');
  }

});
