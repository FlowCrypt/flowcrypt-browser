/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

let url_params = tool.env.url_params(['reason']);

let title = $('.title');
let details = $('.details');

if(url_params.reason === 'db_corrupted') {
    title.text('FlowCrypt cannot function because your Browser Profile is corrupted.');
    details.html(`
    <p>To fix it:</p>
    <ol>
      <li>Close your browser completely (all tabs and all windows) and open it again. This often helps.</li>
      <li>If closing browser didn't help, restart your computer.</li>
      <li>If previous steps didn't work, go to <b>chrome://extensions</b> (on Chrome) or <b>about:addons</b> (on Firefox), and remove FlowCrypt from your browser. After that, go to <a href="https://flowcrypt.com">flowcrypt.com</a> to install it again.</li>
      <li>If this didn't help either, you may need to re-install your browser.</li>
    </ol>
    <p>Write me at human@flowcrypt.com if you need any help.</p>
    `);
} else if (url_params.reason === 'db_denied') {
    title.text('FlowCrypt cannot function because browser IndexedDB is disabled');
    details.html(`<p>If you are on Firefox, check that <b>indexedDB.enabled</b> is set to <b>true</b> in browser settings.`);
} else {
    details.html('Unknown reason. Write human@flowcrypt.com if you need help.')
}