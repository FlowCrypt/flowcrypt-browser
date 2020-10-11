/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { Config } from './util';
import { FlowCryptApi } from './tests/tooling/api';

(async () => { // disabled in ci settings
  for (const { email, password } of Config.secrets.auth.google) {
    if (email && password) {
      const e = email.replace(/gmail|flowcrypt|test|com|@|\.|org/g, '');
      try {
        console.info(`[${e}] Initializing CI`);
        await FlowCryptApi.ciInitialize(email, password, 'none');
      } catch (e) { // do not fail whole process - the rest of tests may work without this
        console.error(`[${e}] ${String(e)}`);
      }
    }
  }
})().catch(console.error);
