/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { KeyImportUi } from '../../../js/common/ui/key-import-ui.js';
import { Url } from '../../../js/common/core/common.js';
import { ApiErr } from '../../../js/common/api/shared/api-error.js';
import { Assert } from '../../../js/common/assert.js';
import { BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { Gmail } from '../../../js/common/api/email-provider/gmail/gmail.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { View } from '../../../js/common/view.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { initPassphraseToggle } from '../../../js/common/ui/passphrase-ui.js';
import { Key } from '../../../js/common/core/crypto/key.js';
import { ClientConfiguration } from '../../../js/common/client-configuration.js';
import { AcctStore } from '../../../js/common/platform/store/acct-store.js';
import { saveKeysAndPassPhrase, setPassphraseForPrvs } from '../../../js/common/helpers.js';
import { KeyErrors } from '../../elements/shared/key_errors.js';
import { AddKeyGenerateModule } from './add_key_generate_module.js';

export class AddKeyView extends View {
  public readonly acctEmail: string;
  public readonly parentTabId: string;
  public clientConfiguration!: ClientConfiguration;
  public fesUrl?: string;
  private readonly keyImportUi = new KeyImportUi({ rejectKnown: true });
  private readonly gmail: Gmail;
  private keyErrors: KeyErrors | undefined;
  private readonly addKeyGenerateModule: AddKeyGenerateModule;

  public constructor() {
    super();
    const uncheckedUrlParams = Url.parse(['acctEmail', 'parentTabId']);
    this.acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
    this.parentTabId = Assert.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');
    this.gmail = new Gmail(this.acctEmail);
    this.addKeyGenerateModule = new AddKeyGenerateModule(this);
  }

  public render = async () => {
    const storage = await AcctStore.get(this.acctEmail, ['fesUrl']);
    this.fesUrl = storage.fesUrl;
    this.clientConfiguration = await ClientConfiguration.newInstance(this.acctEmail);
    await this.addKeyGenerateModule.initGenerateKeyView();
    if (!this.clientConfiguration.forbidStoringPassPhrase()) {
      $('.input_passphrase_save_label').removeClass('hidden');
      $('.input_passphrase_save').prop('checked', true);
    }
    if (this.clientConfiguration.usesKeyManager()) {
      Xss.sanitizeRender(
        'body',
        `
      <br><br>
      <div data-test="container-err-text">Please contact your IT staff if you wish to update your keys.</div>
      <br><br>
      `
      );
    } else {
      $('#content').show();
      if (!this.clientConfiguration.forbidStoringPassPhrase()) {
        $('.input_passphrase_save').prop('checked', true).prop('disabled', false);
      }
      await initPassphraseToggle(['input_passphrase']);
      this.keyImportUi.initPrvImportSrcForm(this.acctEmail, this.parentTabId);
      Xss.sanitizeRender('#spinner_container', Ui.spinner('green') + ' loading..');
      await this.loadAndRenderKeyBackupsOrRenderError();
      $('.source_selector').css('display', 'block');
      $('#spinner_container').text('');
    }
  };

  public setHandlers = () => {
    $('.action_add_private_key').on('click', this.setHandlerPrevent('double', this.addPrivateKeyHandler));
    $('#input_passphrase').keydown(this.setEnterHandlerThatClicks('.action_add_private_key'));
    this.addKeyGenerateModule.setHandlers();
  };

  private loadAndRenderKeyBackupsOrRenderError = async () => {
    try {
      const backups = await this.gmail.fetchKeyBackups();
      if (!backups.longids.backups.length) {
        $('label[for=source_backup]').text('Load from backup (no backups found)').css('color', '#AAA');
        $('#source_backup').prop('disabled', true);
      } else if (backups.longids.backupsNotImported.length) {
        $('label[for=source_backup]').text(`Load from backup (${backups.longids.backupsNotImported.length} new to import)`);
      } else {
        $('label[for=source_backup]').text(`Load from backup (${backups.longids.backups.length} already loaded)`).css('color', '#AAA');
        $('#source_backup').prop('disabled', true);
      }
    } catch (e) {
      if (ApiErr.isAuthErr(e)) {
        BrowserMsg.send.notificationShowAuthPopupNeeded(this.parentTabId, { acctEmail: this.acctEmail });
      }
      $('label[for=source_backup]').text('Load from backup (error checking backups)').css('color', '#AAA');
      $('#source_backup').prop('disabled', true);
    }
  };

  private saveKeyAndContinue = async (key: Key) => {
    await saveKeysAndPassPhrase(this.acctEmail, [key]); // resulting new_key checked above
    /* eslint-disable @typescript-eslint/naming-convention */
    await setPassphraseForPrvs(this.clientConfiguration, this.acctEmail, [key], {
      passphrase: String($('.input_passphrase').val()),
      passphrase_save: !!$('.input_passphrase_save').prop('checked'),
      passphrase_ensure_single_copy: false, // we require KeyImportUi to rejectKnown keys
    });
    /* eslint-enable @typescript-eslint/naming-convention */
    BrowserMsg.send.reload(this.parentTabId, { advanced: true });
  };

  private addPrivateKeyHandler = async (submitBtn: HTMLElement) => {
    if (submitBtn.className.includes('gray')) {
      await Ui.modal.warning('Please double check the pass phrase input field for any issues.');
      return;
    }
    try {
      const checked = await this.keyImportUi.checkPrv(this.acctEmail, String($('.input_private_key').val()), String($('.input_passphrase').val()));
      if (checked) {
        await this.saveKeyAndContinue(checked.encrypted);
      }
    } catch (e) {
      this.keyErrors = new KeyErrors(this.fesUrl || '', this.acctEmail, this.parentTabId, this.clientConfiguration);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
      await this.keyErrors.handlePrivateKeyError(e, e.encrypted, undefined);
    }
  };
}

View.run(AddKeyView);
