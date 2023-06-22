/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { KeyUtil, KeyInfoWithIdentity } from '../../js/common/core/crypto/key.js';
import { StorageType } from '../../js/common/platform/store/abstract-store.js';
import { Assert } from '../../js/common/assert.js';
import { BrowserMsg } from '../../js/common/browser/browser-msg.js';
import { Catch } from '../../js/common/platform/catch.js';
import { Ui } from '../../js/common/browser/ui.js';
import { Url, Str, stringTuple } from '../../js/common/core/common.js';
import { View } from '../../js/common/view.js';
import { Xss } from '../../js/common/platform/xss.js';
import { initPassphraseToggle } from '../../js/common/ui/passphrase-ui.js';
import { KeyStore } from '../../js/common/platform/store/key-store.js';
import { PassphraseStore } from '../../js/common/platform/store/passphrase-store.js';
import { Settings } from '../../js/common/settings.js';
import { ClientConfiguration } from '../../js/common/client-configuration.js';
import { Lang } from '../../js/common/lang.js';
import { AcctStore } from '../../js/common/platform/store/acct-store.js';

const ANTI_BRUTE_FORCE_PROTECTION_ATTEMPTS_MAX_VALUE = 5;
const BLOCKING_TIME_IN_MILI_SECONDS = 5 * 60 * 1000;
// const RESET_COUNT_TIME_IN_MILLISECONDS = 5 * 6000;
const passPhraseTypes = stringTuple('embedded', 'sign', 'message', 'draft', 'attachment', 'quote', 'backup', 'update_key');
type PassPhraseType = (typeof passPhraseTypes)[number];

View.run(
  class PassphraseView extends View {
    public fesUrl?: string;
    private readonly acctEmail: string;
    private readonly parentTabId: string;
    private readonly longids: string[];
    private readonly type: PassPhraseType;
    private readonly initiatorFrameId?: string;
    private keysWeNeedPassPhraseFor: KeyInfoWithIdentity[] | undefined;
    private clientConfiguration!: ClientConfiguration;
    private failedPassPhraseAttempts!: number;
    private lastUnsuccessfulPassphraseAttempt!: number;
    private previousState: undefined | boolean;
    private readonly CHECK_BRUTE_FORCE_FREQUENCY = 1000;

    public constructor() {
      super();
      const uncheckedUrlParams = Url.parse(['acctEmail', 'parentTabId', 'longids', 'type', 'initiatorFrameId']);
      this.acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
      this.parentTabId = Assert.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');
      const longidsParam = Assert.urlParamRequire.string(uncheckedUrlParams, 'longids');
      this.longids = longidsParam ? longidsParam.split(',') : [];
      this.type = Assert.urlParamRequire.oneof(uncheckedUrlParams, 'type', passPhraseTypes);
      this.initiatorFrameId = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'initiatorFrameId');
    }

    public render = async () => {
      Ui.event.protect();
      const storage = await AcctStore.get(this.acctEmail, ['fesUrl', 'failed_passphrase_attempts', 'last_unsuccessful_passphrase_attempt']);
      this.failedPassPhraseAttempts = storage.failed_passphrase_attempts ?? 0;
      this.lastUnsuccessfulPassphraseAttempt = storage.last_unsuccessful_passphrase_attempt ?? 0;
      await this.monitorBruteForceProtection();
      Catch.setHandledInterval(() => this.monitorBruteForceProtection(), this.CHECK_BRUTE_FORCE_FREQUENCY);
      this.fesUrl = storage.fesUrl;
      this.clientConfiguration = await ClientConfiguration.newInstance(this.acctEmail);
      if (!this.clientConfiguration.forbidStoringPassPhrase()) {
        $('.forget-pass-phrase-label').removeClass('hidden');
      }
      if (this.clientConfiguration.usesKeyManager() || this.clientConfiguration.forbidStoringPassPhrase()) {
        $('#lost-pass-phrase').removeAttr('id').removeAttr('href');
        $('.lost-pass-phrase-with-ekm').show();
      } else {
        $('.lost-pass-phrase').show();
      }
      await initPassphraseToggle(['passphrase']);
      const allPrivateKeys = await KeyStore.get(this.acctEmail);
      if (this.longids.length === 0) {
        this.longids.push(...allPrivateKeys.map(ki => ki.longid));
      }
      this.keysWeNeedPassPhraseFor = allPrivateKeys.filter(ki => this.longids.includes(ki.longid));
      let passphraseText = '';
      switch (this.type) {
        case 'embedded':
          $('.passphrase_text_container').hide();
          $('div.separator').hide();
          $('body#settings > div#content.dialog').css({ width: 'inherit', background: '#fafafa' });
          $('.line.which_key').css({ display: 'none', position: 'absolute', visibility: 'hidden', left: '5000px' });
          break;
        case 'sign':
          passphraseText = Lang.passphraseRequired.sign;
          break;
        case 'draft':
          passphraseText = Lang.passphraseRequired.draft;
          break;
        case 'attachment':
          passphraseText = Lang.passphraseRequired.attachment;
          break;
        case 'quote':
          passphraseText = Lang.passphraseRequired.quote;
          break;
        case 'backup':
          passphraseText = Lang.passphraseRequired.backup;
          break;
        case 'update_key':
          passphraseText = Lang.passphraseRequired.updateKey;
          break;
        default:
          passphraseText = Lang.passphraseRequired.email;
          break;
      }
      $('.passphrase_text').text(passphraseText);
      $('#passphrase').focus();
      if (allPrivateKeys.length > 1) {
        let html: string;
        if (this.keysWeNeedPassPhraseFor.length === 1) {
          html = `For key Fingerprint: <span class="good">${Xss.escape(Str.spaced(this.keysWeNeedPassPhraseFor[0].fingerprints[0] || ''))}</span>`;
        } else {
          html = 'Pass phrase needed for any of the following keys:';
          for (const i of this.keysWeNeedPassPhraseFor.keys()) {
            html += `<div>Fingerprint ${String(i + 1)}: <span class="good">${Xss.escape(
              Str.spaced(this.keysWeNeedPassPhraseFor[i].fingerprints[0]) || ''
            )}</span></div>`;
          }
        }
        Xss.sanitizeRender('.which_key', html);
        $('.which_key').css('display', 'block');
      }
      Ui.setTestState('ready');
    };

    public setHandlers = () => {
      $('#passphrase').keyup(this.setHandler(() => this.renderNormalPpPrompt()));
      $('.action_close').on(
        'click',
        this.setHandler(() => this.closeDialog())
      );
      $('.action_ok').on(
        'click',
        this.setHandler(() => this.submitHandler())
      );
      $('#lost-pass-phrase').on(
        'click',
        this.setHandler((el, ev) => {
          ev.preventDefault();
          Ui.modal
            .info(
              `
        <div style="text-align: initial">
          <strong>Do you have at least one other working device where
          you can still read your encrypted email?</strong>
          <p><strong>If yes:</strong> open the working device and go to
          <code>FlowCrypt Settings</code> > <code>Security</code> >
          <code>Change Pass Phrase</code>.<br>
          It will let you change it without knowing the previous one. When done,
          <a href class="reset-flowcrypt">reset FlowCrypt on this device</a>
          and use the new pass phrase during the recovery step when
          you set up FlowCrypt on this device again.
          <p><strong>If no:</strong> unfortunately, you will not be able to read
          previously encrypted emails regardless of what you do.
          You can <a href class="reset-flowcrypt">reset FlowCrypt on this device</a>
          and then click <code>Lost your pass phrase?</code> during recovery step.
        </div>
      `,
              true
            )
            .catch(Catch.reportErr);
          $('.reset-flowcrypt').on(
            'click',
            this.setHandler(async (el, ev) => {
              ev.preventDefault();
              if (await Settings.resetAccount(this.acctEmail)) {
                this.closeDialog();
              }
            })
          );
        })
      );
      $('#passphrase').keydown(
        this.setHandler((el, ev) => {
          if (ev.key === 'Enter') {
            $('.action_ok').trigger('click');
          }
        })
      );
      $('body').on(
        'keydown',
        this.setHandler((el, ev) => {
          if (ev.key === 'Escape') {
            this.closeDialog();
          }
        })
      );
    };

    private renderBruteForceProtectionAlert(): void {
      const now = new Date().valueOf();
      const remainingTimeInSeconds = (this.lastUnsuccessfulPassphraseAttempt + BLOCKING_TIME_IN_MILI_SECONDS - now) / 1000;

      $('.passphrase_attempts_introduce_label').text(Lang.pgpBlock.passphraseAntiBruteForceProtectionHint).show();

      $('.action_ok').text(this.formatTime(remainingTimeInSeconds));
      $('.action_ok').addClass('btn_disabled').attr('disabled', 'disabled');
    }

    private dismissBruteForceProtectionAlert(): void {
      if (this.failedPassPhraseAttempts === 0) {
        $('.passphrase_attempts_introduce_label').hide();
      }
      $('.action_ok').text('OK');
      $('.action_ok').removeClass('btn_disabled').removeAttr('disabled');
    }

    private formatTime(remainingTimeInSeconds: number): string {
      const minutes = Math.floor(remainingTimeInSeconds / 60);
      const seconds = Math.floor(remainingTimeInSeconds % 60);
      return `${minutes < 10 ? '0' + minutes : minutes}:${seconds < 10 ? '0' + seconds : seconds}`;
    }

    /**
     * Monitor the status of anti-brute-force protection and manage the display of alerts.
     */
    private monitorBruteForceProtection = async (): Promise<void> => {
      const isPassphraseCheckDisabled = await this.shouldDisablePassphraseCheck();

      // Check if the state has changed or if we need to update the timer.
      // This condition ensures the brute force protection alert is only rendered or dismissed
      // when the state actually changes or when an update to the timer value is required.
      if (isPassphraseCheckDisabled !== this.previousState || (this.previousState && isPassphraseCheckDisabled)) {
        this.previousState = isPassphraseCheckDisabled;
        if (isPassphraseCheckDisabled) {
          this.renderBruteForceProtectionAlert();
        } else {
          this.dismissBruteForceProtectionAlert();
        }
      }
    };

    private updateRemainingAttemptsLabel = (): void => {
      $('.passphrase_attempts_introduce_label').show();
      const remainingAttempts = ANTI_BRUTE_FORCE_PROTECTION_ATTEMPTS_MAX_VALUE - this.failedPassPhraseAttempts;
      $('.passphrase_attempts_introduce_label').html(Lang.pgpBlock.passphraseAttemptIntroduce(Str.pluralize(remainingAttempts, 'attempt')));
    };

    private shouldDisablePassphraseCheck = async () => {
      const now = new Date().valueOf();
      // already passed anti-brute force 5 minute cooldown period
      // reset last unsuccessful count
      if (
        now > this.lastUnsuccessfulPassphraseAttempt + BLOCKING_TIME_IN_MILI_SECONDS &&
        this.failedPassPhraseAttempts >= ANTI_BRUTE_FORCE_PROTECTION_ATTEMPTS_MAX_VALUE
      ) {
        await AcctStore.set(this.acctEmail, {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          failed_passphrase_attempts: 0,
        });
        this.failedPassPhraseAttempts = 0;
      }
      return this.failedPassPhraseAttempts >= ANTI_BRUTE_FORCE_PROTECTION_ATTEMPTS_MAX_VALUE;
    };

    private renderNormalPpPrompt = () => {
      $('#passphrase').css('border-color', '');
      $('#passphrase').css('color', 'black');
      $('#passphrase').focus();
    };

    private renderFailedEntryPpPrompt = () => {
      $('#passphrase').val('');
      $('#passphrase').css('border-color', 'red');
      $('#passphrase').css('color', 'red');
      $('#passphrase').attr('placeholder', 'Please try again');
    };

    private closeDialog = (entered = false, initiatorFrameId?: string) => {
      BrowserMsg.send.closeDialog(this.parentTabId);
      BrowserMsg.send.passphraseEntry('broadcast', { entered, initiatorFrameId });
    };

    private submitHandler = async () => {
      if (await this.shouldDisablePassphraseCheck()) {
        return;
      }
      const pass = String($('#passphrase').val());
      const storageType: StorageType =
        $('.forget-pass-phrase-checkbox').prop('checked') || this.clientConfiguration.forbidStoringPassPhrase() ? 'session' : 'local';
      let atLeastOneMatched = false;
      let unlockCount = 0; // may include non-matching keys
      const allPrivateKeys = await KeyStore.get(this.acctEmail);
      for (const keyinfo of allPrivateKeys) {
        // if passphrase matches more keys, it will save the pass phrase for all keys
        const prv = await KeyUtil.parse(keyinfo.private);
        try {
          if ((await KeyUtil.decrypt(prv, pass)) === true) {
            unlockCount++;
            await PassphraseStore.set(storageType, this.acctEmail, keyinfo, pass);
            if (this.longids.includes(keyinfo.longid)) {
              atLeastOneMatched = true;
            }
            if (storageType === 'session') {
              // TODO: change to 'broadcast' when issue with 'broadcast' is fixed
              BrowserMsg.send.addEndSessionBtn(this.parentTabId);
            }
          }
        } catch (e) {
          if (e instanceof Error && e.message === 'Unknown s2k type.') {
            let msg = `Your key with fingerprint ${keyinfo.fingerprints[0]} is not supported yet (${String(e)}).`;
            msg += `\n\nPlease ${Lang.general.contactMinimalSubsentence(!!this.fesUrl)} with details about how this key was created.`;
            await Ui.modal.error(msg);
          } else {
            throw e;
          }
        }
      }
      if (unlockCount && allPrivateKeys.length > 1) {
        Ui.toast(`${unlockCount} of ${allPrivateKeys.length} keys ${unlockCount > 1 ? 'were' : 'was'} unlocked by this pass phrase`);
      }
      if (atLeastOneMatched) {
        await AcctStore.remove(this.acctEmail, ['last_unsuccessful_passphrase_attempt']);
        await AcctStore.set(this.acctEmail, {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          failed_passphrase_attempts: 0,
        });
        this.closeDialog(true, this.initiatorFrameId);
      } else {
        await AcctStore.set(this.acctEmail, {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          failed_passphrase_attempts: this.failedPassPhraseAttempts + 1,
          // eslint-disable-next-line @typescript-eslint/naming-convention
          last_unsuccessful_passphrase_attempt: new Date().valueOf(),
        });
        this.failedPassPhraseAttempts += 1;
        this.lastUnsuccessfulPassphraseAttempt = new Date().valueOf();
        this.updateRemainingAttemptsLabel();
        this.renderFailedEntryPpPrompt();
        Catch.setHandledTimeout(() => this.renderNormalPpPrompt(), 1500);
      }
    };
  }
);
