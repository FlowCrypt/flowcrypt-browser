/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { Config, Util, TestMessage, TestMessageAndSession } from '../../util';

import { AvaContext } from '.';
import { BrowserHandle, Controllable, ControllableFrame, ControllablePage } from '../../browser';
import { OauthPageRecipe } from './../page-recipe/oauth-page-recipe';
import { SetupPageRecipe } from './../page-recipe/setup-page-recipe';
import { TestUrls } from '../../browser/test-urls';
import { gmail_v1, google } from 'googleapis';
import { testVariant } from '../../test';
import { testConstants } from './consts';
import { PageRecipe } from '../page-recipe/abstract-page-recipe';
import { InMemoryStoreKeys } from '../../core/const';
import { GmailPageRecipe } from '../page-recipe/gmail-page-recipe';
import { expect } from 'chai';
import { KeyUtil } from '../../core/crypto/key';
import { ConfigurationProvider } from '../../mock/lib/api';
import { GoogleConfig, MockUserAlias } from '../../mock/google/google-endpoints';
import { AttesterConfig } from '../../mock/attester/attester-endpoints';
import { somePubkey } from '../../mock/attester/attester-key-constants';

type TestAccount = 'compatibility' | 'compose' | 'ci.tests.gmail';
interface CommonAcctConfig {
  google?: GoogleConfig & {
    acctPrimarySignature?: string;
    acctAliases?: MockUserAlias[];
  };
  attester?: AttesterConfig & {
    includeHumanKey?: boolean;
    includeFlowcryptCompatibilityKey?: boolean;
  };
}
export class BrowserRecipe {
  public static oldAndNewComposeButtonSelectors = ['div.z0[class*="_destroyable"]', 'div.pb-25px[class*="_destroyable"]', '.new_secure_compose_window_button'];

  public static openSettingsLoginButCloseOauthWindowBeforeGrantingPermission = async (t: AvaContext, browser: BrowserHandle, acctEmail: string) => {
    const settingsPage = await browser.newExtensionSettingsPage(t);
    const oauthPopup = await browser.newPageTriggeredBy(t, () => settingsPage.waitAndClick('@action-connect-to-gmail'));
    await OauthPageRecipe.google(t, oauthPopup, acctEmail, 'close');
    await settingsPage.waitAndRespondToModal('info', 'confirm', 'Explaining FlowCrypt webmail permissions');
    return settingsPage;
  };

  public static openSettingsLoginApprove = async (t: AvaContext, browser: BrowserHandle, acctEmail: string, expectCustomIdp?: boolean) => {
    const settingsPage = await browser.newExtensionSettingsPage(t, acctEmail);
    const googleOAuthPopup = await browser.newPageTriggeredBy(t, () => settingsPage.waitAndClick('@action-connect-to-gmail'));
    await OauthPageRecipe.google(t, googleOAuthPopup, acctEmail, 'approve');
    if (expectCustomIdp) {
      const customOAuthPopup = await browser.newPageTriggeredBy(t, () =>
        settingsPage.waitAndRespondToModal('info', 'confirm', 'Google login succeeded. Now, please log in with your company credentials as well.')
      );
      await OauthPageRecipe.customIdp(t, customOAuthPopup);
    }
    // Wait until custom IDP authentication finished
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
    await Util.sleep(5);
    if (await googleChatPage.isElementPresent('.fKz7Od')) {
      // close announcement about updated UI
      await googleChatPage.waitAndClick('.fKz7Od', { delay: 1 });
    }
    await googleChatPage.waitAll('.T-I-KE'); // New chat button
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

  public static setUpCommonAcct = async (t: AvaContext, browser: BrowserHandle, acct: TestAccount) => {
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
    } else {
      acctEmail = 'ci.tests.gmail@flowcrypt.dev';
      settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, acctEmail);
      await SetupPageRecipe.recover(settingsPage, 'test.ci.compose');
    }
    const accessToken = await BrowserRecipe.getGoogleAccessToken(settingsPage, acctEmail);
    const cleanupTasks = [settingsPage.close()];
    if (testVariant === 'CONSUMER-LIVE-GMAIL') {
      // clean up drafts so that broken tests from the past don't affect this test run
      cleanupTasks.push(BrowserRecipe.deleteAllDraftsInGmailAccount(accessToken));
    }
    await Promise.all(cleanupTasks);
    const authHdr = { Authorization: `Bearer ${accessToken}` }; // eslint-disable-line @typescript-eslint/naming-convention
    return { acctEmail, accessToken, authHdr };
  };

  public static setupCommonAcctWithAttester = async (t: AvaContext, browser: BrowserHandle, acct: TestAccount, config?: CommonAcctConfig) => {
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
    if (!t.context.mockApi!.configProvider) {
      t.context.mockApi!.configProvider = new ConfigurationProvider({});
    }
    t.context.mockApi!.configProvider.config.attester = {
      ...(t.context.mockApi!.configProvider.config.attester ?? {}),
      pubkeyLookup: {
        [acctEmail]: {
          pubkey: KeyUtil.armor(pubKey),
        },
      },
    };
    if (config?.attester) {
      if (config.attester.includeHumanKey) {
        t.context.mockApi!.configProvider.config.attester.pubkeyLookup!['human@flowcrypt.com'] = {
          pubkey: somePubkey,
        };
      }
      if (config.attester.includeFlowcryptCompatibilityKey) {
        t.context.mockApi!.configProvider.config.attester.pubkeyLookup!['flowcrypt.compatibility@gmail.com'] = {
          pubkey: somePubkey,
        };
      }
      if (config.attester.pubkeyLookup) {
        t.context.mockApi!.configProvider.config.attester.pubkeyLookup = {
          ...t.context.mockApi!.configProvider.config.attester.pubkeyLookup,
          ...config.attester.pubkeyLookup,
        };
      }
    }
    if (config?.google) {
      t.context.mockApi!.configProvider.config.google = {
        contacts: config.google.contacts,
        aliases: config.google.acctAliases ? { [acctEmail]: config.google.acctAliases } : undefined,
        primarySignature: config.google.acctPrimarySignature ? { [acctEmail]: config.google.acctPrimarySignature } : undefined,
        draftIdToSave: config.google.draftIdToSave,
        threadNotFoundError: config.google.threadNotFoundError,
        htmlRenderer: config.google.htmlRenderer,
        getMsg: config.google.getMsg,
      };
    }
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

  public static getCustomIDPIdTokenFromInMemoryStore = (controllable: Controllable, acctEmail: string): Promise<string> =>
    BrowserRecipe.getFromInMemoryStore(controllable, acctEmail, 'customIdpIdToken');

  public static deleteAllDraftsInGmailAccount = async (accessToken: string): Promise<void> => {
    const gmail = google.gmail({ version: 'v1' });
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const list = await gmail.users.drafts.list({ userId: 'me', access_token: accessToken });
    if (list.data.drafts) {
      await BrowserRecipe.deleteDrafts(list.data.drafts, accessToken);
    }
  };

  public static deleteDrafts = async (drafts: gmail_v1.Schema$Draft[], accessToken: string) => {
    const gmail = google.gmail({ version: 'v1' });
    await Promise.all(
      drafts
        .filter(draft => draft.id)
        // eslint-disable-next-line @typescript-eslint/naming-convention
        .map(draft => gmail.users.drafts.delete({ id: draft.id!, userId: 'me', access_token: accessToken }))
    );
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

  // todo: move to gmail-page-recipe
  public static pgpBlockVerifyDecryptedContent = async (
    t: AvaContext,
    browser: BrowserHandle,
    msgId: string,
    m: TestMessageAndSession,
    extraHeaders: Record<string, string>
  ) => {
    const gmailPage = await browser.newPage(t, `${t.context.urls?.mockGmailUrl()}/${msgId}`, undefined, extraHeaders);
    await BrowserRecipe.checkDecryptMsgOnPage(t, gmailPage, m);
    await gmailPage.close();
  };

  // todo: move some of these helpers somewhere to page-recipe/...
  // gmail or inbox
  public static checkDecryptMsgOnPage = async (t: AvaContext, page: ControllablePage, m: TestMessageAndSession) => {
    await page.waitAll('iframe');
    if (m.finishSessionBeforeTesting) {
      await BrowserRecipe.finishSession(page);
      await page.waitAll('iframe');
    }
    await BrowserRecipe.pgpBlockCheck(t, await page.getFrame(['pgp_block.htm']), m);
    if (m.finishSessionAfterTesting) {
      await BrowserRecipe.finishSession(page);
      await page.waitAll('iframe');
      const pgpBlockFrame = await page.getFrame(['pgp_block.htm']);
      await pgpBlockFrame.waitAll('@pgp-block-content');
      await pgpBlockFrame.waitForSelTestState('ready');
      await pgpBlockFrame.waitAndClick('@action-show-passphrase-dialog', { delay: 1 });
      await page.waitAll('@dialog-passphrase');
    }
  };

  // gmail or inbox
  public static finishSession = async (page: ControllablePage) => {
    await page.waitAndClick('@action-finish-session');
    await page.waitTillGone('@action-finish-session');
    await Util.sleep(3); // give frames time to reload, else we will be manipulating them while reloading -> Error: waitForFunction failed: frame got detached.
  };

  // todo: move to page-recipe/pgp-block-frame-recipe or frame-recipe/pgp-block-frame-recipe?
  public static pgpBlockCheck = async (t: AvaContext, pgpBlockFrame: ControllableFrame, m: TestMessage) => {
    if (m.expectPercentageProgress) {
      await pgpBlockFrame.waitForContent('@pgp-block-content', /Retrieving message... \d+%/, 20, 10);
    } else {
      await pgpBlockFrame.waitAll('@pgp-block-content');
    }
    await pgpBlockFrame.waitForSelTestState('ready', 100);
    await Util.sleep(1);
    if (m.enterPp) {
      const page = pgpBlockFrame.getPage();
      await page.notPresent('@action-finish-session');
      const errBadgeContent = await pgpBlockFrame.read('@pgp-error');
      expect(errBadgeContent).to.equal('pass phrase needed');
      await pgpBlockFrame.notPresent('@action-print');
      await pgpBlockFrame.waitAndClick('@action-show-passphrase-dialog', { delay: 1 });
      await page.waitAll('@dialog-passphrase');
      const ppFrame = await page.getFrame(['passphrase.htm']);
      await ppFrame.waitAndType('@input-pass-phrase', m.enterPp.passphrase);
      if (m.enterPp.isForgetPpHidden !== undefined) {
        expect(await ppFrame.hasClass('@forget-pass-phrase-label', 'hidden')).to.equal(m.enterPp.isForgetPpHidden);
      }
      if (m.enterPp.isForgetPpChecked !== undefined) {
        expect(await ppFrame.isChecked('@forget-pass-phrase-checkbox')).to.equal(m.enterPp.isForgetPpChecked);
      }
      await ppFrame.waitAndClick('@action-confirm-pass-phrase-entry', { delay: 1 });
      await pgpBlockFrame.waitForSelTestState('ready');
      await page.waitAll('@action-finish-session'); // todo: gmail
      await Util.sleep(1);
    }

    if (m.quoted) {
      await pgpBlockFrame.waitAndClick('@action-show-quoted-content');
      await Util.sleep(1);
    } else {
      if (await pgpBlockFrame.isElementPresent('@action-show-quoted-content')) {
        throw new Error(`element: @action-show-quoted-content not expected in: ${t.title}`);
      }
    }
    const content = await pgpBlockFrame.read('@pgp-block-content');
    for (const expectedContent of m.content) {
      if (!content?.includes(expectedContent)) {
        throw new Error(`pgp_block_verify_decrypted_content:missing expected content: ${expectedContent}` + `\nactual content: ${content}`);
      }
    }
    if (m.unexpectedContent) {
      for (const unexpectedContent of m.unexpectedContent) {
        if (content!.includes(unexpectedContent)) {
          throw new Error(`pgp_block_verify_decrypted_content:unexpected content presents: ${unexpectedContent}`);
        }
      }
    }
    const sigBadgeContent = await pgpBlockFrame.read('@pgp-signature');
    const encBadgeContent = await pgpBlockFrame.read('@pgp-encryption');
    if (m.signature) {
      // todo: check color, 'signed' should have 'green_label' class without 'red_label', others should have 'red_label' class
      if (sigBadgeContent !== m.signature) {
        t.log(`found sig content:${sigBadgeContent}`);
        throw new Error(`pgp_block_verify_decrypted_content:missing expected signature content:${m.signature}\nactual sig content:${sigBadgeContent}`);
      }
    } else if (!m.error) {
      // some badge still has to be present
      expect(sigBadgeContent).to.be.ok;
    }
    if (m.encryption) {
      if (encBadgeContent !== m.encryption) {
        t.log(`found enc content:${encBadgeContent}`);
        throw new Error(`pgp_block_verify_decrypted_content:missing expected encryption content:${m.encryption}`);
      }
    } else if (!m.error) {
      // some badge still has to be present
      expect(encBadgeContent).to.be.ok;
    }
    if (m.error) {
      expect(sigBadgeContent).to.be.empty;
      expect(encBadgeContent).to.be.empty;
      await pgpBlockFrame.notPresent('@action-print');
      const errBadgeContent = await pgpBlockFrame.read('@pgp-error');
      if (errBadgeContent !== m.error) {
        t.log(`found err content:${errBadgeContent}`);
        throw new Error(`pgp_block_verify_decrypted_content:missing expected error content:${m.error}`);
      }
    } else {
      await pgpBlockFrame.waitAll('@pgp-error', { visible: false });
      if (m.content.length > 0) {
        if (!(await pgpBlockFrame.isElementVisible('@action-print'))) {
          throw new Error(`Print button is invisible`);
        }
      }
    }
  };
}
