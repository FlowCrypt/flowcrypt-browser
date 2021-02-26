/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Lang } from '../../js/common/lang.js';
import { Url } from '../../js/common/core/common.js';
import { Xss } from '../../js/common/platform/xss.js';

const uncheckedUrlParams = Url.parse(['reason', 'stack']);
const reason = String(uncheckedUrlParams.reason);
const stack = uncheckedUrlParams.stack ? String(uncheckedUrlParams.stack) : '';

const title = $('.title');
const details = $('.details');
const dbCorruptedHtml = `
  <p>To fix it:</p>
  <ol>
    <li>Close your browser completely (all tabs and all windows) and open it again. This often helps.</li>
    <li>If closing browser didn't help, restart your computer.</li>
    <li>If previous steps didn't work, go to <b>chrome://extensions</b> (on Chrome) or <b>about:addons</b> (on Firefox),
      and remove FlowCrypt from your browser. After that, go to <a href="https://flowcrypt.com">flowcrypt.com</a> to install it again.</li>
    <li>If this didn't help either, you may need to re-install your browser.</li>
  </ol>
  <p>Email human@flowcrypt.com if you need any help.</p>
`;

const checkFfSettings = `If you are on Firefox, check that <b>indexedDB.enabled</b> is set to <b>true</b> in browser about:config
                        or check if Firefox remembers history in <b>Options/Preferences</b> -> <b>Privacy & Security</b> -> <b>History</b>.`;

if (reason === 'db_corrupted') {
  title.text('FlowCrypt cannot function because your Browser Profile is corrupted.');
  Xss.sanitizeRender(details, dbCorruptedHtml);
} else if (reason === 'db_denied') {
  title.text('FlowCrypt cannot function because browser IndexedDB or local.storage is disabled');
  Xss.sanitizeRender(details, `<p>${checkFfSettings}</p>`);
} else if (reason === 'db_failed') {
  title.text('FlowCrypt cannot function because browser IndexedDB or local.storage is not working properly');
  Xss.sanitizeRender(details, `<p>${Lang.error.dbFailed}</p><p>${checkFfSettings}</p>`);
} else if (reason === 'storage_undefined') {
  title.text('FlowCrypt cannot function because browser storage is disabled or missing');
  Xss.sanitizeRender(details, `<p>browser.storage is undefined</p><p>If you are on Firefox, check for any special browser settings, or use a clean Firefox Profile.</p>`);
} else {
  details.text('Unknown reason. Write human@flowcrypt.com if you need help.');
}

if (stack) {
  Xss.sanitizeAppend(details, `<br><pre>${Xss.escape(stack)}</pre>`);
}
