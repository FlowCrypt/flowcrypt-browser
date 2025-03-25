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
import { KeyImportUi } from '../../../js/common/ui/key-import-ui.js';
import * as $ from 'jquery';

export class SetupRenderModule {
  public readonly emailDomainsToSkip = ['yahoo', 'live', 'outlook'];

  public constructor(private view: SetupView) {}

  public renderInitial = async (): Promise<void> => {
    $('.email-address').text(this.view.acctEmail);
    $('#button-go-back').css('visibility', 'hidden');
    if (this.view.storage.email_provider === 'gmail') {
      // show alternative account addresses in setup form + save them for later
      try {
        await Settings.refreshSendAs(this.view.acctEmail);
        const { sendAs } = await AcctStore.get(this.view.acctEmail, ['sendAs']);
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this.saveAndFillSubmitPubkeysOption(Object.keys(sendAs!));
      } catch (e) {
        await Settings.promptToRetry(
          e,
          Lang.setup.failedToLoadEmailAliases,
          () => this.renderInitial(),
          Lang.general.contactIfNeedAssistance(this.view.isCustomerUrlFesUsed())
        );
        return;
      }
    }

    if (this.view.storage.setup_done && this.view.action !== 'update_from_ekm') {
      if (this.view.action !== 'add_key') {
        await this.renderSetupDone();
      } else if (this.view.clientConfiguration.mustAutoImportOrAutogenPrvWithKeyManager()) {
        throw new Error('Manual add_key is not supported when PRV_AUTOIMPORT_OR_AUTOGEN org rule is in use');
      } else {
        await this.view.setupRecoverKey.renderAddKeyFromBackup();
      }
    } else if (this.view.clientConfiguration.getPublicKeyForPrivateKeyBackupToDesignatedMailbox() && !this.view.clientConfiguration.usesKeyManager()) {
      if (!this.view.clientConfiguration.prvKeyAutoImportOrAutogen()) {
        this.displayBlock('step_0_backup_to_designated_mailbox');
      } else {
        await Ui.modal.error('Combination of org rules not valid: prv_backup_to_designated_mailbox cannot be used together with PRV_AUTOIMPORT_OR_AUTOGEN.');
        window.location.href = Url.create('index.htm', { acctEmail: this.view.acctEmail });
        return;
      }
    } else if (this.view.clientConfiguration.mustAutoImportOrAutogenPrvWithKeyManager()) {
      if (this.view.clientConfiguration.mustAutogenPassPhraseQuietly() && this.view.clientConfiguration.forbidStoringPassPhrase()) {
        const notSupportedErr = 'Combination of org rules not valid: PASS_PHRASE_QUIET_AUTOGEN cannot be used together with FORBID_STORING_PASS_PHRASE.';
        await Ui.modal.error(notSupportedErr);
        window.location.href = Url.create('index.htm', { acctEmail: this.view.acctEmail });
        return;
      }
      if (this.view.clientConfiguration.userMustChoosePassPhraseDuringPrvAutoimport()) {
        this.displayBlock('step_2_ekm_choose_pass_phrase');
      } else {
        await this.view.setupWithEmailKeyManager.setupWithEkmThenRenderSetupDone(PgpPwd.random());
      }
    } else {
      await this.renderSetupDialog();
    }
  };

  public renderSetupDone = async () => {
    const storedKeys = await KeyStore.get(this.view.acctEmail);
    if (this.view.fetchedKeyBackupsUniqueLongids.length > storedKeys.length) {
      // recovery where not all keys were processed: some may have other pass phrase
      this.displayBlock('step_4_more_to_recover');
      $('h1').text('More keys to recover');
      $('.email').text(this.view.acctEmail);
      $('.private_key_count').text(storedKeys.length);
      $('.backups_count').text(this.view.fetchedKeyBackupsUniqueLongids.length);
    } else {
      // successful and complete setup
      if (this.view.action === 'add_key') {
        this.displayBlock('step_4_close');
        $('h1').text('Recovered all keys!');
      } else {
        this.displayBlock('step_4_done');
        $('h1').text("You're all set!");
      }
      $('.email').text(this.view.acctEmail);
    }
  };

  public displayBlock = (name: string) => {
    const blocks = [
      'loading',
      'step_0_backup_to_designated_mailbox',
      'step_0_found_key',
      'step_1_easy_or_manual',
      'step_2a_manual_create',
      'step_2b_manual_enter',
      'step_2_easy_generating',
      'step_2_recovery',
      'step_2_ekm_choose_pass_phrase',
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
        $('.backups_count_words').text(
          this.view.fetchedKeyBackupsUniqueLongids.length > 1 ? `${this.view.fetchedKeyBackupsUniqueLongids.length} backups` : 'a backup'
        );
        $('#step_2_recovery input').trigger('focus');
      }
    }
  };

  public renderSetupDialog = async (): Promise<void> => {
    let keyserverRes;
    try {
      keyserverRes = await this.view.pubLookup.lookupEmail(this.view.acctEmail);
    } catch (e) {
      await Settings.promptToRetry(
        e,
        Lang.setup.failedToCheckIfAcctUsesEncryption,
        () => this.renderSetupDialog(),
        Lang.general.contactIfNeedAssistance(this.view.isCustomerUrlFesUsed())
      );
      return;
    }
    if (keyserverRes.pubkeys.length) {
      if (!this.view.clientConfiguration.canBackupKeys()) {
        // they already have a key recorded on attester, but no backups allowed on the domain. They should enter their prv manually
        this.displayBlock('step_2b_manual_enter');
      } else if (this.view.storage.email_provider === 'gmail') {
        try {
          const backups = await this.view.gmail.fetchKeyBackups();
          this.view.fetchedKeyBackups = backups.keyinfos.backups;
          this.view.fetchedKeyBackupsUniqueLongids = backups.longids.backups;
        } catch (e) {
          await Settings.promptToRetry(
            e,
            Lang.setup.failedToCheckAccountBackups,
            () => this.renderSetupDialog(),
            Lang.general.contactIfNeedAssistance(this.view.isCustomerUrlFesUsed())
          );
          return;
        }
        if (this.view.fetchedKeyBackupsUniqueLongids.length) {
          this.displayBlock('step_2_recovery');
        } else {
          this.displayBlock('step_0_found_key');
        }
      } else {
        // cannot read gmail to find a backup, or this is outlook
        throw new Error('Not able to load backups from inbox due to missing permissions');
      }
    } else {
      // no indication that the person used pgp before
      if (this.view.clientConfiguration.canCreateKeys()) {
        this.displayBlock('step_1_easy_or_manual');
      } else {
        this.displayBlock('step_2b_manual_enter');
      }
    }
  };

  private saveAndFillSubmitPubkeysOption = (addresses: string[]) => {
    this.renderEmailAddresses(this.filterAddressesForSubmittingKeys(addresses));
  };

  private renderEmailAddresses = (addresses: string[]) => {
    $('.input_submit_all').hide();
    const emailAliases = Value.arr.withoutVal(addresses, this.view.acctEmail);
    for (const e of emailAliases) {
      $('.addresses').append(
        `<label><input type="checkbox" class="input_email_alias" data-email="${Xss.escape(e)}" data-test="input-email-alias-${e.replace(
          /[^a-z0-9]+/g,
          ''
        )}" />${Xss.escape(e)}</label><br/>`
      ); // xss-escaped
    }
    $('.input_email_alias').on('click', event => {
      const email = String($(event.target).data('email'));
      if ($(event.target).prop('checked')) {
        if (!this.view.submitKeyForAddrs.includes(email)) {
          KeyImportUi.addAliasForSubmission(email, this.view.submitKeyForAddrs);
        }
      } else {
        KeyImportUi.removeAliasFromSubmission(email, this.view.submitKeyForAddrs);
      }
    });
    if (emailAliases.length > 0) {
      $('.also_submit_alias_key_view').show();
    }
    $('.manual .input_submit_all').prop({ checked: true, disabled: false });
  };

  private filterAddressesForSubmittingKeys = (addresses: string[]): string[] => {
    const filterAddrRegEx = new RegExp(`@(${this.emailDomainsToSkip.join('|')})`);
    return addresses.filter(e => !filterAddrRegEx.test(e));
  };
}
