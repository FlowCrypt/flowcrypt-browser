import * as request from 'fc-node-requests';

import { Config } from '../util';
import { Cookie } from 'puppeteer';
import { Response } from 'request';

const ci_admin_token = Config.secrets.ci_admin_token;

class ApiErrResponse extends Error {
  public response: Response;
  constructor(message: string, response: Response) {
    super(message);
    this.response = response;
  }
}

export class FlowCryptApi {

  private static COOKIE_CACHE: { [acct: string]: Cookie[] } = {};

  private static call = async (url: string, values: { [k: string]: any }) => {
    const r = await request.post({ url, json: values, headers: { 'api-version': 3 } });
    if (r.body.error) {
      throw new ApiErrResponse(`FlowCryptApi ${url} returned an error: ${r.body.error.message}`, r);
    }
    return r;
  }

  public static hookCiAcctDelete = async (email: string) => {
    try {
      await FlowCryptApi.call('https://flowcrypt.com/api/hook/ci_account_delete', { ci_admin_token, email });
    } catch (e) {
      if (e.message instanceof ApiErrResponse && e.response.body.error.message === 'Unknown account email') {
        throw e;
      }
    }
  }

  public static hookCiSubscriptionExpire = async (email: string) => {
    await FlowCryptApi.call('https://flowcrypt.com/api/hook/ci_subscription_expire', { ci_admin_token, email });
  }

  public static hookCiSubscriptionReset = async (email: string) => {
    await FlowCryptApi.call('https://flowcrypt.com/api/hook/ci_subscription_reset', { ci_admin_token, email });
  }

  public static hookCiDebugEmail = async (debug_title: string, debug_html_content: string) => { // tslint:disable-line:variable-name
    console.info(`hookCiDebugEmail - calling with length: ${debug_html_content.length}`);
    const r = await FlowCryptApi.call('https://flowcrypt.com/api/hook/ci_debug_email', { ci_admin_token, debug_title, debug_html_content });
    console.info('hookCiDebugEmail-response', r.body, r.statusCode);
  }

  public static hookCiCookiesGet = async (acct: string): Promise<Cookie[] | undefined> => {
    if (!FlowCryptApi.COOKIE_CACHE[acct]) {
      const { body: { cookies } } = await FlowCryptApi.call('https://flowcrypt.com/api/hook/ci_cookies_get', { ci_admin_token, acct });
      FlowCryptApi.COOKIE_CACHE[acct] = cookies ? JSON.parse(cookies) : undefined;
    }
    return FlowCryptApi.COOKIE_CACHE[acct];
  }

  public static hookCiCookiesSet = async (acct: string, cookies: Cookie[]) => {
    FlowCryptApi.COOKIE_CACHE[acct] = cookies;
    await FlowCryptApi.call('https://flowcrypt.com/api/hook/ci_cookies_set', { ci_admin_token, acct, cookies: JSON.stringify(cookies) });
  }

  public static ciInitialize = async (acct: string, pwd: string, backup: string) => {
    const r = await FlowCryptApi.call('https://cron.flowcrypt.com/ci_initialize', { ci_admin_token, acct, pwd, backup });
    if (!r.body.success) {
      if (r.body.errHtml) {
        try {
          await FlowCryptApi.hookCiDebugEmail('ci_browser: ci_initialize', r.body.errHtml);
        } catch (e) {
          console.error('error calling ciInitialize', r.body);
          console.error('error calling hookDebugEmail about it:', String(e));
        }
      }
    }
  }

}
