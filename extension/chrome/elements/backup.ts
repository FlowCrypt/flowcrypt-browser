/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Assert } from '../../js/common/assert.js';
import { BrowserMsg } from '../../js/common/browser/browser-msg.js';
import { KeyInfo } from '../../js/common/core/pgp-key.js';
import { PgpKey } from '../../js/common/core/pgp-key.js';
import { Ui } from '../../js/common/browser/ui.js';
import { Url, Str } from '../../js/common/core/common.js';
import { View } from '../../js/common/view.js';
import { initPassphraseToggle } from '../../js/common/ui/passphrase-ui.js';
import { KeyStore } from '../../js/common/platform/store/key-store.js';

View.run(class BackupView extends View {

  private readonly acctEmail: string;
  private readonly parentTabId: string;
  private readonly frameId: string;
  private readonly armoredPrvBackup: string;
  private storedPrvWithMatchingLongid: KeyInfo | undefined;

  constructor() {
    super();
    const uncheckedUrlParams = Url.parse(['acctEmail', 'armoredPrvBackup', 'parentTabId', 'frameId']);
    this.acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
    this.parentTabId = Assert.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');
    this.frameId = Assert.urlParamRequire.string(uncheckedUrlParams, 'frameId');
    this.armoredPrvBackup = Assert.urlParamRequire.string(uncheckedUrlParams, 'armoredPrvBackup');
  }

  public render = async () => {
    Ui.event.protect();
    await initPassphraseToggle(['pass_phrase']);
    const prvBackup = await PgpKey.read(this.armoredPrvBackup);
    const longid = await PgpKey.longid(prvBackup) || '';
    if (prvBackup) {
      $('.line.longids .longid').text(Str.spaced(await PgpKey.longid(prvBackup) || 'err'));
      if (! await prvBackup.getEncryptionKey() && ! await prvBackup.getSigningKey()) {
        $('.line.add_contact').addClass('bad').text('This private key looks correctly formatted, but cannot be used for encryption.');
        $('.line.longids').css({ display: 'none', visibility: 'hidden' });
      }
    } else {
      $('.line.longids').css({ display: 'none' });
    }
    [this.storedPrvWithMatchingLongid] = await KeyStore.get(this.acctEmail, [longid]);
    if (this.storedPrvWithMatchingLongid) {
      $('.line .private_key_status').text('This Private Key is already imported.');
    } else {
      $('.line .private_key_status')
        .text('This private key was not imported yet. We suggest to import all backups so that you can read all incoming encrypted emails.')
        .after('<div class="line"><button class="button green" id="action_import_key">Import Missing Private Key</button></div>');
    }
    this.sendResizeMsg();
  }

  public setHandlers = () => {
    if (!this.storedPrvWithMatchingLongid) {
      $("#action_import_key").click(this.setHandler(() => BrowserMsg.send.bg.settings({ acctEmail: this.acctEmail, page: '/chrome/settings/modules/add_key.htm' })));
    }
    $('.action_test_pass').click(this.setHandler(async () => this.testPassphraseHandler()));
    $('#pass_phrase').keydown(this.setEnterHandlerThatClicks('.action_test_pass'));
  }

  private sendResizeMsg = () => {
    const desiredHeight = $('#backup_block').height()!;
    BrowserMsg.send.setCss(this.parentTabId, { selector: `iframe#${this.frameId}`, css: { height: `${desiredHeight}px` } });
  }

  private testPassphraseHandler = async () => {
    if (await PgpKey.decrypt(await PgpKey.read(this.armoredPrvBackup), String($('#pass_phrase').val())) === true) {
      await Ui.modal.info('Success - your pass phrase matches this backup!');
    } else {
      await Ui.modal.warning('Pass phrase did not match. Please try again. If you forgot your pass phrase, please change it, so that you don\'t get' +
        ' locked out of your encrypted messages.');
    }
    $('#pass_phrase').val('');
  }
});
