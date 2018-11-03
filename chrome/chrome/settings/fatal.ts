/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Env } from '../../js/common/common.js';
import { Xss } from '../../js/common/browser.js';

(() => {

    let url_params = Env.url_params(['reason']);

    let title = $('.title');
    let details = $('.details');

    if (url_params.reason === 'db_corrupted') {
        title.text('FlowCrypt cannot function because your Browser Profile is corrupted.');
        Xss.sanitize_render(details, `
        <p>To fix it:</p>
          <ol>
            <li>Close your browser completely (all tabs and all windows) and open it again. This often helps.</li>
            <li>If closing browser didn't help, restart your computer.</li>
            <li>If previous steps didn't work, go to <b>chrome://extensions</b> (on Chrome) or <b>about:addons</b> (on Firefox), and remove FlowCrypt from your browser. After that, go to <a href="https://flowcrypt.com">flowcrypt.com</a> to install it again.</li>
            <li>If this didn't help either, you may need to re-install your browser.</li>
          </ol>
          <p>Email human@flowcrypt.com if you need any help.</p>
        `);
    } else if (url_params.reason === 'db_denied') {
        title.text('FlowCrypt cannot function because browser IndexedDB is disabled');
        Xss.sanitize_render(details, `<p>If you are on Firefox, check that <b>indexedDB.enabled</b> is set to <b>true</b> in browser settings.</p>`);
    } else if (url_params.reason === 'db_failed') {
        title.text('FlowCrypt cannot function because browser IndexedDB is not working properly');
        Xss.sanitize_render(details, `<p>If you are on Firefox, this will have something to do with your browser settings. Try to install FlowCrypt on a brand new Firefox profile (Firefox allows you to have several different user profiles). If you leave the new profile on default settings, FlowCrypt should work without issues. Then you can compare your old profile settings to the new one to find out which settings are giving FlowCrypt trouble. Once you find out, please let us know at human@flowcrypt.com and we will include it below to help other users.</p>.`);
    } else {
        details.text('Unknown reason. Write human@flowcrypt.com if you need help.');
    }

})();
