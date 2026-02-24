/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { expect } from 'chai';
import { HandlersDefinition } from '../all-apis-mock';

/**
 * In-memory storage for S3 uploaded content, keyed by storageFileName.
 */
const s3Storage = new Map<string, string>();

/**
 * Retrieves stored S3 content for a given storageFileName.
 */
export const getStoredS3Content = (storageFileName: string): string => {
  const content = s3Storage.get(storageFileName);
  if (!content) {
    throw new Error(`S3 content not found for storageFileName: ${storageFileName}`);
  }
  return content;
};

export const getMockS3Endpoints = (): HandlersDefinition => {
  return {
    '/mock-s3-upload/?': async ({ body }, req) => {
      if (req.method === 'PUT') {
        // Extract storage file name from URL path: /mock-s3-upload/<storageFileName>
        const storageFileName = req.url.split('/mock-s3-upload/')[1]?.split('?')[0];
        expect(storageFileName).to.be.a('string').and.not.be.empty;
        expect(body).to.exist;
        // Store the uploaded content (PGP encrypted message as string)
        s3Storage.set(storageFileName, body as string);
        return ''; // S3 returns empty body on successful PUT
      }
      throw new Error(`Unexpected method ${req.method} for /mock-s3-upload`);
    },
  };
};
