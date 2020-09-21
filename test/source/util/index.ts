/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import * as fs from 'fs';

import { KeyInfo } from '../core/crypto/key.js';

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
  proxy?: { enabled: boolean, server: string, auth: { username: string, password: string } };
  auth: { google: { email: string, password?: string, secret_2fa?: string }[], };
  keys: { title: string, passphrase: string, armored: string | null, longid: string | null }[];
  keyInfo: Array<{ email: string, key: KeyInfo[] }>;
}

export class Config {

  public static extensionId = '';

  public static secrets = JSON.parse(fs.readFileSync('test/test-secrets.json', 'utf8')) as TestSecretsInterface;

  public static key = (title: string) => {
    return Config.secrets.keys.filter(k => k.title === title)[0];
  }

}

Config.secrets.auth.google.push( // these don't contain any secrets, so not worth syncing through secrets file
  { "email": "flowcrypt.test.key.used.pgp@gmail.com" },
  { "email": "flowcrypt.test.key.imported@gmail.com" },
  { "email": "flowcrypt.test.key.import.naked@gmail.com" },
  { "email": "flowcrypt.test.key.recovered@gmail.com" },
  { "email": "flowcrypt.test.key.new.manual@gmail.com" },
  { "email": "flowcrypt.test.key.multibackup@gmail.com" },
  { "email": "has.pub@org-rules-test.flowcrypt.com" },
  { "email": "no.pub@org-rules-test.flowcrypt.com" },
  { "email": "user@no-submit-org-rule.flowcrypt.com" },
  { "email": "user@no-search-domains-org-rule.flowcrypt.com" },
  { "email": "get.key@key-manager-autogen.flowcrypt.com" },
  { "email": "put.key@key-manager-autogen.flowcrypt.com" },
  { "email": "get.error@key-manager-autogen.flowcrypt.com" },
  { "email": "put.error@key-manager-autogen.flowcrypt.com" },
  { "email": "reject.client.keypair@key-manager-autogen.flowcrypt.com" },
  { "email": "fail@key-manager-server-offline.flowcrypt.com" },
  { "email": "user@key-manager-no-pub-lookup.flowcrypt.com" },
  { "email": "expire@key-manager-keygen-expiration.flowcrypt.com" },
  { "email": "setup@prv-create-no-prv-backup.flowcrypt.com" },
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
    fs.unlinkSync(filename);
  }

}
