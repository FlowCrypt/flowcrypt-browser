/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { startAllApisMock } from './mock/all-apis-mock';

export const mock = async (isMock: boolean, logger: (line: string) => void) => {
  return await startAllApisMock(isMock, logger);
};

if (require.main === module) {
  mock(true, msgLog => console.log(msgLog)).catch(e => {
    console.error(e);
    process.exit(1);
  });
}
