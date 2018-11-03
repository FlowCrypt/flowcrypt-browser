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

  private static call = async (path: string, values: {[k: string]: any}) => {
    let r = await request.post({url: `https://flowcrypt.com/api${path}`, json: values, headers: {'api-version': 3}});
    if(r.body.error) {
      throw new ApiErrorResponse(`FlowCryptApi ${path} returned an error: ${r.body.error.message}`, r);
    }
    return r;
  }

  public static hook_ci_account_delete = async (email: string) => {
    try {
      await FlowCryptApi.call('/hook/ci_account_delete', {email, ci_admin_token});
    } catch(e) {
      if(e.message instanceof ApiErrorResponse && e.response.body.error.message === 'Unknown account email') {
        throw e;
      }
    }
  }

  public static hook_ci_subscription_expire = async (email: string) => {
    await FlowCryptApi.call('/hook/ci_subscription_expire', {email, ci_admin_token});
  }

  public static hook_ci_subscription_reset = async (email: string) => {
    await FlowCryptApi.call('/hook/ci_subscription_reset', {email, ci_admin_token});
  }

}
