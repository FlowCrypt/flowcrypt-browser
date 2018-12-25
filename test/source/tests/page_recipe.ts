
import { BrowserHandle, ControllablePage, ControllableFrame, Controllable, Url, gmailSeq } from '../browser';
import { Util, Config } from '../util';
import { expect } from 'chai';

export class PageRecipe {

}

export class SetupPageRecipe extends PageRecipe {

  private static createBegin = async (settingsPage: ControllablePage, keyTitle: string, { usedPgpBefore = false }: { usedPgpBefore?: boolean } = {}) => {
    const k = Config.key(keyTitle);
    if (usedPgpBefore) {
      await settingsPage.waitAndClick('@action-step0foundkey-choose-manual-create');
    } else {
      await settingsPage.waitAndClick('@action-step1easyormanual-choose-manual-create');
    }
    await settingsPage.waitAndType('@input-step2bmanualcreate-passphrase-1', k.passphrase);
    await settingsPage.waitAndType('@input-step2bmanualcreate-passphrase-2', k.passphrase);
  }

  // public static setup_create_simple = async (settingsPage: ControllablePage, key_title: string, {used_pgp_before=false}: {used_pgp_before?: boolean}={}) => {
  //   await PageRecipe.setup_create_begin(settingsPage, key_title, {used_pgp_before});
  //   await settingsPage.wait_and_click('@input-step2bmanualcreate-create-and-save');
  //   await settingsPage.wait_and_click('@action-backup-....');
  //   // todo
  //   await settingsPage.wait_and_click('@action-step4done-account-settings');
  // }

  // tslint:disable-next-line:max-line-length
  public static createAdvanced = async (settingsPage: ControllablePage, keyTitle: string, backup: "none" | "email" | "file", { usedPgpBefore = false, submitPubkey = false }: { usedPgpBefore?: boolean, submitPubkey?: boolean } = {}) => {
    await SetupPageRecipe.createBegin(settingsPage, keyTitle, { usedPgpBefore });
    await settingsPage.waitAndClick('@action-step2bmanualcreate-show-advanced-create-settings'); // unfold
    await settingsPage.waitAndClick('@input-step2bmanualcreate-backup-inbox'); // uncheck
    if (!submitPubkey) {
      await settingsPage.waitAndClick('@input-step2bmanualcreate-submit-pubkey'); // uncheck
    }
    await settingsPage.waitAndClick('@input-step2bmanualcreate-create-and-save');
    if (backup === 'none') {
      await settingsPage.waitAll('@input-backup-step3manual-no-backup', { timeout: 40 });
      await settingsPage.waitAndClick('@input-backup-step3manual-no-backup');
    } else if (backup === 'email') {
      throw new Error('tests.setup_manual_create options.backup=email not implemented');
    } else if (backup === 'file') {
      throw new Error('tests.setup_manual_create options.backup=file not implemented');
    }
    await settingsPage.waitAndClick('@action-backup-step3manual-continue');
    await settingsPage.waitAndClick('@action-step4done-account-settings');
  }

  // tslint:disable-next-line:max-line-length
  public static manualEnter = async (settingsPage: ControllablePage, keyTitle: string, { usedPgpBefore = false, submitPubkey = false, fixKey = false, naked = false, genPp = false }: { usedPgpBefore?: boolean, submitPubkey?: boolean, fixKey?: boolean, naked?: boolean, genPp?: boolean } = {}) => {
    const k = Config.key(keyTitle);
    if (usedPgpBefore) {
      await settingsPage.waitAndClick('@action-step0foundkey-choose-manual-enter');
    } else {
      await settingsPage.waitAndClick('@action-step1easyormanual-choose-manual-enter');
    }
    await settingsPage.waitAndClick('@input-step2bmanualenter-source-paste');
    await settingsPage.waitAndType('@input-step2bmanualenter-ascii-key', k.armored || '');
    await settingsPage.waitAndClick('@input-step2bmanualenter-passphrase'); // blur ascii key input
    if (!naked) {
      await Util.sleep(1);
      await settingsPage.notPresent('@action-step2bmanualenter-new-random-passphrase');
      await settingsPage.waitAndType('@input-step2bmanualenter-passphrase', k.passphrase);
    } else {
      await settingsPage.waitAndClick('@input-step2bmanualenter-passphrase');
      await settingsPage.waitAll('@action-step2bmanualenter-new-random-passphrase', { visible: true });
      if (genPp) {
        await settingsPage.waitAndClick('@action-step2bmanualenter-new-random-passphrase');
        await Util.sleep(1);
        const generatedPp = await settingsPage.value('@input-step2bmanualenter-passphrase');
        if (!/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(generatedPp)) {
          throw new Error(`Import naked key page did not generate proper pass phrase, instead got: ${generatedPp}`);
        }
      } else {
        await settingsPage.waitAndType('@input-step2bmanualenter-passphrase', k.passphrase);
      }
    }
    if (!submitPubkey) {
      await settingsPage.waitAndClick('@input-step2bmanualenter-submit-pubkey'); // uncheck
    }
    await settingsPage.waitAndClick('@input-step2bmanualenter-save', { delay: 1 });
    if (fixKey) {
      await settingsPage.waitAll('@input-compatibility-fix-expire-years');
      await settingsPage.selectOption('@input-compatibility-fix-expire-years', '1');
      await settingsPage.waitAndClick('@action-fix-and-import-key');
    }
    await settingsPage.waitAndClick('@action-step4done-account-settings');
  }

  // tslint:disable-next-line:max-line-length
  public static recover = async (settingsPage: ControllablePage, keyTitle: string, { wrongPp = false, clickRecoverMore = false, hasRecoverMore = false, alreadyRecovered = false }: { wrongPp?: boolean, clickRecoverMore?: boolean, hasRecoverMore?: boolean, alreadyRecovered?: boolean } = {}) => {
    const k = Config.key(keyTitle);
    await settingsPage.waitAndType('@input-recovery-pass-phrase', k.passphrase);
    if (wrongPp) {
      const dialog = await settingsPage.triggerAndWaitNewAlert(() => settingsPage.waitAndClick('@action-recover-account'));
      // todo - read the contents - wrong pp
      await dialog.accept();
    } else if (alreadyRecovered) {
      const dialog = await settingsPage.triggerAndWaitNewAlert(() => settingsPage.waitAndClick('@action-recover-account'));
      // todo - read the contents - already recovered
      await dialog.accept();
    } else {
      await settingsPage.waitAndClick('@action-recover-account');
      await settingsPage.waitAny(['@action-step4more-account-settings', '@action-step4done-account-settings'], { timeout: 60 });
      if (hasRecoverMore) {
        await settingsPage.waitAll(['@action-step4more-account-settings', '@action-step4more-recover-remaining']);
        if (clickRecoverMore) {
          await settingsPage.waitAndClick('@action-step4more-recover-remaining');
        } else {
          await settingsPage.waitAndClick('@action-step4more-account-settings');
        }
      } else {
        await settingsPage.waitAll('@action-step4done-account-settings');
        if (clickRecoverMore) {
          throw new Error('Invalid options chosen: has_recover_more: false, click_recover_more: true');
        } else {
          await settingsPage.waitAndClick('@action-step4done-account-settings');
        }
      }
    }
  }

}

export class SettingsPageRecipe extends PageRecipe {

  public static toggleScreen = async (settingsPage: ControllablePage, to: "basic" | "additional") => {
    await Util.sleep(0.5);
    await settingsPage.waitAndClick(to === 'basic' ? '@action-toggle-screen-basic' : '@action-toggle-screen-additional'); // switch
    await Util.sleep(0.5);
    await settingsPage.waitAll(to === 'basic' ? '@action-toggle-screen-additional' : '@action-toggle-screen-basic'); // wait for opposite button to show up
    await Util.sleep(0.5);
  }

  public static closeDialog = async (settingsPage: ControllablePage) => {
    await settingsPage.waitAndClick('@dialog-close');
    await settingsPage.waitTillGone('@dialog');
  }

  public static awaitNewPageFrame = async (settingsPage: ControllablePage, actionBtnSel: string, frameUrlFilter: string[]): Promise<ControllableFrame> => {
    await settingsPage.waitAndClick(actionBtnSel);
    await settingsPage.waitAll('@dialog');
    return await settingsPage.getFrame(frameUrlFilter); // placement=settings to differentiate from mini-security frame in settings
  }

  public static swithAcct = async (settingsPage: ControllablePage, acctEmail: string) => {
    await settingsPage.waitAndClick('@action-toggle-accounts-menu');
    await settingsPage.waitAndClick(`@action-switch-to-account(${acctEmail})`);
  }

  public static changePassphraseRequirement = async (settingsPage: ControllablePage, passphrase: string, outcome: "session" | "storage") => {
    const securityFrame = await SettingsPageRecipe.awaitNewPageFrame(settingsPage, '@action-open-security-page', ['security.htm', 'placement=settings']);
    await securityFrame.waitAll('@input-toggle-require-pass-phrase');
    await Util.sleep(1); // wait for form to init / fill
    let requirePassphraseIsChecked = await securityFrame.isChecked('@input-toggle-require-pass-phrase');
    if (requirePassphraseIsChecked && outcome === 'session') {
      throw new Error('change_pass_phrase_requirement: already checked to be in session only');
    }
    if (!requirePassphraseIsChecked && outcome === 'storage') {
      throw new Error('change_pass_phrase_requirement: already checked to be in storage');
    }
    await securityFrame.click('@input-toggle-require-pass-phrase');
    await securityFrame.waitAndType('@input-confirm-pass-phrase', passphrase);
    await securityFrame.waitAndClick('@action-confirm-pass-phrase-requirement-change');
    await Util.sleep(1); // frame will now reload
    await securityFrame.waitAll('@input-toggle-require-pass-phrase');
    await Util.sleep(1); // wait to init
    requirePassphraseIsChecked = await securityFrame.isChecked('@input-toggle-require-pass-phrase');
    if (!requirePassphraseIsChecked && outcome === 'session') {
      throw new Error('change_pass_phrase_requirement: did not remember to only save in sesion');
    }
    if (requirePassphraseIsChecked && outcome === 'storage') {
      throw new Error('change_pass_phrase_requirement: did not remember to save in storage');
    }
    await SettingsPageRecipe.closeDialog(settingsPage);
  }

  public static verifyMyKeyPage = async (settingsPage: ControllablePage, expectedKeyName: string, trigger: "button" | "link", linkIndex?: number) => {
    await SettingsPageRecipe.toggleScreen(settingsPage, 'additional');
    const myKeyFrame = await SettingsPageRecipe.awaitNewPageFrame(settingsPage,
      trigger === 'button' ? '@action-open-pubkey-page' : `@action-show-key-${linkIndex}`, ['my_key.htm', 'placement=settings']);
    await Util.sleep(1);
    const k = Config.key(expectedKeyName);
    await myKeyFrame.waitAll(['@content-key-words', '@content-armored-key']);
    expect(await myKeyFrame.read('@content-key-words')).to.equal(k.keywords);
    await myKeyFrame.waitAndClick('@action-toggle-key-type(show private key)');
    expect(await myKeyFrame.read('@content-armored-key')).to.contain('-----BEGIN PGP PRIVATE KEY BLOCK-----');
    await myKeyFrame.waitAndClick('@action-toggle-key-type(show public key)');
    await SettingsPageRecipe.closeDialog(settingsPage);
    await SettingsPageRecipe.toggleScreen(settingsPage, 'basic');
  }

  public static passphraseTest = async (settingsPage: ControllablePage, passphrase: string, expectMatch: boolean) => {
    const securityFrame = await SettingsPageRecipe.awaitNewPageFrame(settingsPage, '@action-open-security-page', ['security.htm', 'placement=settings']);
    await securityFrame.waitAndClick('@action-test-passphrase-begin');
    await securityFrame.waitAndType('@input-test-passphrase', passphrase);
    const click = () => securityFrame.waitAndClick('@action-test-passphrase');
    if (expectMatch) {
      await click();
      await securityFrame.waitAndClick('@action-test-passphrase-successful-close');
    } else {
      const dialog = await settingsPage.triggerAndWaitNewAlert(click);
      await dialog.accept();
      await SettingsPageRecipe.closeDialog(settingsPage);
    }
    await settingsPage.waitTillGone('@dialog');
  }

}

export class ComposePageRecipe extends PageRecipe {

  public static openStandalone = async (browser: BrowserHandle): Promise<ControllablePage> => {
    const composePage = await browser.newPage('chrome/elements/compose.htm?account_email=flowcrypt.compatibility%40gmail.com&parent_tab_id=0&frameId=none');
    await composePage.waitAll(['@input-body', '@input-to', '@input-subject', '@action-send']);
    await composePage.waitForSelTestState('ready');
    return composePage;
  }

  public static openInSettings = async (settingsPage: ControllablePage): Promise<ControllableFrame> => {
    await settingsPage.waitAndClick('@action-show-compose-page');
    await settingsPage.waitAll('@dialog');
    const composeFrame = await settingsPage.getFrame(['compose.htm']);
    await composeFrame.waitAll(['@input-body', '@input-to', '@input-subject', '@action-send']);
    await composeFrame.waitForSelTestState('ready');
    return composeFrame;
  }

  public static changeDefSendingAddr = async (composePage: ControllablePage, newDef: string) => {
    await composePage.waitAndClick('@action-open-sending-address-settings');
    await composePage.waitAll('@dialog');
    const sendingAddrFrame = await composePage.getFrame(['sending_address.htm']);
    await sendingAddrFrame.waitAndClick(`@action-choose-address(${newDef})`);
    await Util.sleep(0.5); // page reload
    await sendingAddrFrame.waitAndClick('@action-close-sending-address-settings');
    await composePage.waitTillGone('@dialog');
  }

  public static fillMsg = async (composePageOrFrame: Controllable, to: string | null, subject: string) => {
    if (to) {
      await composePageOrFrame.type('@input-to', to);
    }
    await composePageOrFrame.click('@input-subject');
    await composePageOrFrame.type('@input-subject', `Automated puppeteer test: ${subject}`);
    await composePageOrFrame.type('@input-body', `This is an automated puppeteer test: ${subject}`);
  }

  public static sendAndClose = async (composePage: ControllablePage, password?: string | undefined) => {
    if (password) {
      await composePage.waitAndType('@input-password', 'test-pass');
      await composePage.waitAndClick('@action-send', { delay: 0.5 }); // in real usage, also have to click two times when using password - why?
    }
    await composePage.waitAndClick('@action-send', { delay: 0.5 });
    await composePage.waitForSelTestState('closed', 60); // wait until page closed
    await composePage.close();
  }

}

export class OauthPageRecipe extends PageRecipe {

  private static oauthPwdDelay = 2;
  private static longTimeout = 40;

  public static google = async (oauthPage: ControllablePage, acctEmail: string, action: "close" | "deny" | "approve"): Promise<void> => {
    const selectors = {
      backup_email_verification_choice: "//div[@class='vdE7Oc' and text() = 'Confirm your recovery email']",
      approve_button: '#submit_approve_access',
    };
    const auth = Config.secrets.auth.google.filter(a => a.email === acctEmail)[0];
    await oauthPage.waitAll('#Email, #submit_approve_access, #identifierId, .w6VTHd, .bLzI3e .k6Zj8d');
    if (await oauthPage.target.$('#Email') !== null) { // 2016-style login
      await oauthPage.waitAll('#Email', { timeout: OauthPageRecipe.longTimeout });
      await oauthPage.waitAndType('#Email', auth.email);
      await oauthPage.waitAndClick('#next');
      await oauthPage.waitForNavigationIfAny();
      await Util.sleep(OauthPageRecipe.oauthPwdDelay);
      await oauthPage.waitAndType('#Passwd', auth.password, { delay: OauthPageRecipe.oauthPwdDelay });
      await oauthPage.waitForNavigationIfAny();
      await oauthPage.waitAndClick('#signIn', { delay: 1 });
      await oauthPage.waitForNavigationIfAny();
    } else if (await oauthPage.target.$('#identifierId') !== null) { // 2017-style login
      await oauthPage.waitAll('#identifierId', { timeout: OauthPageRecipe.longTimeout });
      await oauthPage.waitAndType('#identifierId', auth.email, { delay: 2 });
      await oauthPage.waitAndClick('.zZhnYe', { delay: 2 });  // confirm email
      await oauthPage.waitForNavigationIfAny();
      await Util.sleep(OauthPageRecipe.oauthPwdDelay);
      await oauthPage.waitAndType('.zHQkBf', auth.password, { delay: OauthPageRecipe.oauthPwdDelay });
      await oauthPage.waitAndClick('.CwaK9', { delay: 1 });  // confirm password
      await oauthPage.waitForNavigationIfAny();
    } else if (await oauthPage.target.$('.w6VTHd') !== null) { // select from accounts where already logged in
      await oauthPage.waitAndClick('.bLzI3e', { delay: 1 }); // choose other account, also try .TnvOCe .k6Zj8d .XraQ3b
      await Util.sleep(2);
      return await OauthPageRecipe.google(oauthPage, acctEmail, action); // start from beginning after clicking "other email acct"
    }
    await Util.sleep(5);
    const element = await oauthPage.waitAny([selectors.approve_button, selectors.backup_email_verification_choice]); // , {timeout: 60}
    await Util.sleep(1);
    if ((await oauthPage.target.$x(selectors.backup_email_verification_choice)).length) { // asks for registered backup email
      await element.click();
      await oauthPage.waitAndType('#knowledge-preregistered-email-response', auth.backup, { delay: 2 });
      await oauthPage.waitAndClick('#next', { delay: 2 });
      await oauthPage.waitAll('#submit_approve_access');
    }
    if (gmailSeq.indexOf(acctEmail) === -1) {
      gmailSeq.push(acctEmail);
    }
    if (action === 'close') {
      await oauthPage.close();
    } else if (action === 'deny') {
      throw new Error('tests.handle_gmail_oauth options.deny.true not implemented');
    } else {
      await oauthPage.waitAndClick('#submit_approve_access', { delay: 1 });
    }
  }

}

export class GmailPageRecipe extends PageRecipe {

  public static openSecureCompose = async (gmailPage: ControllablePage, browser: BrowserHandle): Promise<ControllablePage> => {
    await gmailPage.waitAndClick('@action-secure-compose', { delay: 1 });
    await gmailPage.waitAll('@container-new-message');
    const urls = await gmailPage.getFramesUrls(['/chrome/elements/compose.htm'], { sleep: 1 });
    expect(urls.length).to.equal(1);
    return await browser.newPage(urls[0]);
  }

  public static getSubscribeDialog = async (gmailPage: ControllablePage, browser: BrowserHandle): Promise<ControllablePage> => {
    await gmailPage.waitAll('@dialog-subscribe');
    const urls = await gmailPage.getFramesUrls(['/chrome/elements/subscribe.htm'], { sleep: 1 });
    expect(urls.length).to.equal(1);
    return await browser.newPage(urls[0]);
  }

  public static closeInitialSetupNotif = async (gmailPage: ControllablePage) => {
    await gmailPage.waitAndClick('@notification-successfully-setup-action-close');
  }

}
