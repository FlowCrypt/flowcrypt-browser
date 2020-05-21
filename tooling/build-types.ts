import { readFileSync, writeFileSync } from 'fs';

import { execSync as exec } from 'child_process';

const CHROME_CONSUMER = 'chrome-consumer';
const CHROME_ENTERPRISE = 'chrome-enterprise';
const MOCK_HOST: { [buildType: string]: string } = { 'chrome-consumer': 'http://localhost:8001', 'chrome-enterprise': 'http://google.mock.flowcrypt.com:8001' };

const buildDir = (buildType: string) => `./build/${buildType}`;

const edit = (filepath: string, editor: (content: string) => string) => {
  writeFileSync(filepath, editor(readFileSync(filepath, { encoding: 'utf-8' })));
};

const makeMockBuild = (buildType: string) => {
  const mockBuildType = `${buildType}-mock`;
  exec(`cp -r ${buildDir(buildType)} ${buildDir(mockBuildType)}`);
  const editor = (code: string) => {
    return code
      .replace(/const (GOOGLE_API_HOST|GOOGLE_OAUTH_SCREEN_HOST) = [^;]+;/g, `const $1 = '${MOCK_HOST[buildType]}';`)
      .replace(/const (BACKEND_API_HOST) = [^;]+;/g, `const $1 = 'http://localhost:8001/api/';`)
      .replace(/const (ATTESTER_API_HOST) = [^;]+;/g, `const $1 = 'http://localhost:8001/attester/';`)
      .replace(/https:\/\/flowcrypt.com\/api\/help\/error/g, 'http://localhost:8001/api/help/error');
  };
  edit(`${buildDir(mockBuildType)}/js/common/core/const.js`, editor);
  edit(`${buildDir(mockBuildType)}/js/common/platform/catch.js`, editor);
  edit(`${buildDir(mockBuildType)}/js/content_scripts/webmail_bundle.js`, editor);
};

const updateEnterpriseBuild = () => {
  const constFilepath = `${buildDir(CHROME_ENTERPRISE)}/js/common/core/const.js`;
  edit(constFilepath, (code: string) => {
    const flavorPattern = /export const FLAVOR = 'consumer';/g;
    if (!flavorPattern.test(code)) {
      throw new Error(`Expecting to find FLAVOR in ${constFilepath}`);
    }
    return code.replace(flavorPattern, `export const FLAVOR = 'enterprise';`);
  });
};

updateEnterpriseBuild();
makeMockBuild(CHROME_CONSUMER);
makeMockBuild(CHROME_ENTERPRISE);
