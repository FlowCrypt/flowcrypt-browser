/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

import { Config } from './util';
import { FlowCryptApi } from './tests/api';

(async () => {

  for (const { email, password, backup } of Config.secrets.auth.google) {
    const e = email.replace(/gmail|flowcrypt|test|com|@|\./, '');
    try {
      console.info(`[${e}] Initializing CI`);
      await FlowCryptApi.ciInitialize(email, password, backup);
    } catch (e) { // do not fail whole process - the rest of tests may work without this
      console.error(`[${e}] ${String(e)}`);
    }
  }

})().catch(console.error);
