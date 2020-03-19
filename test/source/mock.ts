/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import * as request from 'fc-node-requests';

import { existsSync, writeFileSync } from 'fs';
import { Config } from './util';
import { opgp } from './core/pgp';
import { startAllApisMock } from './mock/all-apis-mock';

export const acctsWithoutMockData = [
  'flowcrypt.test.key.multibackup@gmail.com',
  'has.pub@org-rules-test.flowcrypt.com',
  'no.pub@org-rules-test.flowcrypt.com',
  'user@no-submit-org-rule.flowcrypt.com',
  'user@no-search-domains-org-rule.flowcrypt.com',
  'get.key@key-manager-autogen.flowcrypt.com',
  'put.key@key-manager-autogen.flowcrypt.com',
  'get.error@key-manager-autogen.flowcrypt.com',
  'put.error@key-manager-autogen.flowcrypt.com',
  'fail@key-manager-server-offline.flowcrypt.com',
  'user@key-manager-no-pub-lookup.flowcrypt.com',
  'expire@key-manager-keygen-expiration.flowcrypt.com',
  'setup@prv-create-no-prv-backup.flowcrypt.com',
];

export const mock = async (logger: (line: string) => void) => {
  const start = Date.now();
  await Promise.all(Config.secrets.auth.google.map(a => a.email).map(async email => { // load and decrypt mock data if missing
    if (acctsWithoutMockData.includes(email)) {
      return; // missing mock data, not yet used
    }
    const filename = `${email.replace(/[^a-z0-9]+/g, '')}.json`;
    const url = `https://github.com/FlowCrypt/flowcrypt-bin/raw/master/gmail-mock-data/${filename}`;
    const filepath = `./test/samples/${filename}`;
    if (!existsSync(filepath)) {
      const { body, statusCode } = await request.get({ url, encoding: null }); // tslint:disable-line:no-null-keyword
      if (statusCode !== 200) {
        throw new Error(`Missing gmail mock data at ${url}`);
      }
      const message = await opgp.message.read(body as Buffer);
      const msg = await opgp.decrypt({ message, passwords: [Config.secrets.data_encryption_password], format: 'binary' });
      writeFileSync(filepath, msg.data);
      console.info(`downloaded mock data to ${filepath}`);
    }
  }));
  console.info(`checking mock data took ${(Date.now() - start) / 1000} seconds`);
  return await startAllApisMock(logger);
};

if (require.main === module) {
  mock(msgLog => console.log(msgLog)).catch(e => {
    console.error(e);
    process.exit(1);
  });
}
