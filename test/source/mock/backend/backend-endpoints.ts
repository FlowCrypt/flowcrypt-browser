/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { expect } from 'chai';
import { HandlersDefinition } from '../all-apis-mock';
export interface ReportedError {
  name: string;
  message: string;
  url: string;
  line: number;
  col: number;
  trace: string;
  version: string;
  environmane: string;
}

export const reportedErrors: ReportedError[] = [];

export const mockBackendEndpoints: HandlersDefinition = {
  '/api/help/error': async ({ body }) => {
    reportedErrors.push(body as ReportedError);
    return { saved: true };
  },
  '/api/help/feedback': async ({ body }) => {
    expect((body as { email: string }).email).to.equal('flowcrypt.compatibility@gmail.com');
    return { sent: true, text: 'Feedback sent' };
  },
};
