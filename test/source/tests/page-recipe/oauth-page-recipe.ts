/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { Config, Util } from '../../util';
import { AvaContext } from '../tooling/';
import { ControllablePage } from '../../browser/controllable';
import { PageRecipe } from './abstract-page-recipe';
import { Url } from '../../core/common';

export class OauthPageRecipe extends PageRecipe {
  private static longTimeout = 40;

  public static mock = async (
    t: AvaContext,
    oauthPage: ControllablePage,
    acctEmail: string,
    action: 'close' | 'deny' | 'approve' | 'login' | 'login_with_invalid_state' | 'override_acct' | 'missing_permission'
  ): Promise<void> => {
    let mockOauthUrl = oauthPage.target.url();
    const { login_hint } = Url.parse(['login_hint'], mockOauthUrl); // eslint-disable-line @typescript-eslint/naming-convention
    if (action === 'close') {
      await oauthPage.close();
    } else if (action === 'login_with_invalid_state') {
      mockOauthUrl = Url.removeParamsFromUrl(mockOauthUrl, ['login_hint']);
      await OauthPageRecipe.safeGoto(
        oauthPage,
        mockOauthUrl.replace('CRYPTUP_STATE', 'INVALID_CRYPTUP_STATE') + '&login_hint=' + encodeURIComponent(acctEmail) + '&proceed=true'
      );
    } else if (action === 'missing_permission') {
      mockOauthUrl = Url.removeParamsFromUrl(mockOauthUrl, ['scope']);
      mockOauthUrl += '&scope=missing_scope';
      await OauthPageRecipe.safeGoto(oauthPage, mockOauthUrl + '&proceed=true');
    } else if (!login_hint) {
      await OauthPageRecipe.safeGoto(oauthPage, mockOauthUrl + '&login_hint=' + encodeURIComponent(acctEmail) + '&proceed=true');
    } else {
      if (action === 'override_acct') {
        mockOauthUrl = Url.removeParamsFromUrl(mockOauthUrl, ['login_hint']);
        mockOauthUrl += '&login_hint=' + encodeURIComponent(acctEmail);
      }
      await OauthPageRecipe.safeGoto(oauthPage, mockOauthUrl + '&proceed=true');
    }
  };

  public static customIdp = async (t: AvaContext, oauthPage: ControllablePage): Promise<void> => {
    const mockOauthUrl = oauthPage.target.url();
    await OauthPageRecipe.safeGoto(oauthPage, mockOauthUrl + '&proceed=true');
  };

  public static google = async (
    t: AvaContext,
    oauthPage: ControllablePage,
    acctEmail: string,
    action: 'close' | 'deny' | 'approve' | 'login' | 'login_with_invalid_state'
  ): Promise<void> => {
    if (oauthPage.page.isClosed()) {
      return;
    }
    if (oauthPage.target.url().includes('localhost')) {
      await OauthPageRecipe.mock(t, oauthPage, acctEmail, action);
      return;
    }
    const auth = Config.secrets().auth.google.find(a => a.email === acctEmail);
    const acctPassword = auth?.password;
    const selectors = {
      googleEmailInput: '#identifierId',
      googleEmailConfirmBtn: '#identifierNext',
      auth0username: '#username',
      auth0password: '#password',
      auth0loginBtn: 'button[type=submit][name=action][value=default]',
      googleApproveBtn: '#submit_approve_access',
      googleConfirmAccountBtn: 'button[formaction*="confirmaccount?"], form[action*="confirmaccount?"] button[type="submit"]',
      googleSamlConfirmAccountBtn: '[data-view-id="AZBvBc"] [jsname="Njthtb"] button',
      googleContinueAuthBtn: '.VfPpkd-LgbsSe',
      googleSignInWithGoogleContinueBtn: '//button[.//span[normalize-space(.)="Continue"]]',
    };
    // The SAML confirmation view uses JS buttons without form actions, and its labels are localized.
    const confirmationButtons = [selectors.googleConfirmAccountBtn, selectors.googleSamlConfirmAccountBtn, selectors.googleSignInWithGoogleContinueBtn];
    try {
      const alreadyLoggedSelector = '.w6VTHd, .wLBAL, .yAlK0b';
      const alreadyLoggedChooseOtherAccountSelector = '.bLzI3e, .BHzsHc';
      await oauthPage.waitAny(
        [
          `#Email, ${selectors.googleApproveBtn}, ${selectors.googleEmailInput}, ${alreadyLoggedSelector}, #profileIdentifier, ${selectors.auth0username}, ${selectors.googleContinueAuthBtn}`,
          ...confirmationButtons,
        ],
        { timeout: 45 }
      );

      if (await oauthPage.target.$(selectors.googleEmailInput)) {
        // 2017-style login
        await oauthPage.waitAll(selectors.googleEmailInput, { timeout: OauthPageRecipe.longTimeout });
        await oauthPage.waitAndType(selectors.googleEmailInput, acctEmail, { delay: 2 });
        await oauthPage.waitAll(selectors.googleEmailConfirmBtn);
        await Util.sleep(2);
        await oauthPage.waitForNavigationIfAny(() => oauthPage.waitAndClick(selectors.googleEmailConfirmBtn));
      } else if (await oauthPage.target.$(`.wLBAL[data-email="${acctEmail}"]`)) {
        // already logged in - just choose an account
        await oauthPage.waitAndClick(`.wLBAL[data-email="${acctEmail}"]`, { delay: 1 });
      } else if (await oauthPage.target.$(`.yAlK0b[data-email="${acctEmail}"]`)) {
        // already logged in - just choose an account (google ui update 2024)
        await oauthPage.waitAndClick(`.yAlK0b[data-email="${acctEmail}"]`, { delay: 1 });
      } else if (await oauthPage.target.$(alreadyLoggedSelector)) {
        // select from accounts where already logged in
        await oauthPage.waitAndClick(alreadyLoggedChooseOtherAccountSelector, { delay: 1 }); // choose other account, also try .TnvOCe .k6Zj8d .XraQ3b
        await Util.sleep(2);
        return await OauthPageRecipe.google(t, oauthPage, acctEmail, action); // start from beginning after clicking "other email acct"
      } else if (await oauthPage.target.$('.wLBAL[data-email="dummy"]')) {
        // let any e-mail pass
        const href = (await oauthPage.attr('.wLBAL', 'href')) + acctEmail;
        await oauthPage.goto(href);
      }
      await Util.sleep(2);
      if (action === 'login') {
        await Util.sleep(3);
        if (oauthPage.page.isClosed()) {
          return;
        }
        throw new Error('Oauth page didnt close after login. Should increase timeout or await close event');
      }
      if ((await oauthPage.isElementPresent('.F9NWFb')) || (await oauthPage.isElementPresent('.Svhjgc'))) {
        // additional confirmation screen
        const actionButtons = await oauthPage.target.$$(selectors.googleContinueAuthBtn);
        await oauthPage.waitForNavigationIfAny(() => actionButtons[actionButtons.length - 1].click());
      }
      await oauthPage.waitAny([selectors.googleApproveBtn, selectors.auth0username, ...confirmationButtons]);
      if (await oauthPage.isElementPresent(selectors.auth0username)) {
        await oauthPage.waitAndType(selectors.auth0username, acctEmail);
        if (acctPassword) {
          await oauthPage.waitAndType(selectors.auth0password, acctPassword);
        }
        const loginButtons = await oauthPage.target.$$(selectors.auth0loginBtn);
        await oauthPage.waitForNavigationIfAny(() => loginButtons[loginButtons.length - 1].click());
        const nextButton = await oauthPage.waitAny([selectors.googleApproveBtn, ...confirmationButtons, alreadyLoggedSelector]);
        if (await nextButton.evaluate((button, selector) => button.matches(selector), alreadyLoggedSelector)) {
          await nextButton.click();
        }
      }
      const button = await oauthPage.waitAny([selectors.googleApproveBtn, ...confirmationButtons]);
      if (!(await button.evaluate((button, selector) => button.matches(selector), selectors.googleApproveBtn))) {
        // Account confirmation can appear before either account selection or OAuth consent.
        await oauthPage.waitForNavigationIfAny(() => button.click());
        return await OauthPageRecipe.google(t, oauthPage, acctEmail, action);
      }
      // since we are successfully logged in, we may save cookies to keep them fresh
      // no need to await the API call because it's not crucial to always save it, can mostly skip errors
      if (action === 'close') {
        await oauthPage.close();
      } else if (action === 'deny') {
        throw new Error('tests.handle_gmail_oauth options.deny.true not implemented');
      } else {
        await oauthPage.waitAndClick(selectors.googleApproveBtn, { delay: 1 });
      }
    } catch (e) {
      if (oauthPage.page.isClosed()) {
        return;
      }
      if (!Util.isTransientPageError(e)) {
        throw e; // not a known retriable error
      }
      return await OauthPageRecipe.google(t, oauthPage, acctEmail, action); // retry, it should pick up where it left off
    }
  };

  /**
   * Check if an error is a "Navigating frame was detached" error.
   * This can happen when the OAuth page closes during navigation (e.g., successful auth).
   * @param e - The error to check
   * @returns true if this is a frame detached error that can be safely ignored
   */
  private static isFrameDetachedError(e: unknown): boolean {
    if (!e) {
      return false;
    }
    // Check if it's an Error object with a message property
    if (e instanceof Error) {
      return e.message.includes('Navigating frame was detached') || e.message.includes('frame was detached');
    }
    // Check if it's already a string
    if (typeof e === 'string') {
      return e.includes('Navigating frame was detached') || e.includes('frame was detached');
    }
    // For other types, we can't reliably check - return false to be safe
    return false;
  }

  /**
   * Safely navigate to a URL, ignoring "frame was detached" errors.
   * The OAuth page may close during navigation on successful auth.
   * @param oauthPage - The OAuth page to navigate
   * @param url - The URL to navigate to
   */
  private static async safeGoto(oauthPage: ControllablePage, url: string): Promise<void> {
    try {
      await oauthPage.target.goto(url);
    } catch (e: unknown) {
      if (!OauthPageRecipe.isFrameDetachedError(e)) {
        throw e;
      }
      // Ignore frame detached errors - page closed successfully
    }
  }
}
