/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Api } from './api';

export const startGoogleApiMock = async () => {
  const api = new Api<{}, {}>('google-mock', {
    'gmail/v1/users/me/messages/?': async (parsedReqBody, req) => {
      if ((req.method === 'GET' || req.method === 'HEAD') && req.url.match(/...$/)) {
        return {
          "snippet": "snippet",
          "threadId": "threadId",
          "labelIds": ["labelIds", "labelIds"],
          "payload": {
            "headers": [{
              "name": "name",
              "value": "value"
            }, {
              "name": "name",
              "value": "value"
            }],
            "filename": "filename",
            "partId": "partId",
            "parts": [],
            "mimeType": "mimeType",
            "body": {
              "data": "data",
              "size": 0,
              "attachmentId": "attachmentId"
            }
          },
          "historyId": "historyId",
          "raw": "raw",
          "id": "id",
          "sizeEstimate": 6,
          "internalDate": "internalDate"
        };
      }
    },
  });
  await api.listen(8001);
};
