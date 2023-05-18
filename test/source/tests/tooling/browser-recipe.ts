/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { Config, Util, TestMessage, TestMessageWithParams } from '../../util';

import { AvaContext } from '.';
import { BrowserHandle, Controllable, ControllableFrame, ControllablePage } from '../../browser';
import { OauthPageRecipe } from './../page-recipe/oauth-page-recipe';
import { SetupPageRecipe } from './../page-recipe/setup-page-recipe';
import { TestUrls } from '../../browser/test-urls';
import { google } from 'googleapis';
import { testVariant } from '../../test';
import { testConstants } from './consts';
import { PageRecipe } from '../page-recipe/abstract-page-recipe';
import { InMemoryStoreKeys } from '../../core/const';
import { GmailPageRecipe } from '../page-recipe/gmail-page-recipe';
import { KeyUtil } from '../../core/crypto/key';
import { ConfigurationProvider } from '../../mock/lib/api';

export class BrowserRecipe {
  public static oldAndNewComposeButtonSelectors = ['div.z0[class*="_destroyable"]', 'div.pb-25px[class*="_destroyable"]', '.new_secure_compose_window_button'];

  public static openSettingsLoginButCloseOauthWindowBeforeGrantingPermission = async (t: AvaContext, browser: BrowserHandle, acctEmail: string) => {
    const settingsPage = await browser.newExtensionSettingsPage(t);
    const oauthPopup = await browser.newPageTriggeredBy(t, () => settingsPage.waitAndClick('@action-connect-to-gmail'));
    await OauthPageRecipe.google(t, oauthPopup, acctEmail, 'close');
    await settingsPage.waitAndRespondToModal('info', 'confirm', 'Explaining FlowCrypt webmail permissions');
    return settingsPage;
  };

  public static openSettingsLoginApprove = async (t: AvaContext, browser: BrowserHandle, acctEmail: string) => {
    const settingsPage = await browser.newExtensionSettingsPage(t, acctEmail);
    const oauthPopup = await browser.newPageTriggeredBy(t, () => settingsPage.waitAndClick('@action-connect-to-gmail'));
    await OauthPageRecipe.google(t, oauthPopup, acctEmail, 'approve');
    return settingsPage;
  };

  public static openGmailPage = async (t: AvaContext, browser: BrowserHandle, googleLoginIndex = 0, expectComposeButton = true) => {
    const gmailPage = await browser.newPage(t, TestUrls.gmail(googleLoginIndex));
    if (expectComposeButton) {
      await gmailPage.waitAny(BrowserRecipe.oldAndNewComposeButtonSelectors); // compose button container visible
    }
    await Util.sleep(3); // give it extra time to make sure FlowCrypt is initialized if it was supposed to
    if (!expectComposeButton) {
      await gmailPage.notPresent(BrowserRecipe.oldAndNewComposeButtonSelectors); // compose button container not visible
    }
    return gmailPage;
  };

  public static openGoogleChatPage = async (t: AvaContext, browser: BrowserHandle, googleLoginIndex = 0) => {
    const googleChatPage = await browser.newPage(t, TestUrls.googleChat(googleLoginIndex));
    await googleChatPage.waitAll('h1.acY'); // "No conversation selected" placeholder
    return googleChatPage;
  };

  public static openGmailPageAndVerifyComposeBtnPresent = async (t: AvaContext, browser: BrowserHandle, googleLoginIndex = 0) => {
    const gmailPage = await BrowserRecipe.openGmailPage(t, browser, googleLoginIndex);
    await gmailPage.waitAll('@action-secure-compose');
    await GmailPageRecipe.closeInitialSetupNotif(gmailPage);
    return gmailPage;
  };

  public static openGmailPageAndVerifyComposeBtnNotPresent = async (t: AvaContext, browser: BrowserHandle, googleLoginIndex = 0) => {
    const gmailPage = await BrowserRecipe.openGmailPage(t, browser, googleLoginIndex);
    await Util.sleep(3);
    await gmailPage.notPresent('@action-secure-compose');
    return gmailPage;
  };

  public static setUpCommonAcct = async (t: AvaContext, browser: BrowserHandle, acct: 'compatibility' | 'compose' | 'ci.tests.gmail') => {
    let acctEmail: string | undefined;
    let settingsPage: ControllablePage | undefined;
    if (acct === 'compatibility') {
      acctEmail = 'flowcrypt.compatibility@gmail.com';
      settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acctEmail);
      await SetupPageRecipe.recover(settingsPage, 'flowcrypt.compatibility.1pp1', {
        hasRecoverMore: true,
        clickRecoverMore: true,
      });
      await SetupPageRecipe.recover(settingsPage, 'flowcrypt.compatibility.2pp1');
    } else if (acct === 'ci.tests.gmail') {
      // live gmail uses ".dev" (real account on real domain). Mock uses "".test".
      acctEmail = testVariant === 'CONSUMER-LIVE-GMAIL' ? 'ci.tests.gmail@flowcrypt.dev' : 'ci.tests.gmail@flowcrypt.test';
      settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acctEmail);
      if (testVariant === 'CONSUMER-LIVE-GMAIL') {
        // using import manually so that we don't rely on email server state, like relying on backup emails being present
        await SetupPageRecipe.manualEnter(settingsPage, 'ci.tests.gmail', { usedPgpBefore: true });
      } else {
        // import from backup since the test runs faster and we can control the state in mock tests
        await SetupPageRecipe.recover(settingsPage, 'ci.tests.gmail');
      }
      if (testVariant === 'CONSUMER-LIVE-GMAIL') {
        // clean up drafts so that broken tests from the past don't affect this test run
        await BrowserRecipe.deleteAllDraftsInGmailAccount(settingsPage);
      }
    } else {
      acctEmail = 'ci.tests.gmail@flowcrypt.dev';
      settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acctEmail);
      await SetupPageRecipe.recover(settingsPage, 'test.ci.compose');
    }
    const accessToken = await BrowserRecipe.getGoogleAccessToken(settingsPage, acctEmail);
    await settingsPage.close();
    return { acctEmail, accessToken };
  };

  public static setupCommonAcctWithAttester = async (t: AvaContext, browser: BrowserHandle, acct: 'compatibility' | 'compose' | 'ci.tests.gmail') => {
    const accountConfigMap = {
      compatibility: {
        email: 'flowcrypt.compatibility@gmail.com',
        keyTitle: 'flowcrypt.compatibility.1pp1',
      },
      'ci.tests.gmail': {
        email: 'ci.tests.gmail@flowcrypt.test',
        keyTitle: 'ci.tests.gmail',
      },
      compose: {
        email: 'ci.tests.gmail@flowcrypt.dev',
        keyTitle: 'test.ci.compose',
      },
    };
    const { email: acctEmail, keyTitle } = accountConfigMap[acct];
    const key = Config.key(keyTitle);
    const privateKey = await KeyUtil.parse(key.armored!);
    const pubKey = await KeyUtil.asPublicKey(privateKey);
    if (!t.mockApi!.configProvider) {
      t.mockApi!.configProvider = new ConfigurationProvider({});
    }
    t.mockApi!.configProvider!.config.attester = {
      ...(t.mockApi!.configProvider!.config.attester ?? {}),
      pubkeyLookup: {
        [acctEmail]: {
          pubkey: KeyUtil.armor(pubKey),
        },
      },
    };
    return await this.setUpCommonAcct(t, browser, acct);
  };

  public static getGoogleAccessToken = async (controllable: Controllable, acctEmail: string): Promise<string> => {
    const result = await PageRecipe.sendMessage(controllable, {
      name: 'inMemoryStoreGet',
      data: { bm: { acctEmail, key: InMemoryStoreKeys.GOOGLE_TOKEN_ACCESS }, objUrls: {} },
      to: null, // eslint-disable-line no-null/no-null
      uid: '2',
    });
    return (result as { result: string }).result;
  };

  public static getFromInMemoryStore = async (controllable: Controllable, acctEmail: string, key: string): Promise<string> => {
    const result = await PageRecipe.sendMessage(controllable, {
      name: 'inMemoryStoreGet',
      data: { bm: { acctEmail, key }, objUrls: {} },
      to: null, // eslint-disable-line no-null/no-null
      uid: '2', // todo: random uid?
    });
    return (result as { result: string }).result;
  };

  public static getPassphraseFromInMemoryStore = (controllable: Controllable, acctEmail: string, longid: string): Promise<string> =>
    BrowserRecipe.getFromInMemoryStore(controllable, acctEmail, `passphrase_${longid}`);

  public static deleteAllDraftsInGmailAccount = async (settingsPage: ControllablePage): Promise<void> => {
    const accessToken = await BrowserRecipe.getGoogleAccessToken(settingsPage, 'ci.tests.gmail@flowcrypt.dev');
    const gmail = google.gmail({ version: 'v1' });
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const list = await gmail.users.drafts.list({ userId: 'me', access_token: accessToken });
    if (list.data.drafts) {
      await Promise.all(
        list.data.drafts
          .filter(draft => draft.id)
          // eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/no-non-null-assertion
          .map(draft => gmail.users.drafts.delete({ id: draft.id!, userId: 'me', access_token: accessToken }))
      );
    }
  };

  // todo - ideally we could just add a 3rd common account: 'compatibility' | 'compose' | 'pp-change' in setUpCommonAcct
  public static setUpFcPpChangeAcct = async (t: AvaContext, browser: BrowserHandle) => {
    const acctEmail = 'flowcrypt.test.key.imported@gmail.com';
    const k = Config.key('flowcrypt.test.key.used.pgp');
    const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acctEmail);
    await SetupPageRecipe.manualEnter(
      settingsPage,
      k.title,
      { usedPgpBefore: false, submitPubkey: false, savePassphrase: true },
      { isSavePassphraseHidden: false }
    );
    return { acctEmail, passphrase: k.passphrase, settingsPage };
  };

  public static setUpFcForbidPpStoringAcct = async (t: AvaContext, browser: BrowserHandle) => {
    const acctEmail = 'user@forbid-storing-passphrase-client-configuration.flowcrypt.test';
    const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acctEmail);
    const key = {
      title: '',
      armored: testConstants.testKeyB8F687BCDE14435A,
      passphrase: 'donotstore',
      longid: 'B8F687BCDE14435A',
    };
    await SetupPageRecipe.manualEnter(
      settingsPage,
      'unused',
      { submitPubkey: false, usedPgpBefore: false, key },
      { isSavePassphraseChecked: false, isSavePassphraseHidden: true }
    );
    return { acctEmail, passphrase: key.passphrase, settingsPage };
  };

  public static pgpBlockVerifyDecryptedContent = async (t: AvaContext, browser: BrowserHandle, m: TestMessageWithParams) => {
    const pgpHostPage = await browser.newPage(t, `chrome/dev/ci_pgp_host_page.htm${m.params}`);
    try {
      const pgpBlockPage = await pgpHostPage.getFrame(['pgp_block.htm']);
      return await BrowserRecipe.pgpBlockCheck(t, pgpBlockPage, m);
    } finally {
      await pgpHostPage.close();
    }
  };

  public static pgpBlockCheck = async (t: AvaContext, pgpBlockPage: ControllableFrame, m: TestMessage) => {
    if (m.expectPercentageProgress) {
      await pgpBlockPage.waitForContent('@pgp-block-content', /Retrieving message... \d+%/, 20, 10);
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
      if (!content?.includes(expectedContent)) {
        throw new Error(`pgp_block_verify_decrypted_content:missing expected content: ${expectedContent}` + `\nactual content: ${content}`);
      }
    }
    if (m.unexpectedContent) {
      for (const unexpectedContent of m.unexpectedContent) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        if (content!.includes(unexpectedContent)) {
          throw new Error(`pgp_block_verify_decrypted_content:unexpected content presents: ${unexpectedContent}`);
        }
      }
    }
    if (m.signature) {
      const sigBadgeContent = await pgpBlockPage.read('@pgp-signature');
      if (sigBadgeContent !== m.signature) {
        t.log(`found sig content:${sigBadgeContent}`);
        throw new Error(`pgp_block_verify_decrypted_content:missing expected signature content:${m.signature}\nactual sig content:${sigBadgeContent}`);
      }
    }
    if (m.encryption) {
      const encBadgeContent = await pgpBlockPage.read('@pgp-encryption');
      if (encBadgeContent !== m.encryption) {
        t.log(`found enc content:${encBadgeContent}`);
        throw new Error(`pgp_block_verify_decrypted_content:missing expected encryption content:${m.encryption}`);
      }
    }
    if (m.error) {
      await pgpBlockPage.notPresent('@action-print');
      const errBadgeContent = await pgpBlockPage.read('@pgp-error');
      if (errBadgeContent !== m.error) {
        t.log(`found err content:${errBadgeContent}`);
        throw new Error(`pgp_block_verify_decrypted_content:missing expected error content:${m.error}`);
      }
    } else if (m.content.length > 0) {
      if (!(await pgpBlockPage.isElementVisible('@action-print'))) {
        throw new Error(`Print button is invisible`);
      }
    }
  };
}
