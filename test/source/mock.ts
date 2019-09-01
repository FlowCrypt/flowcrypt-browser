
import { startGoogleApiMock } from './mock/google-api-mock';
import { Config } from './util';
import * as request from 'fc-node-requests';
import { writeFileSync, existsSync } from 'fs';
import { requireOpenpgp } from './platform/require';

const openpgp = requireOpenpgp();

export const mock = async (logger: (line: string) => void) => {
  const start = Date.now();
  await Promise.all(Config.secrets.auth.google.map(a => a.email).map(async email => { // load and decrypt mock data if missing
    if (email === 'flowcrypt.test.key.multibackup@gmail.com') {
      return; // missing mock data, not yet used
    }
    const filename = `${email.replace(/[^a-z0-9]+/g, '')}.json`;
    const url = `https://github.com/michael-volynets/flowcrypt-bin/blob/update-mock-data/gmail-mock-data/${filename}?raw=true`; // UNDO: before commit
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
  return await startGoogleApiMock(logger);
};

if (require.main === module) {
  mock(console.log).catch(e => {
    console.error(e);
    process.exit(1);
  });
}
