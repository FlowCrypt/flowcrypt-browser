/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { Config, Util } from '../../util';

import { AvaContext } from '..';
import { ControllablePage } from '../../browser';
import { FlowCryptApi } from '../api';
import { PageRecipe } from './abstract-page-recipe';

export class OauthPageRecipe extends PageRecipe {

  private static longTimeout = 40;

  public static google = async (t: AvaContext, oauthPage: ControllablePage, acctEmail: string, action: "close" | "deny" | "approve" | 'login'): Promise<void> => {
    const isMock = oauthPage.target.url().includes('localhost');
    const auth = Config.secrets.auth.google.find(a => a.email === acctEmail)!;
    const selectors = {
      approve_button: '#submit_approve_access',
      email_input: '#identifierId',
      email_confirm_btn: '#identifierNext',
      auth0_username: '#username',
      auth0_password: '#password',
      auth0_login_btn: 'button', // old: ._button-login
    };
    try {
      await oauthPage.waitAny('#Email, #submit_approve_access, #identifierId, .w6VTHd, #profileIdentifier', { timeout: 45 });
      if (await oauthPage.target.$(selectors.email_input) !== null) { // 2017-style login
        await oauthPage.waitAll(selectors.email_input, { timeout: OauthPageRecipe.longTimeout });
        await oauthPage.waitAndType(selectors.email_input, auth.email, { delay: isMock ? 0 : 2 });
        await oauthPage.waitAndClick(selectors.email_confirm_btn, { delay: isMock ? 0 : 2 });  // confirm email
        await oauthPage.waitForNavigationIfAny();
      } else if (await oauthPage.target.$(`#profileIdentifier[data-email="${auth.email}"]`) !== null) { // already logged in - just choose an account
        await oauthPage.waitAndClick(`#profileIdentifier[data-email="${auth.email}"]`, { delay: isMock ? 0.1 : 1 });
        if (isMock) {
          try { await oauthPage.page.waitForNavigation({ timeout: 3000 }); } catch (e) { /* continue, should not cause trouble */ }
        }
      } else if (await oauthPage.target.$('.w6VTHd') !== null) { // select from accounts where already logged in
        await oauthPage.waitAndClick('.bLzI3e', { delay: isMock ? 0 : 1 }); // choose other account, also try .TnvOCe .k6Zj8d .XraQ3b
        await Util.sleep(isMock ? 0 : 2);
        return await OauthPageRecipe.google(t, oauthPage, acctEmail, action); // start from beginning after clicking "other email acct"
      }
      await Util.sleep(isMock ? 0 : 2);
      if (action === 'login') {
        await Util.sleep(isMock ? 0 : 3);
        if (oauthPage.page.isClosed()) {
          return;
        }
        throw new Error('Oauth page didnt close after login. Should increase timeout or await close event');
      }
      await oauthPage.waitAny([selectors.approve_button, selectors.auth0_username]);
      if (await oauthPage.isElementPresent(selectors.auth0_username)) {
        await oauthPage.waitAndType(selectors.auth0_username, auth.email);
        console.log(oauthPage.target.url());
        await oauthPage.waitAndType(selectors.auth0_password, auth.password!);
        await oauthPage.waitAndClick(selectors.auth0_login_btn);
        await oauthPage.waitForNavigationIfAny();
      }
      await Util.sleep(isMock ? 0 : 1);
      await oauthPage.waitAll(selectors.approve_button); // if succeeds, we are logged in and presented with approve/deny choice
      // since we are successfully logged in, we may save cookies to keep them fresh
      // no need to await the API call because it's not crucial to always save it, can mostly skip errors
      FlowCryptApi.hookCiCookiesSet(auth.email, await oauthPage.page.cookies()).catch(e => console.error(String(e)));
      if (action === 'close') {
        await oauthPage.close();
      } else if (action === 'deny') {
        throw new Error('tests.handle_gmail_oauth options.deny.true not implemented');
      } else {
        await oauthPage.waitAndClick('#submit_approve_access', { delay: isMock ? 0 : 1 });
      }
    } catch (e) {
      const eStr = String(e);
      if (eStr.indexOf('Execution context was destroyed') === -1 && eStr.indexOf('Cannot find context with specified id') === -1) {
        throw e; // not a known retriable error
      }
      // t.log(`Attempting to retry google auth:${action} on the same window for ${email} because: ${eStr}`);
      return await OauthPageRecipe.google(t, oauthPage, acctEmail, action); // retry, it should pick up where it left off
    }
  }

}
