import * as request from 'fc-node-requests';
import { Response } from 'request';
import { Config } from '../util';

const ci_admin_token = Config.secrets.ci_admin_token;

class ApiErrorResponse extends Error {
  public response: Response;
  constructor(message: string, response: Response) {
    super(message);
    this.response = response;
  }
}

export class FlowCryptApi {

  private static call = async (url: string, values: { [k: string]: any }) => {
    const r = await request.post({ url, json: values, headers: { 'api-version': 3 } });
    if (r.body.error) {
      throw new ApiErrorResponse(`FlowCryptApi ${url} returned an error: ${r.body.error.message}`, r);
    }
    return r;
  }

  public static hookCiAcctDelete = async (email: string) => {
    try {
      await FlowCryptApi.call('https://flowcrypt.com/api/hook/ci_account_delete', { ci_admin_token, email });
    } catch (e) {
      if (e.message instanceof ApiErrorResponse && e.response.body.error.message === 'Unknown account email') {
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
    await FlowCryptApi.call('https://flowcrypt.com/api/hook/ci_debug_email', { ci_admin_token, debug_title, debug_html_content });
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
