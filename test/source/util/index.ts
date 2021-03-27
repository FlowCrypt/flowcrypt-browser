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
  auth: { google: { email: string, password?: string, secret_2fa?: string }[], };
  keys: { title: string, passphrase: string, armored: string | null, longid: string | null }[];
}

export class Config {

  public static extensionId = '';

  private static _secrets: TestSecretsInterface;

  public static secrets = (): TestSecretsInterface => {
    if (!Config._secrets) {
      try {
        Config._secrets = JSON.parse(fs.readFileSync('test/test-secrets.json', 'utf8'));
        const data = JSON.parse(fs.readFileSync('test/testdata.json', 'utf8'));
        Config._secrets.keys = data.keys;
      } catch (e) {
        console.error(`skipping loading test secrets because ${e}`);
        Config._secrets = { auth: { google: [] }, keys: [] } as any as TestSecretsInterface;
      }
    }
    return Config._secrets;
  }

  public static key = (title: string) => {
    return Config.secrets().keys.filter(k => k.title === title)[0];
  }

  public static getKeyInfo = async (titles: string[]): Promise<KeyInfoWithOptionalPp[]> => {
    return await Promise.all(Config._secrets.keys
      .filter(key => key.armored && titles.includes(key.title)).map(async key => {
        return { ...await KeyUtil.keyInfoObj(await KeyUtil.parse(key.armored!)), passphrase: key.passphrase };
      }));
  }

}

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
