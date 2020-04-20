/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { ApiErr } from '../../../js/common/api/error/api-error.js';
import { Assert } from '../../../js/common/assert.js';
import { KeyInfo } from '../../../js/common/core/pgp-key.js';
import { Lang } from '../../../js/common/lang.js';
import { PgpArmor } from '../../../js/common/core/pgp-armor.js';
import { PgpKey } from '../../../js/common/core/pgp-key.js';
import { Settings } from '../../../js/common/settings.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { Url, Str } from '../../../js/common/core/common.js';
import { View } from '../../../js/common/view.js';
import { opgp } from '../../../js/common/core/pgp.js';
import { OrgRules } from '../../../js/common/org-rules.js';
import { PubLookup } from '../../../js/common/api/pub-lookup.js';
import { KeyStore } from '../../../js/common/platform/store/key-store.js';
import { PassphraseStore } from '../../../js/common/platform/store/passphrase-store.js';
import { Catch } from '../../../js/common/platform/catch.js';

View.run(class MyKeyUpdateView extends View {

  private readonly acctEmail: string;
  private readonly fingerprint: string;
  private readonly showKeyUrl: string;
  private readonly inputPrivateKey = $('.input_private_key');
  private readonly prvHeaders = PgpArmor.headers('privateKey');
  private primaryKi: KeyInfo | undefined;
  private orgRules!: OrgRules;
  private pubLookup!: PubLookup;

  constructor() {
    super();
    const uncheckedUrlParams = Url.parse(['acctEmail', 'fingerprint', 'parentTabId']);
    this.acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
    this.fingerprint = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'fingerprint') || 'primary';
    this.showKeyUrl = Url.create('my_key.htm', uncheckedUrlParams);
  }

  public render = async () => {
    this.orgRules = await OrgRules.newInstance(this.acctEmail);
    this.pubLookup = new PubLookup(this.orgRules);
    [this.primaryKi] = await KeyStore.get(this.acctEmail, [this.fingerprint]);
    Assert.abortAndRenderErrorIfKeyinfoEmpty(this.primaryKi);
    $('.action_show_public_key').attr('href', this.showKeyUrl);
    $('.email').text(this.acctEmail);
    $('.fingerprint').text(Str.spaced(this.primaryKi.fingerprint));
    this.inputPrivateKey.attr('placeholder', this.inputPrivateKey.attr('placeholder') + ' (' + this.primaryKi.fingerprint + ')');
  }

  public setHandlers = () => {
    $('.action_update_private_key').click(this.setHandlerPrevent('double', () => this.updatePrivateKeyHandler()));
    $('.input_passphrase').keydown(this.setEnterHandlerThatClicks('.action_update_private_key'));
  }

  private storeUpdatedKeyAndPassphrase = async (updatedPrv: OpenPGP.key.Key, updatedPrvPassphrase: string) => {
    const storedPassphrase = await PassphraseStore.get(this.acctEmail, this.primaryKi!.fingerprint, true);
    await KeyStore.add(this.acctEmail, updatedPrv.armor());
    await PassphraseStore.set('local', this.acctEmail, this.primaryKi!.fingerprint, typeof storedPassphrase !== 'undefined' ? updatedPrvPassphrase : undefined);
    await PassphraseStore.set('session', this.acctEmail, this.primaryKi!.fingerprint, typeof storedPassphrase !== 'undefined' ? undefined : updatedPrvPassphrase);
    if (this.orgRules.canSubmitPubToAttester() && await Ui.modal.confirm('Public and private key updated locally.\n\nUpdate public records with new Public Key?')) {
      try {
        await Ui.modal.info(await this.pubLookup.attester.updatePubkey(this.primaryKi!.longid, updatedPrv.toPublic().armor()));
      } catch (e) {
        ApiErr.reportIfSignificant(e);
        await Ui.modal.error(`Error updating public records:\n\n${ApiErr.eli5(e)}\n\n(but local update was successful)`);
      }
    }
    window.location.href = this.showKeyUrl;
  }

  private updatePrivateKeyHandler = async () => {
    const { keys: [updatedKey] } = await opgp.key.readArmored(String(this.inputPrivateKey.val()));
    const { keys: [uddatedKeyEncrypted] } = await opgp.key.readArmored(String(this.inputPrivateKey.val()));
    const uddatedKeyPassphrase = String($('.input_passphrase').val());
    if (typeof updatedKey === 'undefined') {
      await Ui.modal.warning(Lang.setup.keyFormattedWell(this.prvHeaders.begin, String(this.prvHeaders.end)), Ui.testCompatibilityLink);
    } else if (updatedKey.isPublic()) {
      await Ui.modal.warning('This was a public key. Please insert a private key instead. It\'s a block of text starting with "' + this.prvHeaders.begin + '"');
    } else if (await PgpKey.fingerprint(updatedKey) !== await PgpKey.fingerprint(await PgpKey.parse(this.primaryKi!.public))) {
      await Ui.modal.warning(`This key ${Str.spaced(await PgpKey.fingerprint(updatedKey) || 'err')} does not match your current key ${Str.spaced(this.primaryKi!.fingerprint)}`);
    } else if (await PgpKey.decrypt(updatedKey, uddatedKeyPassphrase) !== true) {
      await Ui.modal.error('The pass phrase does not match.\n\nPlease enter pass phrase of the newly updated key.');
    } else {
      if (! await Catch.doesReject(updatedKey.getEncryptionKey())) {
        await this.storeUpdatedKeyAndPassphrase(uddatedKeyEncrypted, uddatedKeyPassphrase);
        return;
      }
      // cannot get a valid encryption key packet
      if (await Catch.doesReject(updatedKey.verifyPrimaryKey(), ['No self-certifications']) || await PgpKey.usableButExpiredOpenPGP(updatedKey)) { // known issues - key can be fixed
        const fixedEncryptedPrv = await Settings.renderPrvCompatFixUiAndWaitTilSubmittedByUser(
          this.acctEmail, '.compatibility_fix_container', uddatedKeyEncrypted, uddatedKeyPassphrase, this.showKeyUrl
        );
        await this.storeUpdatedKeyAndPassphrase(fixedEncryptedPrv, uddatedKeyPassphrase);
      } else {
        await Ui.modal.warning(
          'Key update: This looks like a valid key but it cannot be used for encryption. Email human@flowcrypt.com to see why is that. We\'re prompt to respond.',
          Ui.testCompatibilityLink
        );
        window.location.href = this.showKeyUrl;
      }
    }
  }

});
