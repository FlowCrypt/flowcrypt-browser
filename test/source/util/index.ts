
import * as fs from 'fs';
import { KeyInfo } from '../core/pgp.js';

export type TestVariant = 'CONSUMER-MOCK' | 'ENTERPRISE-MOCK' | 'CONSUMER-LIVE-GMAIL';

export const getParsedCliParams = () => {
  let testVariant: TestVariant;
  if (process.argv.indexOf('CONSUMER-MOCK') !== -1) {
    testVariant = 'CONSUMER-MOCK';
  } else if (process.argv.indexOf('ENTERPRISE-MOCK') !== -1) {
    testVariant = 'ENTERPRISE-MOCK';
  } else if (process.argv.indexOf('CONSUMER-LIVE-GMAIL') !== -1) {
    testVariant = 'CONSUMER-LIVE-GMAIL';
  } else {
    throw new Error('Unknown test type: specify CONSUMER-MOCK or ENTERPRISE-MOCK CONSUMER-LIVE-GMAIL');
  }
  const buildDir = `build/chrome-${('CONSUMER').toLowerCase()}`;
  const poolSizeOne = process.argv.indexOf('--pool-size=1') !== -1;
  const oneIfNotPooled = (suggestedPoolSize: number) => poolSizeOne ? Math.min(1, suggestedPoolSize) : suggestedPoolSize;
  console.info(`TEST_VARIANT: ${testVariant} (build dir: ${buildDir}, poolSizeOne: ${poolSizeOne})`);
  return { testVariant, oneIfNotPooled, buildDir, isMock: testVariant.includes('-MOCK') };
};

interface TestConfigInterface {
  messages: { name: string, content: string[], password?: string, params: string, quoted?: boolean }[];
  unit_tests: { name: string, f: string, args: any[], result: any }[];
}

interface TestSecretsInterface {
  ci_admin_token: string;
  ci_dev_account: string;
  data_encryption_password: string;
  proxy?: { enabled: boolean, server: string, auth: { username: string, password: string } };
  auth: { google: { email: string, password: string, backup: string }[], };
  keys: { title: string, passphrase: string, armored: string | null, keywords: string | null }[];
  keyInfo: Array<{ email: string, key: KeyInfo[] }>;
}

export class Config {

  public static extensionId = '';

  public static secrets = JSON.parse(fs.readFileSync('test/test-secrets.json', 'utf8')) as TestSecretsInterface;

  public static tests = JSON.parse(fs.readFileSync('test/tests.json', 'utf8')) as TestConfigInterface;

  public static key = (title: string) => Config.secrets.keys.filter(k => k.title === title)[0];

}

export class Util {

  public static sleep = (seconds: number) => new Promise(resolve => setTimeout(resolve, seconds * 1000));

  public static lousyRandom = () => Math.random().toString(36).substring(2);

  public static htmlEscape = (str: string) => str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\//g, '&#x2F;');

}
