/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { Config, Util, TestMessage } from '../../util';

import { AvaContext } from '.';
import { BrowserHandle } from '../../browser';
import { OauthPageRecipe } from './../page-recipe/oauth-page-recipe';
import { SettingsPageRecipe } from './../page-recipe/settings-page-recipe';
import { SetupPageRecipe } from './../page-recipe/setup-page-recipe';
import { TestUrls } from '../../browser/test-urls';

export class BrowserRecipe {

  public static openSettingsLoginButCloseOauthWindowBeforeGrantingPermission = async (t: AvaContext, browser: BrowserHandle, acctEmail: string) => {
    const settingsPage = await browser.newPage(t, TestUrls.extensionSettings());
    const oauthPopup = await browser.newPageTriggeredBy(t, () => settingsPage.waitAndClick('@action-connect-to-gmail'));
    await OauthPageRecipe.google(t, oauthPopup, acctEmail, 'close');
    await settingsPage.waitAndRespondToModal('confirm', 'cancel', 'Explaining FlowCrypt webmail permissions');
    return settingsPage;
  }

  public static openSettingsLoginApprove = async (t: AvaContext, browser: BrowserHandle, acctEmail: string) => {
    const settingsPage = await browser.newPage(t, TestUrls.extensionSettings());
    const oauthPopup = await browser.newPageTriggeredBy(t, () => settingsPage.waitAndClick('@action-connect-to-gmail'));
    await OauthPageRecipe.google(t, oauthPopup, acctEmail, 'approve');
    return settingsPage;
  }

  public static openGmailPage = async (t: AvaContext, browser: BrowserHandle, googleLoginIndex = 0) => {
    const gmailPage = await browser.newPage(t, TestUrls.gmail(googleLoginIndex));
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

  public static setUpCommonAcct = async (t: AvaContext, browser: BrowserHandle, acct: 'compatibility' | 'compose' | 'ci.tests.gmail') => {
    if (acct === 'compatibility') {
      const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, 'flowcrypt.compatibility@gmail.com');
      await SetupPageRecipe.recover(settingsPage, 'flowcrypt.compatibility.1pp1', { hasRecoverMore: true, clickRecoverMore: true });
      await SetupPageRecipe.recover(settingsPage, 'flowcrypt.compatibility.2pp1');
      await settingsPage.close();
    } else if (acct === 'ci.tests.gmail') {
      const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, 'ci.tests.gmail@flowcrypt.dev');
      await SetupPageRecipe.recover(settingsPage, 'ci.tests.gmail');
      await settingsPage.close();
    } else {
      const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, 'test.ci.compose@org.flowcrypt.com');
      await SetupPageRecipe.recover(settingsPage, 'test.ci.compose');
      await settingsPage.close();
    }
  }

  // todo - ideally we could just add a 3rd common account: 'compatibility' | 'compose' | 'pp-change' in setUpCommonAcct
  public static setUpFcPpChangeAcct = async (t: AvaContext, browser: BrowserHandle) => {
    const acctEmail = 'flowcrypt.test.key.imported@gmail.com';
    const k = Config.key('flowcrypt.test.key.used.pgp');
    const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acctEmail);
    await SetupPageRecipe.manualEnter(settingsPage, k.title, { usedPgpBefore: false, submitPubkey: false, savePassphrase: true });
    return { acctEmail, k, settingsPage };
  }

  public static async pgpBlockVerifyDecryptedContent(t: AvaContext, browser: BrowserHandle, m: TestMessage) {
    const pgpHostPage = await browser.newPage(t, `chrome/dev/ci_pgp_host_page.htm${m.params}`);
    const pgpBlockPage = await pgpHostPage.getFrame(['pgp_block.htm']);
    if (m.expectPercentageProgress) {
      await pgpBlockPage.waitForContent('@pgp-block-content', /Retrieving message... \d+%/);
    }
    await pgpBlockPage.waitForSelTestState('ready', 100);
    await Util.sleep(1);
    if (m.quoted) {
      await pgpBlockPage.waitAndClick('@action-show-quoted-content');
      await Util.sleep(1);
    } else {
      if (await pgpBlockPage.isElementPresent('@action-show-quoted-content')) {
        throw new Error(`element: @action-show-quoted-content not expected in: ${t.title}`);
      }
    }
    const content = await pgpBlockPage.read('@pgp-block-content');
    for (const expectedContent of m.content) {
      if (content.indexOf(expectedContent) === -1) {
        throw new Error(`pgp_block_verify_decrypted_content:missing expected content: ${expectedContent}`);
      }
    }
    if (m.unexpectedContent) {
      for (const unexpectedContent of m.unexpectedContent) {
        if (content.indexOf(unexpectedContent) !== -1) {
          throw new Error(`pgp_block_verify_decrypted_content:unexpected content presents: ${unexpectedContent}`);
        }
      }
    }
    if (m.signature) {
      const sigContent = await pgpBlockPage.read('@pgp-signature');
      for (const expectedSigContent of m.signature) {
        if (sigContent.indexOf(expectedSigContent) === -1) {
          t.log(`found sig content:${sigContent}`);
          throw new Error(`pgp_block_verify_decrypted_content:missing expected signature content:${expectedSigContent}`);
        }
      }
    }
    await pgpHostPage.close();
  }

}
