/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import * as fs from 'fs';
import { Keyboard, KeyInput } from 'puppeteer';
import { BrowserHandle } from '../browser/browser-handle.js';
import { KeyInfoWithIdentityAndOptionalPp, KeyUtil } from '../core/crypto/key.js';
import { SettingsPageRecipe } from '../tests/page-recipe/settings-page-recipe.js';
import { testKeyConstants } from '../tests/tooling/consts';
import { AvaContext } from '../tests/tooling/index.js';

export type TestVariant = 'CONSUMER-MOCK' | 'ENTERPRISE-MOCK' | 'CONSUMER-LIVE-GMAIL' | 'UNIT-TESTS' | 'CONSUMER-CONTENT-SCRIPT-TESTS-MOCK';

export const getParsedCliParams = () => {
  let testVariant: TestVariant;
  let testGroup: 'FLAKY-GROUP' | 'STANDARD-GROUP' | 'UNIT-TESTS' | 'CONTENT-SCRIPT-TESTS' | undefined;
  if (process.argv.includes('CONTENT-SCRIPT-TESTS')) {
    testVariant = 'CONSUMER-CONTENT-SCRIPT-TESTS-MOCK';
    testGroup = 'CONTENT-SCRIPT-TESTS';
  } else if (process.argv.includes('CONSUMER-MOCK')) {
    testVariant = 'CONSUMER-MOCK';
  } else if (process.argv.includes('ENTERPRISE-MOCK')) {
    testVariant = 'ENTERPRISE-MOCK';
  } else if (process.argv.includes('CONSUMER-LIVE-GMAIL')) {
    testVariant = 'CONSUMER-LIVE-GMAIL';
  } else {
    throw new Error('Unknown test type: specify CONSUMER-MOCK or ENTERPRISE-MOCK CONSUMER-LIVE-GMAIL');
  }
  if (!testGroup) {
    testGroup = process.argv.includes('UNIT-TESTS') ? 'UNIT-TESTS' : process.argv.includes('FLAKY-GROUP') ? 'FLAKY-GROUP' : 'STANDARD-GROUP';
  }
  const buildDir = `build/chrome-${(testVariant === 'CONSUMER-LIVE-GMAIL' ? 'CONSUMER' : testVariant).toLowerCase()}`;
  const poolSizeOne = process.argv.includes('--pool-size=1') || ['FLAKY-GROUP', 'CONTENT-SCRIPT-TESTS'].includes(testGroup);
  const oneIfNotPooled = (suggestedPoolSize: number) => (poolSizeOne ? Math.min(1, suggestedPoolSize) : suggestedPoolSize);
  console.info(`TEST_VARIANT: ${testVariant}:${testGroup}, (build dir: ${buildDir}, poolSizeOne: ${poolSizeOne})`);
  return { testVariant, testGroup, oneIfNotPooled, buildDir, isMock: testVariant.includes('-MOCK') };
};

export type TestMessage = {
  name?: string;
  content: string[];
  unexpectedContent?: string[];
  quoted?: boolean;
  expectPercentageProgress?: boolean;
  signature?: string;
  encryption?: string;
  error?: string;
};

export type TestKeyInfo = {
  title: string;
  passphrase: string;
  armored: string | null;
  longid: string | null;
};

export type TestKeyInfoWithFilepath = TestKeyInfo & { filePath?: string; expired?: boolean };

/* eslint-disable @typescript-eslint/naming-convention */
interface TestSecretsInterface {
  ci_admin_token: string;
  auth: { google: { email: string; password?: string; secret_2fa?: string }[] };
}
/* eslint-enable @typescript-eslint/naming-convention */

export class Config {
  private static _secrets: TestSecretsInterface;

  public static secrets = (): TestSecretsInterface => {
    /* eslint-disable no-underscore-dangle */
    if (!Config._secrets) {
      try {
        Config._secrets = JSON.parse(fs.readFileSync('test/test-secrets.json', 'utf8'));
      } catch (e) {
        console.error(`skipping loading test secrets because ${e}`);
        Config._secrets = { ci_admin_token: '', auth: { google: [] } }; // eslint-disable-line @typescript-eslint/naming-convention
      }
    }
    return Config._secrets;
    /* eslint-enable no-underscore-dangle */
  };

  public static key = (title: string) => {
    return testKeyConstants.keys.filter(k => k.title === title)[0];
  };

  public static getKeyInfo = async (titles: string[]): Promise<KeyInfoWithIdentityAndOptionalPp[]> => {
    return await Promise.all(
      testKeyConstants.keys
        .filter(key => key.armored && titles.includes(key.title))
        .map(async key => {
          const parsed = await KeyUtil.parse(key.armored!); // eslint-disable-line @typescript-eslint/no-non-null-assertion
          return { ...(await KeyUtil.keyInfoObj(parsed)), passphrase: key.passphrase };
        })
    );
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

  public static wipeGoogleTokensUsingExperimentalSettingsPage = async (t: AvaContext, browser: BrowserHandle, acct: string) => {
    for (const wipeTokenBtnSelector of ['@action-wipe-google-refresh-token', '@action-wipe-google-access-token']) {
      const settingsPage = await browser.newExtensionSettingsPage(t, acct);
      await SettingsPageRecipe.toggleScreen(settingsPage, 'additional');
      const experimentalFrame = await SettingsPageRecipe.awaitNewPageFrame(settingsPage, '@action-open-module-experimental', ['experimental.htm']);
      await experimentalFrame.waitAndClick(wipeTokenBtnSelector);
      await Util.sleep(2);
      await settingsPage.close();
    }
  };
}
