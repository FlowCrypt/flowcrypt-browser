
import {BrowserHandle, ControllablePage, ControllableFrame, Controllable, Url, gmail_seq} from '../browser';
import {Util, Config} from '../util';
import {expect} from 'chai';

export class PageRecipe {

  private static oauth_password_delay = 2;

  public static compose_open_compose_page_standalone = async (browser: BrowserHandle): Promise<ControllablePage> => {
    let compose_page = await browser.new_page('chrome/elements/compose.htm?account_email=flowcrypt.compatibility%40gmail.com&parent_tab_id=0');
    await compose_page.wait_all(['@input-body', '@input-to', '@input-subject', '@action-send']);
    await compose_page.wait_for_selector_test_state('ready');
    return compose_page;
  }

  public static compose_open_compose_page_settings = async (settings_page: ControllablePage): Promise<ControllableFrame> => {
    await settings_page.wait_and_click('@action-show-compose-page');
    await settings_page.wait_all('@dialog');
    let compose_frame = await settings_page.get_frame(['compose.htm']);
    await compose_frame.wait_all(['@input-body', '@input-to', '@input-subject', '@action-send']);
    await compose_frame.wait_for_selector_test_state('ready');
    return compose_frame;
  }

  public static compose_change_default_sending_address = async (compose_page: ControllablePage, new_default: string) => {
    await compose_page.wait_and_click('@action-open-sending-address-settings');
    await compose_page.wait_all('@dialog');
    let sending_address_frame = await compose_page.get_frame(['sending_address.htm']);
    await sending_address_frame.wait_and_click(`@action-choose-address(${new_default})`);
    await Util.sleep(0.5); // page reload
    await sending_address_frame.wait_and_click('@action-close-sending-address-settings');
    await compose_page.wait_till_gone('@dialog');
  }

  public static compose_fill_message = async (compose_page_or_frame: Controllable, to: string|null, subject: string) => {
    if(to) {
      await compose_page_or_frame.type('@input-to', to);
    }
    await compose_page_or_frame.click('@input-subject');
    await compose_page_or_frame.type('@input-subject', `Automated puppeteer test: ${subject}`);
    await compose_page_or_frame.type('@input-body', `This is an automated puppeteer test: ${subject}`);
  }

  public static compose_send_and_close = async (compose_page: ControllablePage, password?: string|undefined) => {
    if(password) {
      await compose_page.wait_and_type('@input-password', 'test-pass');
      await compose_page.wait_and_click('@action-send', {delay: 0.5}); // in real usage, also have to click two times when using password - why?
    }
    await compose_page.wait_and_click('@action-send', {delay: 0.5});
    await compose_page.wait_for_selector_test_state('closed', 60); // wait until page closed
    await compose_page.close();
  }

  public static toggle_settings_screen = async (settings_page: ControllablePage, to: "basic"|"additional") => {
    await Util.sleep(0.5);
    await settings_page.wait_and_click(to === 'basic' ? '@action-toggle-screen-basic' : '@action-toggle-screen-additional'); // switch
    await Util.sleep(0.5);
    await settings_page.wait_all(to === 'basic' ? '@action-toggle-screen-additional' : '@action-toggle-screen-basic'); // wait for opposite button to show up
    await Util.sleep(0.5);
  }

  public static close_settings_page_dialog = async (settings_page: ControllablePage) => {
    await settings_page.wait_and_click('@dialog-close');
    await settings_page.wait_till_gone('@dialog');
  }

  public static open_settings_page_and_await_new_frame = async (settings_page: ControllablePage, action_button_selector: string, frame_url_filter: string[]): Promise<ControllableFrame> => {
    await settings_page.wait_and_click(action_button_selector);
    await settings_page.wait_all('@dialog');
    return await settings_page.get_frame(frame_url_filter); // placement=settings to differentiate from mini-security frame in settings
  }

  public static settings_switch_account = async (settings_page: ControllablePage, account_email: string) => {
    await settings_page.wait_and_click('@action-toggle-accounts-menu');
    await settings_page.wait_and_click(`@action-switch-to-account(${account_email})`);
  }

  public static handle_gmail_oauth = async (oauth_page: ControllablePage, account_email: string, action: "close"|"deny"|"approve"): Promise<void> => {
    let selectors = {
      backup_email_verification_choice: "//div[@class='vdE7Oc' and text() = 'Confirm your recovery email']",
      approve_button: '#submit_approve_access',
    };
    let auth = Config.secrets.auth.google.filter(a => a.email === account_email)[0];
    await oauth_page.wait_all('#Email, #submit_approve_access, #identifierId, .w6VTHd');
    if (await oauth_page.target.$('#Email') !== null) { // 2016-style login
      await oauth_page.wait_all('#Email', {timeout: 60});
      await oauth_page.wait_and_type('#Email', auth.email);
      await oauth_page.wait_and_click('#next');
      await oauth_page.wait_for_navigation_if_any();
      await Util.sleep(PageRecipe.oauth_password_delay);
      await oauth_page.wait_and_type('#Passwd', auth.password, {delay: PageRecipe.oauth_password_delay});
      await oauth_page.wait_for_navigation_if_any();
      await oauth_page.wait_and_click('#signIn', {delay: 1});
      await oauth_page.wait_for_navigation_if_any();
    } else if (await oauth_page.target.$('#identifierId') !== null) { // 2017-style login
      await oauth_page.wait_all('#identifierId', {timeout: 60});
      await oauth_page.wait_and_type('#identifierId', auth.email, {delay: 2});
      await oauth_page.wait_and_click('.zZhnYe', {delay: 2});  // confirm email
      await oauth_page.wait_for_navigation_if_any();
      await Util.sleep(PageRecipe.oauth_password_delay);
      await oauth_page.wait_and_type('.zHQkBf', auth.password, {delay: PageRecipe.oauth_password_delay});
      await oauth_page.wait_and_click('.CwaK9', {delay: 1});  // confirm password
      await oauth_page.wait_for_navigation_if_any();
    } else if (await oauth_page.target.$('.w6VTHd') !== null) { // select from accounts where already logged in
      await oauth_page.wait_and_click('.bLzI3e', {delay: 1}); // choose other account, also try .TnvOCe .k6Zj8d .XraQ3b
      await Util.sleep(2);
      return await PageRecipe.handle_gmail_oauth(oauth_page, account_email, action); // start from beginning after clicking "other email acct"
    }
    await Util.sleep(5);
    let element = await oauth_page.wait_any([selectors.approve_button, selectors.backup_email_verification_choice]); // , {timeout: 60}
    await Util.sleep(1);
    if((await oauth_page.target.$x(selectors.backup_email_verification_choice)).length) { // asks for registered backup email
      await element.click();
      await oauth_page.wait_and_type('#knowledge-preregistered-email-response', auth.backup, {delay: 2});
      await oauth_page.wait_and_click('#next', {delay: 2});
      await oauth_page.wait_all('#submit_approve_access');
    }
    if(gmail_seq.indexOf(account_email) === -1) {
      gmail_seq.push(account_email);
    }
    if(action === 'close') {
      await oauth_page.close();
    } else if(action === 'deny') {
      throw Error('tests.handle_gmail_oauth options.deny.true not implemented');
    } else {
      await oauth_page.wait_and_click('#submit_approve_access', {delay: 1});
    }
  }

  private static setup_create_begin = async (settings_page: ControllablePage, key_title: string, {used_pgp_before=false}: {used_pgp_before?: boolean}={}) => {
    let k = Config.key(key_title);
    if(used_pgp_before) {
      await settings_page.wait_and_click('@action-step0foundkey-choose-manual-create');
    } else {
      await settings_page.wait_and_click('@action-step1easyormanual-choose-manual-create');
    }
    await settings_page.wait_and_type('@input-step2bmanualcreate-passphrase-1', k.passphrase);
    await settings_page.wait_and_type('@input-step2bmanualcreate-passphrase-2', k.passphrase);
  }

  // public static setup_create_simple = async (settings_page: ControllablePage, key_title: string, {used_pgp_before=false}: {used_pgp_before?: boolean}={}) => {
  //   await PageRecipe.setup_create_begin(settings_page, key_title, {used_pgp_before});
  //   await settings_page.wait_and_click('@input-step2bmanualcreate-create-and-save');
  //   await settings_page.wait_and_click('@action-backup-....');
  //   // todo
  //   await settings_page.wait_and_click('@action-step4done-account-settings');
  // }

  public static setup_create_advanced = async (settings_page: ControllablePage, key_title: string, backup: "none"|"email"|"file", {used_pgp_before=false, submit_pubkey=false}: {used_pgp_before?: boolean, submit_pubkey?: boolean}={}) => {
    await PageRecipe.setup_create_begin(settings_page, key_title, {used_pgp_before});
    await settings_page.wait_and_click('@action-step2bmanualcreate-show-advanced-create-settings'); // unfold
    await settings_page.wait_and_click('@input-step2bmanualcreate-backup-inbox'); // uncheck
    if(!submit_pubkey) {
      await settings_page.wait_and_click('@input-step2bmanualcreate-submit-pubkey'); // uncheck
    }
    await settings_page.wait_and_click('@input-step2bmanualcreate-create-and-save');
    if(backup === 'none') {
      await settings_page.wait_all('@input-backup-step3manual-no-backup', {timeout: 40});
      await settings_page.wait_and_click('@input-backup-step3manual-no-backup');
    } else if(backup === 'email') {
      throw Error('tests.setup_manual_create options.backup=email not implemented');
    } else if(backup === 'file') {
      throw Error('tests.setup_manual_create options.backup=file not implemented');
    }
    await settings_page.wait_and_click('@action-backup-step3manual-continue');
    await settings_page.wait_and_click('@action-step4done-account-settings');
  }

  public static setup_manual_enter = async (settings_page: ControllablePage, key_title: string, {used_pgp_before=false, submit_pubkey=false, fix_key=false}: {used_pgp_before?: boolean, submit_pubkey?: boolean, fix_key?: boolean}={}) => {
    let k = Config.key(key_title);
    if(used_pgp_before) {
      await settings_page.wait_and_click('@action-step0foundkey-choose-manual-enter');
    } else {
      await settings_page.wait_and_click('@action-step1easyormanual-choose-manual-enter');
    }
    await settings_page.wait_and_click('@input-step2bmanualenter-source-paste');
    await settings_page.wait_and_type('@input-step2bmanualenter-ascii-key', k.armored || '');
    await settings_page.wait_and_type('@input-step2bmanualenter-passphrase', k.passphrase);
    if(!submit_pubkey) {
      await settings_page.wait_and_click('@input-step2bmanualenter-submit-pubkey'); // uncheck
    }
    await settings_page.wait_and_click('@input-step2bmanualenter-save', {delay: 1});
    if(fix_key) {
      await settings_page.wait_all('@input-compatibility-fix-expire-years');
      await settings_page.select_option('@input-compatibility-fix-expire-years', '1');
      await settings_page.wait_and_click('@action-fix-and-import-key');
    }
    await settings_page.wait_and_click('@action-step4done-account-settings');
  }

  public static setup_recover =  async (settings_page: ControllablePage, key_title: string, {wrong_passphrase=false, click_recover_more=false, has_recover_more=false, already_recovered=false}: {wrong_passphrase?: boolean, click_recover_more?: boolean, has_recover_more?: boolean, already_recovered?: boolean}={}) => {
    let k = Config.key(key_title);
    await settings_page.wait_and_type('@input-recovery-pass-phrase', k.passphrase);
    if(wrong_passphrase) {
      let dialog = await settings_page.trigger_and_await_new_alert(() => settings_page.wait_and_click('@action-recover-account'));
      // todo - read the contents - wrong pp
      await dialog.accept();
    } else if(already_recovered) {
      let dialog = await settings_page.trigger_and_await_new_alert(() => settings_page.wait_and_click('@action-recover-account'));
      // todo - read the contents - already recovered
      await dialog.accept();
    } else {
      await settings_page.wait_and_click('@action-recover-account');
      await settings_page.wait_any(['@action-step4more-account-settings', '@action-step4done-account-settings'], {timeout: 60});
      if(has_recover_more) {
        await settings_page.wait_all(['@action-step4more-account-settings', '@action-step4more-recover-remaining']);
        if(click_recover_more) {
          await settings_page.wait_and_click('@action-step4more-recover-remaining');
        } else {
          await settings_page.wait_and_click('@action-step4more-account-settings');
        }
      } else {
        await settings_page.wait_all('@action-step4done-account-settings');
        if(click_recover_more) {
          throw new Error('Invalid options chosen: has_recover_more: false, click_recover_more: true');
        } else {
          await settings_page.wait_and_click('@action-step4done-account-settings');
        }
      }
    }
  }

  public static settings_change_pass_phrase_requirement = async (settings_page: ControllablePage, passphrase: string, outcome: "session"|"storage") => {
    let security_frame = await PageRecipe.open_settings_page_and_await_new_frame(settings_page, '@action-open-security-page', ['security.htm', 'placement=settings']);
    await security_frame.wait_all('@input-toggle-require-pass-phrase');
    await Util.sleep(1); // wait for form to init / fill
    let require_pass_phrase_is_checked = await security_frame.is_checked('@input-toggle-require-pass-phrase');
    if(require_pass_phrase_is_checked && outcome === 'session') {
      throw Error('change_pass_phrase_requirement: already checked to be in session only');
    }
    if(!require_pass_phrase_is_checked && outcome === 'storage') {
      throw Error('change_pass_phrase_requirement: already checked to be in storage');
    }
    await security_frame.click('@input-toggle-require-pass-phrase');
    await security_frame.wait_and_type('@input-confirm-pass-phrase', passphrase);
    await security_frame.wait_and_click('@action-confirm-pass-phrase-requirement-change');
    await Util.sleep(1); // frame will now reload
    await security_frame.wait_all('@input-toggle-require-pass-phrase');
    await Util.sleep(1); // wait to init
    require_pass_phrase_is_checked = await security_frame.is_checked('@input-toggle-require-pass-phrase');
    if(!require_pass_phrase_is_checked && outcome === 'session') {
      throw Error('change_pass_phrase_requirement: did not remember to only save in sesion');
    }
    if(require_pass_phrase_is_checked && outcome === 'storage') {
      throw Error('change_pass_phrase_requirement: did not remember to save in storage');
    }
    await PageRecipe.close_settings_page_dialog(settings_page);
  }

  public static verify_settings_key_presence = async (settings_page: ControllablePage, expected_key_name: string, trigger: "button"|"link") => {
    await PageRecipe.toggle_settings_screen(settings_page, 'additional');
    let my_key_frame = await PageRecipe.open_settings_page_and_await_new_frame(settings_page, trigger === 'button' ? '@action-open-pubkey-page' : '@action-show-key' , ['my_key.htm', 'placement=settings']);
    await Util.sleep(1);
    let k = Config.key(expected_key_name);
    await my_key_frame.wait_all(['@content-key-words', '@content-armored-key']);
    expect(await my_key_frame.read('@content-key-words')).to.equal(k.keywords);
    await my_key_frame.wait_and_click('@action-toggle-key-type(show private key)');
    expect(await my_key_frame.read('@content-armored-key')).to.contain('-----BEGIN PGP PRIVATE KEY BLOCK-----');
    await my_key_frame.wait_and_click('@action-toggle-key-type(show public key)');
    await PageRecipe.close_settings_page_dialog(settings_page);
    await PageRecipe.toggle_settings_screen(settings_page, 'basic');
  }

  public static settings_pass_phrase_test = async (settings_page: ControllablePage, passphrase: string, expect_match: boolean) => {
    let security_frame = await PageRecipe.open_settings_page_and_await_new_frame(settings_page, '@action-open-security-page', ['security.htm', 'placement=settings']);
    await security_frame.wait_and_click('@action-test-passphrase-begin');
    await security_frame.wait_and_type('@input-test-passphrase', passphrase);
    let click = () => security_frame.wait_and_click('@action-test-passphrase');
    if(expect_match) {
      await click();
      await security_frame.wait_and_click('@action-test-passphrase-successful-close');
    } else {
      let dialog = await settings_page.trigger_and_await_new_alert(click);
      await dialog.accept();
      await PageRecipe.close_settings_page_dialog(settings_page);
    }
    await settings_page.wait_till_gone('@dialog');
  }

}
