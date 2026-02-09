/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { expect } from 'chai';
import { HandlersDefinition } from '../all-apis-mock';

export const getMockS3Endpoints = (): HandlersDefinition => {
  return {
    '/mock-s3-upload': async ({ body }, req) => {
      // S3 PUT requests are simple binary uploads
      if (req.method === 'PUT') {
        // In a real S3 upload, the body is the file content.
        // We can assert on the content if needed, but for now just acknowledging receipt is enough.
        // The fact that we received the request means the URL handling logic works.
        // Since we configured parseReqBody to return string for this endpoint, body should be string/buffer.
        expect(body).to.exist;
        return {}; // S3 returns 200 OK with empty body on successful PUT
      }
      throw new Error(`Unexpected method ${req.method} for /mock-s3-upload`);
    },
  };
};
