/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

import { Config } from './util';
import { FlowCryptApi } from './tests/api';

const { email, password, backup } = Config.secrets.auth.google.filter(a => a.email === 'flowcrypt.compatibility@gmail.com')[0];
FlowCryptApi.ciInitialize(email, password, backup).then(() => {
  console.log('Successfully initialized CI');
}).catch(e => {
  console.error(`Failed to initialize CI: ${String(e)}`);
  // do not fail whole process - the rest of tests may work without this
});
