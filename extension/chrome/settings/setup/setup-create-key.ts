/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { SetupOptions, SetupView } from '../setup.js';
import { Catch } from '../../../js/common/platform/catch.js';
import { Lang } from '../../../js/common/lang.js';
import { PgpKey, KeyAlgo } from '../../../js/common/core/pgp-key.js';
import { Settings } from '../../../js/common/settings.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { Url } from '../../../js/common/core/common.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { shouldPassPhraseBeHidden } from '../../../js/common/ui/passphrase-ui.js';
import { AcctStore } from '../../../js/common/platform/store/acct-store.js';

export class SetupCreateKeyModule {

  constructor(private view: SetupView) {
  }

  public actionCreateKeyHandler = async () => {
    await Settings.forbidAndRefreshPageIfCannot('CREATE_KEYS', this.view.orgRules);
    if (! await this.isCreatePrivateFormInputCorrect()) {
      return;
    }
    try {
      $('#step_2a_manual_create input').prop('disabled', true);
      Xss.sanitizeRender('#step_2a_manual_create .action_create_private', Ui.spinner('white') + 'just a minute');
      const options: SetupOptions = {
        passphrase: String($('#step_2a_manual_create .input_password').val()),
        passphrase_save: Boolean($('#step_2a_manual_create .input_passphrase_save').prop('checked')),
        submit_main: this.view.shouldSubmitPubkey('#step_2a_manual_create .input_submit_key'),
        submit_all: this.view.shouldSubmitPubkey('#step_2a_manual_create .input_submit_all'),
        recovered: false,
      };
      const keyAlgo = this.view.orgRules.getEnforcedKeygenAlgo() || $('#step_2a_manual_create .key_type').val() as KeyAlgo;
      const action = $('#step_2a_manual_create .input_backup_inbox').prop('checked') ? 'setup_automatic' : 'setup_manual';
      await this.createSaveKeyPair(options, keyAlgo);
      await this.view.preFinalizeSetup(options);
      // only finalize after backup is done. backup.htm will redirect back to this page with ?action=finalize
      window.location.href = Url.create('modules/backup.htm', { action, acctEmail: this.view.acctEmail });
    } catch (e) {
      Catch.reportErr(e);
      await Ui.modal.error(`There was an error, please try again.\n\n(${String(e)})`);
      $('#step_2a_manual_create .action_create_private').text('CREATE AND SAVE');
    }
  }

  public actionShowAdvancedSettingsHandle = async (target: HTMLElement) => {
    const advancedCreateSettings = $('#step_2a_manual_create .advanced_create_settings');
    const container = $('#step_2a_manual_create .advanced_create_settings_container');
    if (advancedCreateSettings.is(':visible')) {
      advancedCreateSettings.hide('fast');
      $(target).find('span').text('Show Advanced Settings');
      container.css('width', '360px');
    } else {
      advancedCreateSettings.show('fast');
      $(target).find('span').text('Hide Advanced Settings');
      container.css('width', 'auto');
    }
  }

  public createSaveKeyPair = async (options: SetupOptions, keyAlgo: KeyAlgo) => {
    await Settings.forbidAndRefreshPageIfCannot('CREATE_KEYS', this.view.orgRules);
    const { full_name } = await AcctStore.get(this.view.acctEmail, ['full_name']);
    try {
      const key = await PgpKey.create([{ name: full_name || '', email: this.view.acctEmail }], keyAlgo, options.passphrase); // todo - add all addresses?
      const prv = await PgpKey.read(key.private);
      await this.view.saveKeys([prv], options);
    } catch (e) {
      Catch.reportErr(e);
      Xss.sanitizeRender('#step_2_easy_generating, #step_2a_manual_create', Lang.setup.fcDidntSetUpProperly);
    }
  }

  private isCreatePrivateFormInputCorrect = async () => {
    const password1 = $('#step_2a_manual_create .input_password');
    const password2 = $('#step_2a_manual_create .input_password2');
    if (!password1.val()) {
      await Ui.modal.warning('Pass phrase is needed to protect your private email. Please enter a pass phrase.');
      password1.focus();
      return false;
    }
    if ($('#step_2a_manual_create .action_create_private').hasClass('gray')) {
      await Ui.modal.warning('Pass phrase is not strong enough. Please make it stronger, by adding a few words.');
      password1.focus();
      return false;
    }
    if (password1.val() !== password2.val()) {
      await Ui.modal.warning('The pass phrases do not match. Please try again.');
      password2.val('').focus();
      return false;
    }
    let notePp = String(password1.val());
    if (await shouldPassPhraseBeHidden()) {
      notePp = notePp.substring(0, 2) + notePp.substring(2, notePp.length - 2).replace(/[^ ]/g, '*') + notePp.substring(notePp.length - 2, notePp.length);
    }
    const paperPassPhraseStickyNote = `
      <div style="font-size: 1.2em">
        Please write down your pass phrase and store it in safe place or even two.
        It is needed in order to access your FlowCrypt account.
      </div>
      <div class="passphrase-sticky-note">${notePp}</div>
    `;
    return await Ui.modal.confirmWithCheckbox('Yes, I wrote it down', paperPassPhraseStickyNote);
  }

}
