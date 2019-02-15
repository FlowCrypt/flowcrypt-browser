/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

import { Config } from './util';
import { FlowCryptApi } from './tests/api';

(async () => {

  for (const acct of ['flowcrypt.compatibility@gmail.com', 'test.ci.compose@org.flowcrypt.com']) {
    const { email, password, backup } = Config.secrets.auth.google.filter(a => a.email === acct)[0];
    try {
      console.info(`Initializing CI for ${acct}`);
      await FlowCryptApi.ciInitialize(email, password, backup);
      console.info(`Successfully initialized CI for ${acct}`);
    } catch (e) { // do not fail whole process - the rest of tests may work without this
      console.error(`Failed to initialize CI for ${acct}: ${String(e)}`);
    }
  }

})().catch(console.error);
