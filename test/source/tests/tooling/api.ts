/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import * as request from 'fc-node-requests';

import { Config } from '../../util';

const ci_admin_token = Config.secrets().ci_admin_token;

export class FlowCryptApi {

  public static hookCiDebugEmail = async (debug_title: string, debug_html_content: string) => { // tslint:disable-line:variable-name
    if (!ci_admin_token) {
      console.error('hookCiDebugEmail: nor reporting because missing ci_admin_token');
      return;
    }
    console.info(`hookCiDebugEmail - calling with length: ${debug_html_content.length}`);
    const r = await FlowCryptApi.call('https://flowcrypt.com/api/hook/ci_debug_email', { ci_admin_token, debug_title, debug_html_content });
    console.info('hookCiDebugEmail-response', r.body, r.statusCode);
  };

  private static call = async (url: string, values: { [k: string]: any }) => {
    return await request.post({ url, json: values, headers: { 'api-version': 3 } });
  };

}
