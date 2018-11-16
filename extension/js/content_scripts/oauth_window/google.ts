/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

// import { Value } from '../../common/common.js';
// import { BrowserMsg, GoogleAuthWindowResult$result } from '../../common/extension.js';
// import { Ui, Env } from '../../common/browser.js';
// import { GoogleAuth, AuthReq } from '../../common/api/google.js';
// import { Catch } from '../../common/catch.js';

// (async () => {

//   const apiGoogleAuthStateUnpack = (statusString: string): AuthReq => {
//     return JSON.parse(statusString.replace(GoogleAuth.OAUTH.state_header, '')) as AuthReq; // todo - maybe can check with a type guard and throw if not
//   };

//   while (true) {
//     if (document.title && Value.is(GoogleAuth.OAUTH.state_header).in(document.title)) {
//       // this is FlowCrypt's google oauth - based on a &state= passed on in auth request
//       const parts = document.title.split(' ', 2);
//       const result = parts[0];
//       const params = Env.urlParams(['code', 'state', 'error'], parts[1]);
//       const state = apiGoogleAuthStateUnpack(params.state as string);
//       BrowserMsg.send.bg.googleAuthWindowResult({
//         result: result as GoogleAuthWindowResult$result,
//         params: {
//           code: String(params.code),
//           error: String(params.error),
//         },
//         state,
//       });
//       break;
//     }
//     await Ui.time.sleep(100);
//   }

// })().catch(Catch.handleErr);
