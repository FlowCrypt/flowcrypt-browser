/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { ApiErr } from '../../../js/common/api/shared/api-error.js';
import { Assert } from '../../../js/common/assert.js';
import { KeyInfo, Key, KeyUtil } from '../../../js/common/core/crypto/key.js';
import { Lang } from '../../../js/common/lang.js';
import { PgpArmor } from '../../../js/common/core/crypto/pgp/pgp-armor.js';
import { Settings } from '../../../js/common/settings.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { Url, Str } from '../../../js/common/core/common.js';
import { View } from '../../../js/common/view.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { OrgRules } from '../../../js/common/org-rules.js';
import { PubLookup } from '../../../js/common/api/pub-lookup.js';
import { KeyStore } from '../../../js/common/platform/store/key-store.js';
import { PassphraseStore } from '../../../js/common/platform/store/passphrase-store.js';
import { AcctStore } from '../../../js/common/platform/store/acct-store.js';

View.run(class MyKeyUpdateView extends View {

  protected fesUrl?: string;
  private readonly acctEmail: string;
  private readonly fingerprint: string;
  private readonly showKeyUrl: string;
  private readonly inputPrivateKey = $('.input_private_key');
  private readonly prvHeaders = PgpArmor.headers('privateKey');
  private ki: KeyInfo | undefined;
  private orgRules!: OrgRules;
  private pubLookup!: PubLookup;

  constructor() {
    super();
    const uncheckedUrlParams = Url.parse(['acctEmail', 'fingerprint', 'parentTabId']);
    this.acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
    this.fingerprint = Assert.urlParamRequire.string(uncheckedUrlParams, 'fingerprint');
    this.showKeyUrl = Url.create('my_key.htm', uncheckedUrlParams);
  }

  public render = async () => {
    const storage = await AcctStore.get(this.acctEmail, ['fesUrl']);
    this.fesUrl = storage.fesUrl;
    this.orgRules = await OrgRules.newInstance(this.acctEmail);
    if (this.orgRules.usesKeyManager()) {
      Xss.sanitizeRender('body', `
      <br>
      <div data-test="container-err-title">Error: Insufficient Permission</div>
      <br><br>
      <div data-test="container-err-text">Please contact your IT staff if you wish to update your keys.</div>
      <br><br>
      `);
    } else {
      $('#content').show();
      this.pubLookup = new PubLookup(this.orgRules);
      [this.ki] = await KeyStore.get(this.acctEmail, [this.fingerprint]);
      Assert.abortAndRenderErrorIfKeyinfoEmpty([this.ki]);
      $('.action_show_public_key').attr('href', this.showKeyUrl);
      $('.email').text(this.acctEmail);
      $('.fingerprint').text(Str.spaced(this.ki.fingerprints[0]));
      this.inputPrivateKey.attr('placeholder', this.inputPrivateKey.attr('placeholder') + ' (' + this.ki.fingerprints[0] + ')');
    }
  };

  public setHandlers = () => {
    $('.action_update_private_key').click(this.setHandlerPrevent('double', () => this.updatePrivateKeyHandler()));
    $('.input_passphrase').keydown(this.setEnterHandlerThatClicks('.action_update_private_key'));
  };

  private storeUpdatedKeyAndPassphrase = async (updatedPrv: Key, updatedPrvPassphrase: string) => {
    const shouldSavePassphraseInStorage = !this.orgRules.forbidStoringPassPhrase() &&
      !!(await PassphraseStore.get(this.acctEmail, this.ki!, true));
    await KeyStore.add(this.acctEmail, updatedPrv);
    await PassphraseStore.set('local', this.acctEmail, this.ki!, shouldSavePassphraseInStorage ? updatedPrvPassphrase : undefined);
    await PassphraseStore.set('session', this.acctEmail, this.ki!, shouldSavePassphraseInStorage ? undefined : updatedPrvPassphrase);
    if (this.orgRules.canSubmitPubToAttester() && await Ui.modal.confirm('Public and private key updated locally.\n\nUpdate public records with new Public Key?')) {
      try {
        // todo: make sure this is never called for x509 keys
        await Ui.modal.info(await this.pubLookup.attester.updatePubkey(this.ki!.longid, KeyUtil.armor(await KeyUtil.asPublicKey(updatedPrv))));
      } catch (e) {
        ApiErr.reportIfSignificant(e);
        await Ui.modal.error(`Error updating public records:\n\n${ApiErr.eli5(e)}\n\n(but local update was successful)`);
      }
    }
    window.location.href = this.showKeyUrl;
  };

  private updatePrivateKeyHandler = async () => {
    const updatedKey = await KeyUtil.parse(String(this.inputPrivateKey.val()));
    const updatedKeyEncrypted = await KeyUtil.parse(String(this.inputPrivateKey.val()));
    const updatedKeyPassphrase = String($('.input_passphrase').val());
    if (typeof updatedKey === 'undefined') {
      await Ui.modal.warning(Lang.setup.keyFormattedWell(this.prvHeaders.begin, String(this.prvHeaders.end)), Ui.testCompatibilityLink);
    } else if (updatedKey.isPublic) {
      await Ui.modal.warning('This was a public key. Please insert a private key instead. It\'s a block of text starting with "' + this.prvHeaders.begin + '"');
    } else if (updatedKey.id !== (await KeyUtil.parse(this.ki!.public)).id) {
      await Ui.modal.warning(`This key ${Str.spaced(updatedKey.id || 'err')} does not match your current key ${Str.spaced(this.ki!.fingerprints[0])}`);
    } else if (await KeyUtil.decrypt(updatedKey, updatedKeyPassphrase) !== true) {
      await Ui.modal.error('The pass phrase does not match.\n\nPlease enter pass phrase of the newly updated key.');
    } else {
      if (updatedKey.usableForEncryption) {
        await this.storeUpdatedKeyAndPassphrase(updatedKeyEncrypted, updatedKeyPassphrase);
        return;
      }
      // cannot get a valid encryption key packet
      if (await KeyUtil.isWithoutSelfCertifications(updatedKey) || updatedKey.usableForEncryptionButExpired) { // known issues - key can be fixed
        const fixedEncryptedPrv = await Settings.renderPrvCompatFixUiAndWaitTilSubmittedByUser(
          this.acctEmail, '.compatibility_fix_container', updatedKeyEncrypted, updatedKeyPassphrase, this.showKeyUrl
        );
        await this.storeUpdatedKeyAndPassphrase(fixedEncryptedPrv, updatedKeyPassphrase);
      } else {
        await Ui.modal.warning(
          `Key update: This looks like a valid key but it cannot be used for encryption. Please ${Lang.general.contactMinimalSubsentence(!!this.fesUrl)} to see why is that.`,
          Ui.testCompatibilityLink
        );
        window.location.href = this.showKeyUrl;
      }
    }
  };

});
