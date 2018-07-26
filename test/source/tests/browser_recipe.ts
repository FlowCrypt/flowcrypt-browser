import {Url, BrowserHandle} from '../browser';
import {PageRecipe} from './page_recipe';
import {Util} from '../util';

export class BrowserRecipe {

  public static open_settings_login_but_close_oauth_window_before_granting_permission = async (browser: BrowserHandle, account_email: string) => {
    const settings_page = await browser.new_page(Url.extension_settings());
    let oauth_popup_0 = await browser.new_page_triggered_by(() => settings_page.wait_and_click('@action-connect-to-gmail'));
    await PageRecipe.handle_gmail_oauth(oauth_popup_0, account_email, 'close');
    // dialog shows up with permission explanation
    await PageRecipe.close_settings_page_dialog(settings_page);
    return settings_page;
  }

  public static open_settings_login_approve = async (browser: BrowserHandle, account_email: string) => {
    const settings_page = await browser.new_page(Url.extension_settings());
    let oauth_popup = await browser.new_page_triggered_by(() => settings_page.wait_and_click('@action-connect-to-gmail'));
    await PageRecipe.handle_gmail_oauth(oauth_popup, account_email, 'approve');
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
  }

  public static open_gmail_page_and_verify_compose_button_not_present = async (browser: BrowserHandle, google_login_index=0) => {
    let gmail_page = await BrowserRecipe.open_gmail_page(browser, google_login_index);
    await Util.sleep(3);
    await gmail_page.not_present('@action-secure-compose');
  }

  public static set_up_flowcrypt_compatibility_account = async (browser: BrowserHandle) => {
    let settings_page = await BrowserRecipe.open_settings_login_approve(browser, 'flowcrypt.compatibility@gmail.com');
    await PageRecipe.setup_recover(settings_page, 'flowcrypt.compatibility.1pp1', {has_recover_more: true, click_recover_more: true});
    await PageRecipe.setup_recover(settings_page, 'flowcrypt.compatibility.2pp1');
  }

}
