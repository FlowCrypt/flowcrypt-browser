import { Url, BrowserHandle } from '../browser';
import { PageRecipe, OauthPageRecipe, SettingsPageRecipe, SetupPageRecipe } from './page_recipe';
import { Util } from '../util';

export class BrowserRecipe {

  public static open_settings_login_but_close_oauth_window_before_granting_permission = async (browser: BrowserHandle, account_email: string) => {
    const settings_page = await browser.new_page(Url.extension_settings());
    let oauth_popup_0 = await browser.new_page_triggered_by(() => settings_page.wait_and_click('@action-connect-to-gmail'));
    await OauthPageRecipe.google(oauth_popup_0, account_email, 'close');
    // dialog shows up with permission explanation
    await SettingsPageRecipe.close_dialog(settings_page);
    return settings_page;
  }

  public static open_settings_login_approve = async (browser: BrowserHandle, account_email: string) => {
    const settings_page = await browser.new_page(Url.extension_settings());
    let oauth_popup = await browser.new_page_triggered_by(() => settings_page.wait_and_click('@action-connect-to-gmail'));
    await OauthPageRecipe.google(oauth_popup, account_email, 'approve');
    return settings_page;
  }

  public static open_gmail_page = async (browser: BrowserHandle, google_login_index=0) => {
    let gmail_page = await browser.new_page(Url.gmail(google_login_index));
    await gmail_page.wait_all('div.z0'); // compose button container visible
    await Util.sleep(3); // give it extra time to make sure FlowCrypt is initialized if it was supposed to
    return gmail_page;
  }

  public static open_gmail_page_and_verify_compose_button_present = async (browser: BrowserHandle, google_login_index=0) => {
    let gmail_page = await BrowserRecipe.open_gmail_page(browser, google_login_index);
    await gmail_page.wait_all('@action-secure-compose');
    return gmail_page;
  }

  public static open_gmail_page_and_verify_compose_button_not_present = async (browser: BrowserHandle, google_login_index=0) => {
    let gmail_page = await BrowserRecipe.open_gmail_page(browser, google_login_index);
    await Util.sleep(3);
    await gmail_page.not_present('@action-secure-compose');
    return gmail_page;
  }

  public static set_up_flowcrypt_compatibility_account = async (browser: BrowserHandle) => {
    let settings_page = await BrowserRecipe.open_settings_login_approve(browser, 'flowcrypt.compatibility@gmail.com');
    await SetupPageRecipe.recover(settings_page, 'flowcrypt.compatibility.1pp1', {has_recover_more: true, click_recover_more: true});
    await SetupPageRecipe.recover(settings_page, 'flowcrypt.compatibility.2pp1');
    await settings_page.close();
  }

  public static pgp_block_verify_decrypted_content = async (browser: BrowserHandle, url: string, expected_contents: string[], password?: string) => {
    let pgp_block_page = await browser.new_page(url);
    await pgp_block_page.wait_all('@pgp-block-content');
    await pgp_block_page.wait_for_selector_test_state('ready', 100);
    await Util.sleep(1);
    if(password) {
      await pgp_block_page.wait_and_type('@input-message-password', password);
      await pgp_block_page.wait_and_click('@action-decrypt-with-password');
      await Util.sleep(1);
      await pgp_block_page.wait_for_selector_test_state('ready', 10);
    }
    let content = await pgp_block_page.read('@pgp-block-content');
    for(let expected_content of expected_contents) {
      if(content.indexOf(expected_content) === -1) {
        await pgp_block_page.close();
        throw new Error(`pgp_block_verify_decrypted_content:missing expected content:${expected_content}`);
      }
    }
    await pgp_block_page.close();
  }

}
