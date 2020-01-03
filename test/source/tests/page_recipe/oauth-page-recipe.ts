/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { Config, Util } from '../../util';

import { AvaContext } from '..';
import { ControllablePage } from '../../browser';
import { FlowCryptApi } from '../api';
import { PageRecipe } from './abstract-page-recipe';
import { totp as produce2faToken } from 'speakeasy';

export class OauthPageRecipe extends PageRecipe {

  private static oauthPwdDelay = 2;
  private static longTimeout = 40;

  public static google = async (t: AvaContext, oauthPage: ControllablePage, acctEmail: string, action: "close" | "deny" | "approve" | 'login'): Promise<void> => {
    const isMock = oauthPage.target.url().includes('localhost');
    const auth = Config.secrets.auth.google.find(a => a.email === acctEmail)!;
    const selectors = {
      backup_email_verification_choice: "//div[@class='vdE7Oc' and text() = 'Confirm your recovery email']",
      approve_button: '#submit_approve_access',
      pwd_input: 'input[type="password"]', // pwd_input: '.zHQkBf',
      pwd_confirm_btn: '.CwaK9',
      secret_2fa: '#totpPin',
    };
    const enterPwdAndConfirm = async () => {
      await Util.sleep(isMock ? 0 : OauthPageRecipe.oauthPwdDelay);
      await oauthPage.waitAndType(selectors.pwd_input, auth.password, { delay: isMock ? 0 : OauthPageRecipe.oauthPwdDelay });
      await oauthPage.waitAndClick(selectors.pwd_confirm_btn, { delay: isMock ? 0 : 1 });  // confirm password
      await oauthPage.waitForNavigationIfAny();
    };
    try {
      await oauthPage.waitAny('#Email, #submit_approve_access, #identifierId, .w6VTHd, #profileIdentifier', { timeout: 45 });
      if (await oauthPage.target.$('#Email') !== null) { // 2016-style login
        await oauthPage.waitAll('#Email', { timeout: OauthPageRecipe.longTimeout });
        await oauthPage.waitAndType('#Email', auth.email);
        await oauthPage.waitAndClick('#next');
        await oauthPage.waitForNavigationIfAny();
        await Util.sleep(isMock ? 0 : OauthPageRecipe.oauthPwdDelay);
        await oauthPage.waitAndType('#Passwd', auth.password, { delay: isMock ? 0 : OauthPageRecipe.oauthPwdDelay });
        await oauthPage.waitForNavigationIfAny();
        await oauthPage.waitAndClick('#signIn', { delay: isMock ? 0 : 1 });
        await oauthPage.waitForNavigationIfAny();
      } else if (await oauthPage.target.$('#identifierId') !== null) { // 2017-style login
        await oauthPage.waitAll('#identifierId', { timeout: OauthPageRecipe.longTimeout });
        await oauthPage.waitAndType('#identifierId', auth.email, { delay: isMock ? 0 : 2 });
        await oauthPage.waitAndClick('.zZhnYe', { delay: isMock ? 0 : 2 });  // confirm email
        await oauthPage.waitForNavigationIfAny();
        await enterPwdAndConfirm();
      } else if (await oauthPage.target.$(`#profileIdentifier[data-email="${auth.email}"]`) !== null) { // already logged in - just choose an account
        await oauthPage.waitAndClick(`#profileIdentifier[data-email="${auth.email}"]`, { delay: isMock ? 0.1 : 1 });
        if (isMock) {
          try {
            await oauthPage.page.waitForNavigation({ timeout: 3000 });
          } catch (e) {
            // continue, should not cause trouble
          }
        }
      } else if (await oauthPage.target.$('.w6VTHd') !== null) { // select from accounts where already logged in
        await oauthPage.waitAndClick('.bLzI3e', { delay: isMock ? 0 : 1 }); // choose other account, also try .TnvOCe .k6Zj8d .XraQ3b
        await Util.sleep(isMock ? 0 : 2);
        return await OauthPageRecipe.google(t, oauthPage, acctEmail, action); // start from beginning after clicking "other email acct"
      }
      await Util.sleep(isMock ? 0 : 5);
      if (action === 'login') {
        await Util.sleep(isMock ? 0 : 3);
        if (oauthPage.page.isClosed()) {
          return;
        }
        throw new Error('Oauth page didnt close after login. Should increase timeout or await close event');
      }
      const element = await oauthPage.waitAny([selectors.approve_button, selectors.backup_email_verification_choice, selectors.pwd_input, selectors.secret_2fa]);
      await Util.sleep(isMock ? 0 : 1);
      if (await oauthPage.isElementPresent(selectors.backup_email_verification_choice)) { // asks for registered backup email
        await element.click();
        await oauthPage.waitAndType('#knowledge-preregistered-email-response', auth.backup, { delay: isMock ? 0 : 2 });
        await oauthPage.waitAndClick('#next', { delay: isMock ? 0 : 2 });
      } else if (await oauthPage.isElementPresent(selectors.pwd_input)) {
        await enterPwdAndConfirm(); // unsure why it requires a password second time, but sometimes happens
      } else if (await oauthPage.isElementPresent(selectors.secret_2fa)) {
        if (!auth.secret_2fa) {
          throw Error(`Google account ${auth.email} requires a 2fa but missing 2fa secret`);
        }
        const token = produce2faToken({ secret: auth.secret_2fa, encoding: 'base32' });
        await oauthPage.waitAndType(selectors.secret_2fa, token);
        await oauthPage.waitAndClick('#totpNext', { delay: isMock ? 0 : 2, confirmGone: true });
      }
      await oauthPage.waitAll('#submit_approve_access'); // if succeeds, we are logged in and presented with approve/deny choice
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
