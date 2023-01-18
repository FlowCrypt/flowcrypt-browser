/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { startAllApisMock } from './mock/all-apis-mock';
import { exec } from 'child_process';

export const mock = async (port: number, logger: (line: string) => void) => {
  const mockApi = await startAllApisMock(port, logger);
  const address = mockApi.server.address();
  if (typeof address === 'object' && address) {
    exec(`sh ./scripts/set-test-port.sh ${address.port}`);
  }
  return mockApi;
};

// if (require.main === module) {
//   mock(8002, msgLog => console.log(msgLog)).catch(e => {
//     console.error(e);
//     process.exit(1);
//   });
// }
