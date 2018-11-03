
'use strict';
import { return_this_worked } from './test_module_for_import.js';
import * as t from '../../types/common';
import * as DOMPurify from 'dompurify';

declare const anchorme: (input: string, opts: {emails?: boolean, attributes?: {name: string, value: string}[]}) => string;
declare const openpgp: typeof OpenPGP;

// results:
//
// general code:    works
//
// background:      will work if defined as "page" instead of script, then use type=module in script tags (not tested)
//
// content scripts: will have to be compiled as a single content script file with --out=file and module:?? and target: es5 (should work)
//                  this means that there would be tsconfig.extension.json and tsconfig.content.json as per https://github.com/Microsoft/TypeScript/issues/3645

try {
  $('pre').text(`
OpenPGP hash:
${openpgp.crypto.hash.digest(openpgp.enums.hash.sha256, 'something to hash')}

return_this_worked:
${return_this_worked()}

Purify result:
${DOMPurify.sanitize('<div>something sanitized <script>inside script</script></div>')}

anchorme:
${anchorme('hello text https://flowcrypt.com yay', {})}

Mime encode:
${(() => {
  let MimeBuilder = (window as t.BrowserWidnow)['emailjs-mime-builder'];
  let root_node = new MimeBuilder();
  root_node.addHeader('random-header-1', 'RANDOM HEADER A');
  root_node.addHeader('random-header-2', 'RANDOM HEADER B');
  return root_node.build();
})()}
  `);
} catch (e) {
  $('pre').text(e.stack);
}
