import * as request from 'fc-node-requests';

import { existsSync, writeFileSync } from 'fs';

import { Config } from './util';
import { openpgp } from './core/pgp';
import { startAllApisMock } from './mock/all-apis-mock';

export const mock = async (logger: (line: string) => void) => {
  const start = Date.now();
  await Promise.all(Config.secrets.auth.google.map(a => a.email).map(async email => { // load and decrypt mock data if missing
    if (['flowcrypt.test.key.multibackup@gmail.com', 'has.pub@org-rules-test.flowcrypt.com', 'no.pub@org-rules-test.flowcrypt.com'].includes(email)) {
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
      const message = await openpgp.message.read(body as Buffer);
      const msg = await openpgp.decrypt({ message, passwords: [Config.secrets.data_encryption_password], format: 'binary' });
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
