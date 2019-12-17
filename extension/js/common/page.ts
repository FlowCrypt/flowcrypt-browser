// import { View } from './view.js';
// import { ApiErr } from './api/error/api-error.js';
// import { Xss } from './platform/xss.js';
// import { Ui } from './browser/ui.js';

// export abstract class Page {

//   static run<PAGE extends Page>(pageClass: new () => PAGE) {
//     const page = new pageClass();
//     (async () => {
//       try {
//         if (page.initialize) {
//           await page.initialize();
//         }
//         const views = page.getViewsToRender();
//         await Promise.all(views.map(view => view.init()));
//         for (const view of views) {
//           View.runInstance(view);
//         }
//         if (page.viewViewsRendered) {
//           await page.viewViewsRendered();
//         }
//       } catch (e) {
//         Page.reportAndRenderErr(e);
//       }
//     })().catch(Page.reportAndRenderErr);
//   }
// }
