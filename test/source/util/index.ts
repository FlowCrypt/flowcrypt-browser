/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import * as fs from 'fs';
import { Keyboard, KeyInput } from 'puppeteer';
import { testKeyConstants } from '../tests/tooling/consts';
import { KeyInfoWithIdentityAndOptionalPp, KeyUtil } from '../core/crypto/key.js';

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
  signature?: string,
  encryption?: string,
  error?: string
};

export type TestKeyInfo = {
  title: string, passphrase: string, armored: string | null, longid: string | null
};

export type TestKeyInfoWithFilepath = TestKeyInfo & { filePath?: string, expired?: boolean };

interface TestSecretsInterface {
  ci_admin_token: string;
  auth: { google: { email: string, password?: string, secret_2fa?: string }[], };
}

export class Config {

  public static extensionId = '';

  private static _secrets: TestSecretsInterface;
  private static _keys: TestKeyInfo[];

  public static secrets = (): TestSecretsInterface => {
    if (!Config._secrets) {
      try {
        Config._secrets = JSON.parse(fs.readFileSync('test/test-secrets.json', 'utf8'));
      } catch (e) {
        console.error(`skipping loading test secrets because ${e}`);
        Config._secrets = { auth: { google: [] } } as any as TestSecretsInterface;
      }
    }
    return Config._secrets;
  };

  public static keys = (): TestKeyInfo[] => {
    if (!Config._keys) {
      try {
        Config._keys = JSON.parse(fs.readFileSync('test/test-keys.json', 'utf8'));
      } catch (e) {
        console.error(`skipping loading test keys because ${e}`);
        Config._keys = [];
      }
    }
    return Config._keys;
  };

  public static key = (title: string) => {
    return Config.keys().filter(k => k.title === title)[0];
  };

  public static getKeyInfo = async (titles: string[]): Promise<KeyInfoWithIdentityAndOptionalPp[]> => {
    return await Promise.all(Config._keys
      .filter(key => key.armored && titles.includes(key.title)).map(async key => {
        const parsed = await KeyUtil.parse(key.armored!);
        return { ...await KeyUtil.keyInfoObj(parsed), passphrase: key.passphrase };
      }));
  };

}

export class Util {

  public static sleep = async (seconds: number) => {
    return await new Promise(resolve => setTimeout(resolve, seconds * 1000));
  };

  public static shiftPress = async (keyboard: Keyboard, key: KeyInput) => {
    await keyboard.down('Shift');
    await keyboard.press(key);
    await keyboard.up('Shift');
  };

  public static lousyRandom = () => {
    return Math.random().toString(36).substring(2);
  };

  public static htmlEscape = (str: string) => {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\//g, '&#x2F;');
  };

  public static deleteFileIfExists = (filename: string) => {
    try {
      fs.unlinkSync(filename);
    } catch (e) {
      // file didn't exist
    }
  };

}
