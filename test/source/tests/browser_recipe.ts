import { Url, BrowserHandle } from '../browser';
import { OauthPageRecipe, SettingsPageRecipe, SetupPageRecipe } from './page_recipe';
import { Util, Config } from '../util';
import { AvaContext } from '.';

export class BrowserRecipe {

  public static openSettingsLoginButCloseOauthWindowBeforeGrantingPermission = async (t: AvaContext, browser: BrowserHandle, acctEmail: string) => {
    const settingsPage = await browser.newPage(t, Url.extensionSettings());
    const oauthPopup0 = await browser.newPageTriggeredBy(t, () => settingsPage.waitAndClick('@action-connect-to-gmail'), acctEmail);
    await OauthPageRecipe.google(t, oauthPopup0, acctEmail, 'close');
    // dialog shows up with permission explanation
    await SettingsPageRecipe.closeDialog(settingsPage);
    return settingsPage;
  }

  public static openSettingsLoginApprove = async (t: AvaContext, browser: BrowserHandle, acctEmail: string) => {
    const settingsPage = await browser.newPage(t, Url.extensionSettings());
    const oauthPopup = await browser.newPageTriggeredBy(t, () => settingsPage.waitAndClick('@action-connect-to-gmail'), acctEmail);
    await OauthPageRecipe.google(t, oauthPopup, acctEmail, 'approve');
    return settingsPage;
  }

  public static openGmailPage = async (t: AvaContext, browser: BrowserHandle, googleLoginIndex = 0) => {
    const gmailPage = await browser.newPage(t, Url.gmail(googleLoginIndex));
    await gmailPage.waitAll('div.z0'); // compose button container visible
    await Util.sleep(3); // give it extra time to make sure FlowCrypt is initialized if it was supposed to
    return gmailPage;
  }

  public static openGmailPageAndVerifyComposeBtnPresent = async (t: AvaContext, browser: BrowserHandle, googleLoginIndex = 0) => {
    const gmailPage = await BrowserRecipe.openGmailPage(t, browser, googleLoginIndex);
    await gmailPage.waitAll('@action-secure-compose');
    return gmailPage;
  }

  public static openGmailPageAndVerifyComposeBtnNotPresent = async (t: AvaContext, browser: BrowserHandle, googleLoginIndex = 0) => {
    const gmailPage = await BrowserRecipe.openGmailPage(t, browser, googleLoginIndex);
    await Util.sleep(3);
    await gmailPage.notPresent('@action-secure-compose');
    return gmailPage;
  }

  public static setUpCommonAcct = async (t: AvaContext, browser: BrowserHandle, group: 'compatibility' | 'compose') => {
    if (group === 'compatibility') {
      const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, 'flowcrypt.compatibility@gmail.com');
      await SetupPageRecipe.recover(settingsPage, 'flowcrypt.compatibility.1pp1', { hasRecoverMore: true, clickRecoverMore: true });
      await SetupPageRecipe.recover(settingsPage, 'flowcrypt.compatibility.2pp1');
      await settingsPage.close();
    } else {
      const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, 'test.ci.compose@org.flowcrypt.com');
      await SetupPageRecipe.recover(settingsPage, 'test.ci.compose');
      await settingsPage.close();
    }
  }

  public static setUpFcPpChangeAcct = async (t: AvaContext, browser: BrowserHandle) => {
    const acctEmail = 'flowcrypt.test.key.imported@gmail.com';
    const k = Config.key('flowcrypt.test.key.used.pgp');
    const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acctEmail);
    await SetupPageRecipe.manualEnter(settingsPage, k.title, { usedPgpBefore: false, submitPubkey: false });
    return { acctEmail, k, settingsPage };
  }

  public static pgpBlockVerifyDecryptedContent = async (t: AvaContext, browser: BrowserHandle, url: string, expectedContents: string[], password?: string) => {
    const pgpBlockPage = await browser.newPage(t, url);
    await pgpBlockPage.waitAll('@pgp-block-content');
    await pgpBlockPage.waitForSelTestState('ready', 100);
    await Util.sleep(1);
    if (password) {
      await pgpBlockPage.waitAndType('@input-message-password', password);
      await pgpBlockPage.waitAndClick('@action-decrypt-with-password');
      await Util.sleep(1);
      await pgpBlockPage.waitForSelTestState('ready', 10);
    }
    const content = await pgpBlockPage.read('@pgp-block-content');
    for (const expectedContent of expectedContents) {
      if (content.indexOf(expectedContent) === -1) {
        await pgpBlockPage.close();
        throw new Error(`pgp_block_verify_decrypted_content:missing expected content:${expectedContent}`);
      }
    }
    await pgpBlockPage.close();
  }

}
