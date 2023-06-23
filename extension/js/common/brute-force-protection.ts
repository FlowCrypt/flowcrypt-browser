/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { Str } from './core/common.js';
import { Lang } from './lang.js';
import { Catch } from './platform/catch.js';
import { AcctStore } from './platform/store/acct-store.js';

const SUBMIT_BUTTON_SELECTOR = '.action_ok, .action_test_current_passphrase, .action_verify, .action_show_public_key';
const PASSPHRASE_ATTEMPTS_INTRODUCE_SELECTOR = '.passphrase_attempts_introduce_label';
const ANTI_BRUTE_FORCE_PROTECTION_ATTEMPTS_MAX_VALUE = 5;
const BLOCKING_TIME_IN_MILI_SECONDS = 5 * 60 * 1000;

export class BruteForceProtection {
  private acctEmail!: string;
  private failedPassPhraseAttempts!: number;
  private lastUnsuccessfulPassphraseAttempt!: number;
  private previousState: undefined | boolean;
  private submitButtonText = '';
  private readonly CHECK_BRUTE_FORCE_FREQUENCY = 1000;

  public constructor(acctEmail: string) {
    this.acctEmail = acctEmail;
  }

  public init = async () => {
    const storage = await AcctStore.get(this.acctEmail, ['fesUrl', 'failed_passphrase_attempts', 'last_unsuccessful_passphrase_attempt']);
    this.submitButtonText = $(SUBMIT_BUTTON_SELECTOR).text();
    this.failedPassPhraseAttempts = storage.failed_passphrase_attempts ?? 0;
    this.lastUnsuccessfulPassphraseAttempt = storage.last_unsuccessful_passphrase_attempt ?? 0;
    await this.monitorBruteForceProtection();
    Catch.setHandledInterval(() => this.monitorBruteForceProtection(), this.CHECK_BRUTE_FORCE_FREQUENCY);
  };

  public passphraseCheckFailed = async () => {
    await AcctStore.set(this.acctEmail, {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      failed_passphrase_attempts: this.failedPassPhraseAttempts + 1,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      last_unsuccessful_passphrase_attempt: new Date().valueOf(),
    });
    this.failedPassPhraseAttempts += 1;
    this.lastUnsuccessfulPassphraseAttempt = new Date().valueOf();
    this.updateRemainingAttemptsLabel();
  };

  public passphraseCheckSucceed = async () => {
    await AcctStore.set(this.acctEmail, {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      failed_passphrase_attempts: 0,
    });
    await AcctStore.remove(this.acctEmail, ['last_unsuccessful_passphrase_attempt']);
  };

  public shouldDisablePassphraseCheck = async () => {
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

  private renderBruteForceProtectionAlert = () => {
    const now = new Date().valueOf();
    const remainingTimeInSeconds = (this.lastUnsuccessfulPassphraseAttempt + BLOCKING_TIME_IN_MILI_SECONDS - now) / 1000;

    $(PASSPHRASE_ATTEMPTS_INTRODUCE_SELECTOR).text(Lang.pgpBlock.passphraseAntiBruteForceProtectionHint).show();

    $(SUBMIT_BUTTON_SELECTOR).text(this.formatTime(remainingTimeInSeconds));
    $(SUBMIT_BUTTON_SELECTOR).addClass('btn_disabled').attr('disabled', 'disabled');
  };

  private dismissBruteForceProtectionAlert = () => {
    if (this.failedPassPhraseAttempts === 0) {
      $(PASSPHRASE_ATTEMPTS_INTRODUCE_SELECTOR).hide();
    }
    $(SUBMIT_BUTTON_SELECTOR).text(this.submitButtonText);
    $(SUBMIT_BUTTON_SELECTOR).removeClass('btn_disabled').removeAttr('disabled');
  };

  private formatTime = (remainingTimeInSeconds: number): string => {
    const minutes = Math.floor(remainingTimeInSeconds / 60);
    const seconds = Math.floor(remainingTimeInSeconds % 60);
    return `${minutes < 10 ? '0' + minutes : minutes}:${seconds < 10 ? '0' + seconds : seconds}`;
  };

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
    const text = Lang.pgpBlock.passphraseAttemptIntroduce(Str.pluralize(remainingAttempts, 'attempt'));
    $('.passphrase_attempts_introduce_label').html(text); // xss-sanitized
  };
}
