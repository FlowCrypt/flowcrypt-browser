/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Value } from '../../../js/common/core/common.js';
import { Lang } from '../../../js/common/lang.js';
import { PgpKey } from '../../../js/common/core/pgp-key.js';
import { Settings } from '../../../js/common/settings.js';
import { SetupView } from '../setup.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { AcctStore } from '../../../js/common/platform/store/acct-store.js';
import { KeyStore } from '../../../js/common/platform/store/key-store.js';

export class SetupRenderModule {

  public readonly emailDomainsToSkip = ['yahoo', 'live', 'outlook'];

  constructor(private view: SetupView) {
  }

  public renderInitial = async (): Promise<void> => {
    $('h1').text('Set Up FlowCrypt');
    $('.email-address').text(this.view.acctEmail);
    $('.back').css('visibility', 'hidden');
    if (this.view.storage!.email_provider === 'gmail') { // show alternative account addresses in setup form + save them for later
      try {
        await Settings.refreshSendAs(this.view.acctEmail);
        const { sendAs } = await AcctStore.getAcct(this.view.acctEmail, ['sendAs']);
        this.saveAndFillSubmitPubkeysOption(Object.keys(sendAs!));
      } catch (e) {
        return await Settings.promptToRetry('REQUIRED', e, Lang.setup.failedToLoadEmailAliases, () => this.renderInitial());
      }
      $('.auth_denied_warning').toggleClass('hidden', this.view.scopes!.read || this.view.scopes!.modify);
    }
    if (this.view.storage!.setup_done) {
      if (this.view.action !== 'add_key') {
        await this.renderSetupDone();
      } else {
        await this.view.setupRecoverKey.renderAddKeyFromBackup();
      }
    } else if (this.view.action === 'finalize') {
      const { tmp_submit_all, tmp_submit_main } = await AcctStore.getAcct(this.view.acctEmail, ['tmp_submit_all', 'tmp_submit_main']);
      if (typeof tmp_submit_all === 'undefined' || typeof tmp_submit_main === 'undefined') {
        $('#content').text(`Setup session expired. To set up FlowCrypt, please click the FlowCrypt icon on top right.`);
        return;
      }
      await this.view.finalizeSetup({ submit_all: tmp_submit_all, submit_main: tmp_submit_main });
      await this.renderSetupDone();
    } else {
      await this.renderSetupDialog();
    }
  }

  public renderSetupDone = async () => {
    const storedKeys = await KeyStore.keysGet(this.view.acctEmail);
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
      'step_2a_manual_create', 'step_2b_manual_enter', 'step_2_easy_generating', 'step_2_recovery',
      'step_3_compatibility_fix',
      'step_4_more_to_recover',
      'step_4_done',
      'step_4_close',
    ];
    if (name) {
      $('#' + blocks.join(', #')).css('display', 'none');
      $('#' + name).css('display', 'block');
      $('.back').css('visibility', ['step_2b_manual_enter', 'step_2a_manual_create'].includes(name) ? 'visible' : 'hidden');
      if (name === 'step_2_recovery') {
        $('.backups_count_words').text(this.view.fetchedKeyBackupsUniqueLongids.length > 1 ? `${this.view.fetchedKeyBackupsUniqueLongids.length} backups` : 'a backup');
      }
    }
  }

  public renderSetupDialog = async (): Promise<void> => {
    let keyserverRes;
    try {
      keyserverRes = await this.view.keyserver.lookupEmail(this.view.acctEmail);
    } catch (e) {
      return await Settings.promptToRetry('REQUIRED', e, Lang.setup.failedToCheckIfAcctUsesEncryption, () => this.renderSetupDialog());
    }
    if (keyserverRes.pubkey) {
      this.view.acctEmailAttesterLongid = await PgpKey.longid(keyserverRes.pubkey);
      if (!this.view.rules.canBackupKeys()) {
        // they already have a key recorded on attester, but no backups allowed on the domain. They should enter their prv manually
        this.displayBlock('step_2b_manual_enter');
      } else if (this.view.storage!.email_provider === 'gmail' && (this.view.scopes!.read || this.view.scopes!.modify)) {
        try {
          const backups = await this.view.gmail.fetchKeyBackups();
          this.view.fetchedKeyBackups = backups.keyinfos.backups;
          this.view.fetchedKeyBackupsUniqueLongids = backups.longids.backups;
        } catch (e) {
          return await Settings.promptToRetry('REQUIRED', e, Lang.setup.failedToCheckAccountBackups, () => this.renderSetupDialog());
        }
        if (this.view.fetchedKeyBackupsUniqueLongids.length) {
          this.displayBlock('step_2_recovery');
        } else {
          this.displayBlock('step_0_found_key');
        }
      } else { // cannot read gmail to find a backup, or this is outlook
        if (keyserverRes.pgpClient === 'flowcrypt') {
          // a key has been created, and the user has used cryptup in the past - this suggest they likely have a backup available, but we cannot fetch it. Enter it manually
          this.displayBlock('step_2b_manual_enter');
          Xss.sanitizePrepend('#step_2b_manual_enter', `<div class="line red">${Lang.setup.cannotLocateBackupPasteManually}<br/><br/></div>`);
        } else if (this.view.rules.canCreateKeys()) {
          // has a key registered, key creating allowed on the domain. This may be old key from PKS, let them choose
          this.displayBlock('step_1_easy_or_manual');
        } else {
          // has a key registered, no key creating allowed on the domain
          this.displayBlock('step_2b_manual_enter');
        }
      }
    } else { // no indication that the person used pgp before
      if (this.view.rules.canCreateKeys()) {
        this.displayBlock('step_1_easy_or_manual');
      } else {
        this.displayBlock('step_2b_manual_enter');
      }
    }
  }

  private saveAndFillSubmitPubkeysOption = (addresses: string[]) => {
    this.view.submitKeyForAddrs = this.filterAddressesForSubmittingKeys(addresses);
    if (this.view.submitKeyForAddrs.length > 1) {
      $('.addresses').text(Value.arr.withoutVal(this.view.submitKeyForAddrs, this.view.acctEmail).join(', '));
      $('.manual .input_submit_all').prop({ checked: true, disabled: false }).closest('div.line').css('display', 'block');
    }
  }

  private filterAddressesForSubmittingKeys = (addresses: string[]): string[] => {
    const filterAddrRegEx = new RegExp(`@(${this.emailDomainsToSkip.join('|')})`);
    return addresses.filter(e => !filterAddrRegEx.test(e));
  }

}
