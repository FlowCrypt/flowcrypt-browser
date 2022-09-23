/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import * as request from 'fc-node-requests';

export class FlowCryptApi {

  private static call = async (url: string, values: { [k: string]: unknown }) => {
    return await request.post({ url, json: values, headers: { 'api-version': 3 } });
  };

}
