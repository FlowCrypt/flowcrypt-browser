/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { expect } from 'chai';
import { HandlersDefinition } from '../all-apis-mock';
import { BackendData, ReportedError } from './backend-data';

export const mockBackendData = new BackendData();

export const mockBackendEndpoints: HandlersDefinition = {
  '/api/help/error': async ({ body }) => {
    mockBackendData.reportedErrors.push(body as ReportedError);
    return { saved: true };
  },
  '/api/help/feedback': async ({ body }) => {
    expect((body as { email: string }).email).to.equal('flowcrypt.compatibility@gmail.com');
    return { sent: true, text: 'Feedback sent' };
  },
};
