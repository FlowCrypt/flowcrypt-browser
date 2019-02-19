/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

import { Config } from './util';
import { FlowCryptApi } from './tests/api';

(async () => {

  for (const { email, password, backup } of Config.secrets.auth.google) {
    try {
      console.info(`[${email}] Initializing CI`);
      await FlowCryptApi.ciInitialize(email, password, backup);
      console.info(`[${email}] Successfully initialized CI`);
    } catch (e) { // do not fail whole process - the rest of tests may work without this
      console.error(`[${email}] Failed to initialize CI: ${String(e)}`);
    }
  }

})().catch(console.error);
