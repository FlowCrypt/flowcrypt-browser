/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import * as request from 'fc-node-requests';

import { Config } from '../../util';
import { Cookie } from 'puppeteer';
import { Response } from 'request';

const ci_admin_token = Config.secrets().ci_admin_token;

class ApiErrResponse extends Error {
  public response: Response;
  constructor(message: string, response: Response) {
    super(message);
    this.response = response;
  }
}

export class FlowCryptApi {

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
    if (!ci_admin_token) {
      return;
    }
    console.info(`hookCiDebugEmail - calling with length: ${debug_html_content.length}`);
    const r = await FlowCryptApi.call('https://flowcrypt.com/api/hook/ci_debug_email', { ci_admin_token, debug_title, debug_html_content });
    console.info('hookCiDebugEmail-response', r.body, r.statusCode);
  }

  private static call = async (url: string, values: { [k: string]: any }) => {
    const r = await request.post({ url, json: values, headers: { 'api-version': 3 } });
    if (r.body.error) {
      throw new ApiErrResponse(`FlowCryptApi ${url} returned an error: ${r.body.error.message}`, r);
    }
    return r;
  }

}
