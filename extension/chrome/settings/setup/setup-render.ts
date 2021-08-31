/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Url, Value } from '../../../js/common/core/common.js';
import { Lang } from '../../../js/common/lang.js';
import { Settings } from '../../../js/common/settings.js';
import { SetupView } from '../setup.js';
import { AcctStore } from '../../../js/common/platform/store/acct-store.js';
import { KeyStore } from '../../../js/common/platform/store/key-store.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { PgpPwd } from '../../../js/common/core/crypto/pgp/pgp-password.js';
import { Xss } from '../../../js/common/platform/xss.js';

export class SetupRenderModule {

  public readonly emailDomainsToSkip = ['yahoo', 'live', 'outlook'];

  constructor(private view: SetupView) {
  }

  public renderInitial = async (): Promise<void> => {
    $('.email-address').text(this.view.acctEmail);
    $('#button-go-back').css('visibility', 'hidden');
    if (this.view.storage!.email_provider === 'gmail') { // show alternative account addresses in setup form + save them for later
      try {
        await Settings.refreshSendAs(this.view.acctEmail);
        const { sendAs } = await AcctStore.get(this.view.acctEmail, ['sendAs']);
        this.saveAndFillSubmitPubkeysOption(Object.keys(sendAs!));
      } catch (e) {
        return await Settings.promptToRetry(e, Lang.setup.failedToLoadEmailAliases, () => this.renderInitial());
      }
    }
    if (this.view.storage!.setup_done) {
      if (this.view.action !== 'add_key') {
        await this.renderSetupDone();
      } else if (this.view.orgRules.mustAutoImportOrAutogenPrvWithKeyManager()) {
        throw new Error('Manual add_key is not supported when PRV_AUTOIMPORT_OR_AUTOGEN org rule is in use');
      } else {
        await this.view.setupRecoverKey.renderAddKeyFromBackup();
      }
    } else if (this.view.action === 'finalize') {
      const { tmp_submit_all, tmp_submit_main } = await AcctStore.get(this.view.acctEmail, ['tmp_submit_all', 'tmp_submit_main']);
      if (typeof tmp_submit_all === 'undefined' || typeof tmp_submit_main === 'undefined') {
        $('#content').text(`Setup session expired. To set up FlowCrypt, please click the FlowCrypt icon on top right.`);
        return;
      }
      await this.view.submitPublicKeysAndFinalizeSetup({ submit_all: tmp_submit_all, submit_main: tmp_submit_main });
      await this.renderSetupDone();
    } else if (this.view.orgRules.mustAutoImportOrAutogenPrvWithKeyManager()) {
      if (this.view.orgRules.mustAutogenPassPhraseQuietly() && this.view.orgRules.forbidStoringPassPhrase()) {
        const notSupportedErr = 'Combination of org rules not valid: PASS_PHRASE_QUIET_AUTOGEN cannot be used together with FORBID_STORING_PASS_PHRASE.';
        await Ui.modal.error(notSupportedErr);
        window.location.href = Url.create('index.htm', { acctEmail: this.view.acctEmail });
        return;
      }
      if (this.view.orgRules.userMustChoosePassPhraseDuringPrvAutoimport()) {
        this.displayBlock('step_2_ekm_choose_pass_phrase');
      } else {
        await this.view.setupWithEmailKeyManager.setupWithEkmThenRenderSetupDone(PgpPwd.random());
      }
    } else {
      await this.renderSetupDialog();
    }
  }

  public renderSetupDone = async () => {
    const storedKeys = await KeyStore.get(this.view.acctEmail);
    if (this.view.fetchedKeyBackupsUniqueLongids.length > storedKeys.length) { // recovery where not all keys were processed: some may have other pass phrase
      this.displayBlock('step_4_more_to_recover');
      $('h1').text('More keys to recover');
      $('.email').text(this.view.acctEmail);
      $('.private_key_count').text(storedKeys.length);
      $('.backups_count').text(this.view.fetchedKeyBackupsUniqueLongids.length);
    } else { // successful and complete setup
      this.displayBlock(this.view.action !== 'add_key' ? 'step_4_done' : 'step_4_close');
      $('h1').text(this.view.action !== 'add_key' ? 'You\'re all set!' : 'Recovered all keys!');
      $('.email').text(this.view.acctEmail);
    }
  }

  public displayBlock = (name: string) => {
    const blocks = [
      'loading',
      'step_0_found_key',
      'step_1_easy_or_manual',
      'step_2a_manual_create', 'step_2b_manual_enter', 'step_2_easy_generating', 'step_2_recovery', 'step_2_ekm_choose_pass_phrase',
      'step_3_compatibility_fix',
      'step_4_more_to_recover',
      'step_4_done',
      'step_4_close',
    ];
    if (name) {
      $('#' + blocks.join(', #')).css('display', 'none');
      $('#' + name).css('display', 'block');
      $('#button-go-back').css('visibility', ['step_2b_manual_enter', 'step_2a_manual_create'].includes(name) ? 'visible' : 'hidden');
      if (name === 'step_2_recovery') {
        $('.backups_count_words').text(this.view.fetchedKeyBackupsUniqueLongids.length > 1 ? `${this.view.fetchedKeyBackupsUniqueLongids.length} backups` : 'a backup');
        $('#step_2_recovery input').focus();
      }
    }
  }

  public renderSetupDialog = async (): Promise<void> => {
    let keyserverRes;
    try {
      keyserverRes = await this.view.pubLookup.lookupEmail(this.view.acctEmail);
    } catch (e) {
      return await Settings.promptToRetry(e, Lang.setup.failedToCheckIfAcctUsesEncryption, () => this.renderSetupDialog());
    }
    if (keyserverRes.pubkeys.length) {
      if (!this.view.orgRules.canBackupKeys()) {
        // they already have a key recorded on attester, but no backups allowed on the domain. They should enter their prv manually
        this.displayBlock('step_2b_manual_enter');
      } else if (this.view.storage!.email_provider === 'gmail' && (this.view.scopes!.read || this.view.scopes!.modify)) {
        try {
          const backups = await this.view.gmail.fetchKeyBackups();
          this.view.fetchedKeyBackups = backups.keyinfos.backups;
          this.view.fetchedKeyBackupsUniqueLongids = backups.longids.backups;
        } catch (e) {
          return await Settings.promptToRetry(e, Lang.setup.failedToCheckAccountBackups, () => this.renderSetupDialog());
        }
        if (this.view.fetchedKeyBackupsUniqueLongids.length) {
          this.displayBlock('step_2_recovery');
        } else {
          this.displayBlock('step_0_found_key');
        }
      } else { // cannot read gmail to find a backup, or this is outlook
        throw new Error('Not able to load backups from inbox due to missing permissions');
      }
    } else { // no indication that the person used pgp before
      if (this.view.orgRules.canCreateKeys()) {
        this.displayBlock('step_1_easy_or_manual');
      } else {
        this.displayBlock('step_2b_manual_enter');
      }
    }
  }

  private saveAndFillSubmitPubkeysOption = (addresses: string[]) => {
    this.view.submitKeyForAddrs = this.filterAddressesForSubmittingKeys(addresses);
    if (this.view.submitKeyForAddrs.length > 1) {
      this.renderEmailAddresses();
    }
  }

  private renderEmailAddresses = () => {
    $('.input_submit_all').hide();
    const emailAliases = Value.arr.withoutVal(this.view.submitKeyForAddrs, this.view.acctEmail);
    for (const e of emailAliases) {
      // eslint-disable-next-line max-len
      $('.addresses').append(`<label><input type="checkbox" class="input_email_alias" checked data-test="input-email-alias-${e.replace(/[^a-z0-9]+/g, '')}" /><span>${Xss.escape(e)}</span></label><br/>`); // xss-escaped
    }
    $('.input_email_alias').click((event) => {
      const dom = event.target.nextElementSibling as HTMLElement;
      const email = dom.innerText;
      if ($(event.target).prop('checked')) {
        this.view.submitKeyForAddrs.push(email);
      } else {
        this.view.submitKeyForAddrs.splice(this.view.submitKeyForAddrs.indexOf(email), 1);
      }
    });
    $('.manual .input_submit_all').prop({ checked: true, disabled: false }).closest('div.line').css('display', 'block');
  }

  private filterAddressesForSubmittingKeys = (addresses: string[]): string[] => {
    const filterAddrRegEx = new RegExp(`@(${this.emailDomainsToSkip.join('|')})`);
    return addresses.filter(e => !filterAddrRegEx.test(e));
  }

}
