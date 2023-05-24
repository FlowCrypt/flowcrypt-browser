/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { Config, Util } from '../../util';
import { AvaContext } from '../tooling/';
import { ControllablePage, TIMEOUT_PAGE_LOAD } from '../../browser';
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
      await oauthPage.target.goto(
        mockOauthUrl.replace('CRYPTUP_STATE', 'INVALID_CRYPTUP_STATE') + '&login_hint=' + encodeURIComponent(acctEmail) + '&proceed=true'
      );
    } else if (action === 'missing_permission') {
      mockOauthUrl = Url.removeParamsFromUrl(mockOauthUrl, ['scope']);
      mockOauthUrl += '&scope=missing_scope';
      await oauthPage.target.goto(mockOauthUrl + '&proceed=true');
    } else if (!login_hint) {
      await oauthPage.target.goto(mockOauthUrl + '&login_hint=' + encodeURIComponent(acctEmail) + '&proceed=true');
    } else {
      if (action === 'override_acct') {
        mockOauthUrl = Url.removeParamsFromUrl(mockOauthUrl, ['login_hint']);
        mockOauthUrl += '&login_hint=' + encodeURIComponent(acctEmail);
      }
      await oauthPage.target.goto(mockOauthUrl + '&proceed=true');
    }
  };

  public static google = async (
    t: AvaContext,
    oauthPage: ControllablePage,
    acctEmail: string,
    action: 'close' | 'deny' | 'approve' | 'login' | 'login_with_invalid_state'
  ): Promise<void> => {
    try {
      const isMock = oauthPage.target.url().includes('localhost');
      if (isMock) {
        await OauthPageRecipe.mock(t, oauthPage, acctEmail, action);
        return;
      } else {
        await Promise.race([
          oauthPage.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: TIMEOUT_PAGE_LOAD * 1000 }),
          oauthPage.page.waitForNavigation({ waitUntil: 'load', timeout: TIMEOUT_PAGE_LOAD * 1000 }),
        ]);
      }
    } catch (e) {
      if (String(e).includes('page has been closed')) {
        // the extension may close the auth page after success before we had a chance to evaluate it
        return; // in this case the login was already successful
      }
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
    };
    try {
      const alreadyLoggedSelector = '.w6VTHd, .wLBAL';
      const alreadyLoggedChooseOtherAccountSelector = '.bLzI3e, .BHzsHc';
      await oauthPage.waitAny(
        `#Email, ${selectors.googleApproveBtn}, ${selectors.googleEmailInput}, ${alreadyLoggedSelector}, #profileIdentifier, ${selectors.auth0username}`,
        { timeout: 45 }
      );
      // eslint-disable-next-line no-null/no-null
      if ((await oauthPage.target.$(selectors.googleEmailInput)) !== null) {
        // 2017-style login
        await oauthPage.waitAll(selectors.googleEmailInput, { timeout: OauthPageRecipe.longTimeout });
        await oauthPage.waitAndType(selectors.googleEmailInput, acctEmail, { delay: 2 });
        await oauthPage.waitAll(selectors.googleEmailConfirmBtn);
        await Util.sleep(2);
        await oauthPage.waitForNavigationIfAny(() => oauthPage.waitAndClick(selectors.googleEmailConfirmBtn));
        // eslint-disable-next-line no-null/no-null
      } else if ((await oauthPage.target.$(`.wLBAL[data-email="${acctEmail}"]`)) !== null) {
        // already logged in - just choose an account
        await oauthPage.waitAndClick(`.wLBAL[data-email="${acctEmail}"]`, { delay: 1 });
        // eslint-disable-next-line no-null/no-null
      } else if ((await oauthPage.target.$(alreadyLoggedSelector)) !== null) {
        // select from accounts where already logged in
        await oauthPage.waitAndClick(alreadyLoggedChooseOtherAccountSelector, { delay: 1 }); // choose other account, also try .TnvOCe .k6Zj8d .XraQ3b
        await Util.sleep(2);
        return await OauthPageRecipe.google(t, oauthPage, acctEmail, action); // start from beginning after clicking "other email acct"
        // eslint-disable-next-line no-null/no-null
      } else if ((await oauthPage.target.$('.wLBAL[data-email="dummy"]')) !== null) {
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
      await oauthPage.waitAny([selectors.googleApproveBtn, selectors.auth0username]);
      if (await oauthPage.isElementPresent(selectors.auth0username)) {
        await oauthPage.waitAndType(selectors.auth0username, acctEmail);
        if (acctPassword) {
          await oauthPage.waitAndType(selectors.auth0password, acctPassword);
        }
        const loginButtons = await oauthPage.target.$$(selectors.auth0loginBtn);
        await oauthPage.waitForNavigationIfAny(() => loginButtons[loginButtons.length - 1].click());
        await oauthPage.waitAndClick(alreadyLoggedSelector, { delay: 1 });
      }
      await Util.sleep(1);
      const button = await oauthPage.waitAny('button');
      const formAction = await button.evaluate(button => (button as HTMLButtonElement).formAction);
      if (formAction?.includes('confirmaccount?')) {
        // click on "Continue" on "Verify it's you" screen
        await button.click();
        await Util.sleep(2);
        return await OauthPageRecipe.google(t, oauthPage, acctEmail, action); // it should handle the list of accounts
      }
      await oauthPage.waitAll(selectors.googleApproveBtn); // if succeeds, we are logged in and presented with approve/deny choice
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
      const eStr = String(e);
      if (
        !eStr.includes('Execution context was destroyed') &&
        !eStr.includes('Cannot find context with specified id') &&
        !eStr.includes('Argument should belong to the same JavaScript world as target object')
      ) {
        throw e; // not a known retriable error
      }
      // t.log(`Attempting to retry google auth:${action} on the same window for ${email} because: ${eStr}`);
      return await OauthPageRecipe.google(t, oauthPage, acctEmail, action); // retry, it should pick up where it left off
    }
  };
}
