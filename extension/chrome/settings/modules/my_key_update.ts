/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { ApiErr } from '../../../js/common/api/shared/api-error.js';
import { Assert } from '../../../js/common/assert.js';
import { Key, KeyInfoWithIdentity, KeyUtil, UnexpectedKeyTypeError } from '../../../js/common/core/crypto/key.js';
import { Lang } from '../../../js/common/lang.js';
import { PgpArmor } from '../../../js/common/core/crypto/pgp/pgp-armor.js';
import { Settings } from '../../../js/common/settings.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { Url, Str } from '../../../js/common/core/common.js';
import { View } from '../../../js/common/view.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { ClientConfiguration } from '../../../js/common/client-configuration.js';
import { PubLookup } from '../../../js/common/api/pub-lookup.js';
import { KeyStore } from '../../../js/common/platform/store/key-store.js';
import { PassphraseStore } from '../../../js/common/platform/store/passphrase-store.js';
import { AcctStore } from '../../../js/common/platform/store/acct-store.js';
import { InMemoryStore } from '../../../js/common/platform/store/in-memory-store.js';
import { InMemoryStoreKeys } from '../../../js/common/core/const.js';
import { KeyCanBeFixed, KeyImportUi, UserAlert } from '../../../js/common/ui/key-import-ui.js';
import { saveKeysAndPassPhrase, setPassphraseForPrvs } from '../../../js/common/helpers.js';
import { Catch } from '../../../js/common/platform/catch.js';
import { BrowserMsg } from '../../../js/common/browser/browser-msg.js';

View.run(
  class MyKeyUpdateView extends View {
    protected fesUrl?: string;
    private readonly acctEmail: string;
    private readonly keyImportUi = new KeyImportUi({});
    private readonly fingerprint: string;
    private readonly parentTabId: string;
    private readonly showKeyUrl: string;
    private readonly inputPrivateKey = $('.input_private_key');
    private readonly prvHeaders = PgpArmor.headers('privateKey');
    private ki: KeyInfoWithIdentity | undefined;
    private clientConfiguration!: ClientConfiguration;
    private pubLookup!: PubLookup;

    public constructor() {
      super();
      const uncheckedUrlParams = Url.parse(['acctEmail', 'fingerprint', 'parentTabId']);
      this.acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
      this.parentTabId = Assert.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');
      this.fingerprint = Assert.urlParamRequire.string(uncheckedUrlParams, 'fingerprint');
      this.showKeyUrl = Url.create('my_key.htm', uncheckedUrlParams);
    }

    public render = async () => {
      const storage = await AcctStore.get(this.acctEmail, ['fesUrl']);
      this.fesUrl = storage.fesUrl;
      this.clientConfiguration = await ClientConfiguration.newInstance(this.acctEmail);
      if (this.clientConfiguration.usesKeyManager()) {
        Xss.sanitizeRender(
          'body',
          `
      <br>
      <div data-test="container-err-title">Error: Insufficient Permission</div>
      <br><br>
      <div data-test="container-err-text">Please contact your IT staff if you wish to update your keys.</div>
      <br><br>
      `
        );
      } else {
        $('#content').show();
        this.keyImportUi.initPrvImportSrcForm(this.acctEmail, undefined);
        this.pubLookup = new PubLookup(this.clientConfiguration);
        [this.ki] = await KeyStore.get(this.acctEmail, [this.fingerprint]);
        Assert.abortAndRenderErrorIfKeyinfoEmpty(this.ki ? [this.ki] : []);
        $('.action_show_public_key').attr('href', this.showKeyUrl);
        $('.email').text(this.acctEmail);
        $('.fingerprint').text(Str.spaced(this.ki.fingerprints[0]));
        this.inputPrivateKey.attr('placeholder', this.inputPrivateKey.attr('placeholder') + ' (' + this.ki.fingerprints[0] + ')');
        $('.source_selector').css('display', 'block');
      }
    };

    public setHandlers = () => {
      $('.action_update_private_key').on(
        'click',
        this.setHandlerPrevent('double', () => this.updatePrivateKeyHandler())
      );
      $('.input_passphrase').keydown(this.setEnterHandlerThatClicks('.action_update_private_key'));
    };

    private isCustomerUrlFesUsed = () => Boolean(this.fesUrl);

    private toggleCompatibilityView = (visible: boolean) => {
      if (visible) {
        $('#add_key_container').hide();
        $('#compatibility_fix').show();
      } else {
        $('#add_key_container').show();
        $('#compatibility_fix').hide();
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

    private renderCompatibilityFixBlockAndFinalizeSetup = async (origPrv: Key) => {
      let fixedPrv;
      try {
        this.toggleCompatibilityView(true);
        fixedPrv = await Settings.renderPrvCompatFixUiAndWaitTilSubmittedByUser(
          this.acctEmail,
          '#compatibility_fix',
          origPrv,
          String($('.input_passphrase').val()),
          window.location.href.replace(/#$/, '')
        );
        await this.saveKeyAndContinue(fixedPrv);
      } catch (e) {
        Catch.reportErr(e);
        await Ui.modal.error(`Failed to fix key (${String(e)}). ${Lang.general.writeMeToFixIt(this.isCustomerUrlFesUsed())}`, false, Ui.testCompatibilityLink);
        this.toggleCompatibilityView(false);
      }
    };

    private storeUpdatedKeyAndPassphrase = async (updatedPrv: Key, updatedPrvPassphrase: string) => {
      /* eslint-disable @typescript-eslint/no-non-null-assertion, @typescript-eslint/naming-convention */
      const passphrase_save = !this.clientConfiguration.forbidStoringPassPhrase() && !!(await PassphraseStore.get(this.acctEmail, this.ki!, true));
      await saveKeysAndPassPhrase(this.acctEmail, [updatedPrv], { passphrase: updatedPrvPassphrase, passphrase_save, passphrase_ensure_single_copy: true });
      /* eslint-enable @typescript-eslint/no-non-null-assertion, @typescript-eslint/naming-convention */
      if (
        this.clientConfiguration.canSubmitPubToAttester() &&
        (await Ui.modal.confirm('Public and private key updated locally.\n\nUpdate public records with new Public Key?'))
      ) {
        try {
          const pubkey = KeyUtil.armor(await KeyUtil.asPublicKey(updatedPrv));
          const idToken = await InMemoryStore.get(this.acctEmail, InMemoryStoreKeys.ID_TOKEN);
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          await this.pubLookup.attester.submitPrimaryEmailPubkey(this.acctEmail, pubkey, idToken!);
        } catch (e) {
          ApiErr.reportIfSignificant(e);
          await Ui.modal.error(`Error updating public records:\n\n${ApiErr.eli5(e)}\n\n(but local update was successful)`);
        }
      }
      window.location.href = this.showKeyUrl;
    };

    private updatePrivateKeyHandler = async () => {
      try {
        const updatedKeyEncrypted = await KeyUtil.parse(String(this.inputPrivateKey.val()));
        const updatedKey = await KeyUtil.parse(KeyUtil.armor(updatedKeyEncrypted)); // create a "cloned" copy to decrypt later
        const updatedKeyPassphrase = String($('.input_passphrase').val());
        KeyImportUi.allowReselect();
        if (typeof updatedKey === 'undefined') {
          await Ui.modal.warning(Lang.setup.keyFormattedWell(this.prvHeaders.begin, String(this.prvHeaders.end)), Ui.testCompatibilityLink);
        } else if (updatedKeyEncrypted.identities.length === 0) {
          await Ui.modal.error(Lang.setup.prvHasUseridIssue);
        } else if (updatedKey.isPublic) {
          await Ui.modal.warning(
            'This was a public key. Please insert a private key instead. It\'s a block of text starting with "' + this.prvHeaders.begin + '"'
          );
          /* eslint-disable @typescript-eslint/no-non-null-assertion */
        } else if (updatedKey.id !== (await KeyUtil.parse(this.ki!.public)).id) {
          await Ui.modal.warning(`This key ${Str.spaced(updatedKey.id || 'err')} does not match your current key ${Str.spaced(this.ki!.fingerprints[0])}`);
          /* eslint-enable @typescript-eslint/no-non-null-assertion */
        } else if ((await KeyUtil.decrypt(updatedKey, updatedKeyPassphrase)) !== true) {
          await Ui.modal.error('The pass phrase does not match.\n\nPlease enter pass phrase of the newly updated key.');
        } else {
          if (updatedKey.usableForEncryption) {
            await this.storeUpdatedKeyAndPassphrase(updatedKeyEncrypted, updatedKeyPassphrase);
            return;
          }
          // cannot get a valid encryption key packet
          if ((await KeyUtil.isWithoutSelfCertifications(updatedKey)) || updatedKey.usableForEncryptionButExpired) {
            // known issues - key can be fixed
            const fixedEncryptedPrv = await Settings.renderPrvCompatFixUiAndWaitTilSubmittedByUser(
              this.acctEmail,
              '.compatibility_fix_container',
              updatedKeyEncrypted,
              updatedKeyPassphrase,
              this.showKeyUrl
            );
            await this.storeUpdatedKeyAndPassphrase(fixedEncryptedPrv, updatedKeyPassphrase);
          } else {
            await Ui.modal.warning(
              `Key update: This looks like a valid key but it cannot be used for encryption. Please ${Lang.general.contactMinimalSubsentence(
                !!this.fesUrl
              )} to see why is that.`,
              Ui.testCompatibilityLink
            );
            window.location.href = this.showKeyUrl;
          }
        }
      } catch (e) {
        if (e instanceof UserAlert) {
          return await Ui.modal.warning(e.message, Ui.testCompatibilityLink);
        } else if (e instanceof KeyCanBeFixed) {
          return await this.renderCompatibilityFixBlockAndFinalizeSetup(e.encrypted);
        } else if (e instanceof UnexpectedKeyTypeError) {
          return await Ui.modal.warning(`This does not appear to be a validly formatted key.\n\n${e.message}`);
        } else {
          Catch.reportErr(e);
          return await Ui.modal.error(
            `An error happened when processing the key: ${String(e)}\n${Lang.general.contactForSupportSentence(this.isCustomerUrlFesUsed())}`,
            false,
            Ui.testCompatibilityLink
          );
        }
      }
    };
  }
);
