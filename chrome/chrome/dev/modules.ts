
'use strict';
import {return_this_worked} from './test_module_for_import.js';
import * as DOMPurify from 'dompurify';

$('pre').text('hello from jquery');

try {
  $('pre').text(`
    OpenPGP hash: ${openpgp.crypto.hash.digest(openpgp.enums.hash.sha256, 'something to hash')}
    return_this_worked: ${return_this_worked()}
    Purify result: ${DOMPurify.sanitize('<div>something sanitized <script>inside script</script></div>')}
    anchorme: ${anchorme('hello text https://flowcrypt.com yay', {})}
  `);
} catch (e) {
  $('pre').text(e.stack);
}
