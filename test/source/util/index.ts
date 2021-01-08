/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import * as fs from 'fs';

import { KeyInfoWithOptionalPp, KeyUtil } from '../core/crypto/key.js';

export type TestVariant = 'CONSUMER-MOCK' | 'ENTERPRISE-MOCK' | 'CONSUMER-LIVE-GMAIL' | 'UNIT-TESTS';

export const getParsedCliParams = () => {
  let testVariant: TestVariant;
  if (process.argv.includes('CONSUMER-MOCK')) {
    testVariant = 'CONSUMER-MOCK';
  } else if (process.argv.includes('ENTERPRISE-MOCK')) {
    testVariant = 'ENTERPRISE-MOCK';
  } else if (process.argv.includes('CONSUMER-LIVE-GMAIL')) {
    testVariant = 'CONSUMER-LIVE-GMAIL';
  } else if (process.argv.includes('UNIT-TESTS')) {
    testVariant = 'UNIT-TESTS';
  } else {
    throw new Error('Unknown test type: specify CONSUMER-MOCK or ENTERPRISE-MOCK CONSUMER-LIVE-GMAIL');
  }
  const testGroup = (process.argv.includes('UNIT-TESTS') ? 'UNIT-TESTS'
    : process.argv.includes('FLAKY-GROUP') ? 'FLAKY-GROUP' : 'STANDARD-GROUP') as
    'FLAKY-GROUP' | 'STANDARD-GROUP' | 'UNIT-TESTS';
  const buildDir = `build/chrome-${(testVariant === 'CONSUMER-LIVE-GMAIL' ? 'CONSUMER' : testVariant).toLowerCase()}`;
  const poolSizeOne = process.argv.includes('--pool-size=1') || testGroup === 'FLAKY-GROUP';
  const oneIfNotPooled = (suggestedPoolSize: number) => poolSizeOne ? Math.min(1, suggestedPoolSize) : suggestedPoolSize;
  console.info(`TEST_VARIANT: ${testVariant}:${testGroup}, (build dir: ${buildDir}, poolSizeOne: ${poolSizeOne})`);
  return { testVariant, testGroup, oneIfNotPooled, buildDir, isMock: testVariant.includes('-MOCK') };
};

export type TestMessage = {
  name?: string,
  content: string[],
  unexpectedContent?: string[],
  password?: string,
  params: string,
  quoted?: boolean,
  expectPercentageProgress?: boolean,
  signature?: string[],
};

interface TestSecretsInterface {
  ci_admin_token: string;
  ci_dev_account: string;
  data_encryption_password: string;
  auth: { google: { email: string, password?: string, secret_2fa?: string }[], };
  keys: { title: string, passphrase: string, armored: string | null, longid: string | null }[];
  keyInfo: Array<{ email: string, key: KeyInfoWithOptionalPp[] }>;
}

export class Config {

  public static extensionId = '';

  private static _secrets: TestSecretsInterface;

  public static secrets = (): TestSecretsInterface => {
    if (!Config._secrets) {
      try {
        Config._secrets = JSON.parse(fs.readFileSync('test/test-secrets.json', 'utf8'));
      } catch (e) {
        console.error(`skipping loading test secrets because ${e}`);
        Config._secrets = { auth: { google: [] }, keys: [], keyInfo: [] } as any as TestSecretsInterface;
      }
    }
    return Config._secrets;
  }

  public static key = (title: string) => {
    return Config.secrets().keys.filter(k => k.title === title)[0];
  }

  public static setupSecrets = async (): Promise<void> => {
    await Config.fixKeyInfo(Config._secrets);
  }

  public static fixKeyInfo = async (secrets: TestSecretsInterface): Promise<void> => {
    // The keys in test secrets file used to have different structure,
    // this does a migration so that we can continue using the file as is
    // without distributing an updated secrets file to everyone
    secrets.keyInfo = await Promise.all(secrets.keyInfo.map(async original => {
      const kisWithPp: KeyInfoWithOptionalPp[] = [];
      for (const ki of original.key) {
        const reParsed = await KeyUtil.keyInfoObj(await KeyUtil.parse(ki.private));
        kisWithPp.push({ ...reParsed, passphrase: ki.passphrase });
      }
      return { email: original.email, key: kisWithPp };
    }));
  }

}

Config.secrets().auth.google.push( // these don't contain any secrets, so not worth syncing through secrets file
  { "email": "flowcrypt.test.key.used.pgp@gmail.com" },
  { "email": "flowcrypt.test.key.imported@gmail.com" },
  { "email": "flowcrypt.test.key.import.naked@gmail.com" },
  { "email": "flowcrypt.test.key.recovered@gmail.com" },
  { "email": "flowcrypt.test.key.new.manual@gmail.com" },
  { "email": "flowcrypt.test.key.multiple@gmail.com" },
  { "email": "has.pub@org-rules-test.flowcrypt.com" },
  { "email": "no.pub@org-rules-test.flowcrypt.com" },
  { "email": "user@no-submit-org-rule.flowcrypt.com" },
  { "email": "user@no-search-domains-org-rule.flowcrypt.com" },
  { "email": "get.key@key-manager-autogen.flowcrypt.com" },
  { "email": "put.key@key-manager-autogen.flowcrypt.com" },
  { "email": "get.error@key-manager-autogen.flowcrypt.com" },
  { "email": "put.error@key-manager-autogen.flowcrypt.com" },
  { "email": "two.keys@key-manager-autogen.flowcrypt.com" },
  { "email": "reject.client.keypair@key-manager-autogen.flowcrypt.com" },
  { "email": "fail@key-manager-server-offline.flowcrypt.com" },
  { "email": "user@key-manager-no-pub-lookup.flowcrypt.com" },
  { "email": "expire@key-manager-keygen-expiration.flowcrypt.com" },
  { "email": "setup@prv-create-no-prv-backup.flowcrypt.com" },
  { "email": "user@standardsubdomainfes.com:8001" },
  { "email": 'user@wellknownfes.com:8001' },
  { 'email': 'no.fes@example.com' }
);

export class Util {

  public static sleep = async (seconds: number) => {
    return await new Promise(resolve => setTimeout(resolve, seconds * 1000));
  }

  public static lousyRandom = () => {
    return Math.random().toString(36).substring(2);
  }

  public static htmlEscape = (str: string) => {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\//g, '&#x2F;');
  }

  public static deleteFileIfExists = (filename: string) => {
    try {
      fs.unlinkSync(filename);
    } catch (e) {
      // file didn't exist
    }
  }

}
