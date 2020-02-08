/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import * as DOMPurify from 'dompurify';

import { Str } from '../core/common.js';

export type SanitizeImgHandling = 'IMG-DEL' | 'IMG-KEEP' | 'IMG-TO-LINK';

/**
 * This class is in platform/ folder because most of it depends on platform specific code
 *  - in browser the implementation uses DOMPurify
 *  - in node it uses sanitize-html
 */
export class Xss {

  private static ALLOWED_HTML_TAGS = ['p', 'div', 'br', 'u', 'i', 'em', 'b', 'ol', 'ul', 'pre', 'li', 'table', 'tr', 'td', 'th', 'img', 'h1', 'h2', 'h3', 'h4', 'h5',
    'h6', 'hr', 'address', 'blockquote', 'dl', 'fieldset', 'a', 'font'];
  private static ADD_ATTR = ['email', 'page', 'addurltext', 'longid', 'index', 'target'];
  private static FORBID_ATTR = ['background'];
  private static HREF_REGEX_CACHE: RegExp | undefined;

  public static sanitizeRender = (selector: string | HTMLElement | JQuery<HTMLElement>, dirtyHtml: string) => { // browser-only (not on node)
    return $(selector as any).html(Xss.htmlSanitize(dirtyHtml)); // xss-sanitized
  }

  public static sanitizeAppend = (selector: string | HTMLElement | JQuery<HTMLElement>, dirtyHtml: string) => { // browser-only (not on node)
    return $(selector as any).append(Xss.htmlSanitize(dirtyHtml)); // xss-sanitized
  }

  public static sanitizePrepend = (selector: string | HTMLElement | JQuery<HTMLElement>, dirtyHtml: string) => { // browser-only (not on node)
    return $(selector as any).prepend(Xss.htmlSanitize(dirtyHtml)); // xss-sanitized
  }

  public static sanitizeReplace = (selector: string | HTMLElement | JQuery<HTMLElement>, dirtyHtml: string) => { // browser-only (not on node)
    return $(selector as any).replaceWith(Xss.htmlSanitize(dirtyHtml)); // xss-sanitized
  }

  public static htmlSanitize = (dirtyHtml: string): string => {
    Xss.throwIfNotSupported();
    return DOMPurify.sanitize(dirtyHtml, { // tslint:disable-line:oneliner-object-literal
      SAFE_FOR_JQUERY: true,
      ADD_ATTR: Xss.ADD_ATTR,
      FORBID_ATTR: Xss.FORBID_ATTR,
      ALLOWED_URI_REGEXP: Xss.sanitizeHrefRegexp(),
    });
  }

  public static htmlSanitizeKeepBasicTags = (dirtyHtml: string, imgHandling: SanitizeImgHandling): string => {
    Xss.throwIfNotSupported();
    // used whenever untrusted remote content (eg html email) is rendered, but we still want to preserve html
    DOMPurify.removeAllHooks();
    DOMPurify.addHook('afterSanitizeAttributes', (node) => {
      if (!node) {
        return;
      }
      if ('style' in node) {
        const style = (node as Element).getAttribute('style');
        if (style && (style.includes('url(') || style.includes('@import'))) {
          (node as Element).removeAttribute('style'); // don't want any leaks through css url()
        }
      }
      if ('src' in node) {
        const img: Element = node;
        const src = img.getAttribute('src');
        if (imgHandling === 'IMG-DEL') {
          img.remove(); // just skip images
        } else if (!src) {
          img.remove(); // src that exists but is null is suspicious
        } else if (imgHandling === 'IMG-TO-LINK') { // replace images with a link that points to that image
          const title = img.getAttribute('title');
          img.removeAttribute('src');
          const a = document.createElement('a');
          a.href = src;
          a.className = 'image_src_link';
          a.target = '_blank';
          a.innerText = (title || 'show image') + (src.startsWith('data:image/') ? '' : ' (remote)');
          const heightWidth = `height: ${img.clientHeight ? `${Number(img.clientHeight)}px` : 'auto'}; width: ${img.clientWidth ? `${Number(img.clientWidth)}px` : 'auto'};max-width:98%;`;
          a.setAttribute('style', `text-decoration: none; background: #FAFAFA; padding: 4px; border: 1px dotted #CACACA; display: inline-block; ${heightWidth}`);
          img.outerHTML = a.outerHTML; // xss-safe-value - "a" was build using dom node api
        }
      }
      if ('target' in node) { // open links in new window
        (node as Element).setAttribute('target', '_blank');
      }
    });
    const cleanHtml = DOMPurify.sanitize(dirtyHtml, {
      SAFE_FOR_JQUERY: true,
      ADD_ATTR: Xss.ADD_ATTR,
      FORBID_ATTR: Xss.FORBID_ATTR,
      ALLOWED_TAGS: Xss.ALLOWED_HTML_TAGS,
      ALLOWED_URI_REGEXP: Xss.sanitizeHrefRegexp(),
    });
    DOMPurify.removeAllHooks();
    return cleanHtml;
  }

  public static htmlSanitizeAndStripAllTags = (dirtyHtml: string, outputNl: string): string => {
    Xss.throwIfNotSupported();
    let html = Xss.htmlSanitizeKeepBasicTags(dirtyHtml, 'IMG-DEL');
    const random = Str.sloppyRandom(5);
    const br = `CU_BR_${random}`;
    const blockStart = `CU_BS_${random}`;
    const blockEnd = `CU_BE_${random}`;
    html = html.replace(/<br[^>]*>/gi, br);
    html = html.replace(/\n/g, '');
    html = html.replace(/<\/(p|h1|h2|h3|h4|h5|h6|ol|ul|pre|address|blockquote|dl|div|fieldset|form|hr|table)[^>]*>/gi, blockEnd);
    html = html.replace(/<(p|h1|h2|h3|h4|h5|h6|ol|ul|pre|address|blockquote|dl|div|fieldset|form|hr|table)[^>]*>/gi, blockStart);
    html = html.replace(RegExp(`(${blockStart})+`, 'g'), blockStart).replace(RegExp(`(${blockEnd})+`, 'g'), blockEnd);
    html = html.split(br + blockEnd + blockStart).join(br).split(blockEnd + blockStart).join(br).split(br + blockEnd).join(br);
    let text = html.split(br).join('\n').split(blockStart).filter(v => !!v).join('\n').split(blockEnd).filter(v => !!v).join('\n');
    text = text.replace(/\n{2,}/g, '\n\n');
    // not all tags were removed above. Remove all remaining tags
    text = DOMPurify.sanitize(text, { SAFE_FOR_JQUERY: true, ALLOWED_TAGS: [] });
    text = text.trim();
    if (outputNl !== '\n') {
      text = text.replace(/\n/g, outputNl);
    }
    return text;
  }

  public static escape = (str: string) => {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\//g, '&#x2F;');
  }

  public static escapeTextAsRenderableHtml = (text: string) => {
    return Xss.escape(text)
      .replace(/\n/g, '<br>\n') // leave newline so that following replaces work
      .replace(/^ +/gm, spaces => spaces.replace(/ /g, '&nbsp;'))
      .replace(/^\t+/gm, tabs => tabs.replace(/\t/g, '&#9;'))
      .replace(/\n/g, ''); // strip newlines, already have <br>
  }

  public static htmlUnescape = (str: string) => {
    // the &nbsp; at the end is replaced with an actual NBSP character, not a space character. IDE won't show you the difference. Do not change.
    return str.replace(/&nbsp;/g, ' ').replace(/&#x2F;/g, '/').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  }

  private static throwIfNotSupported = () => {
    if (!window.DOMPurify.isSupported) {
      throw new Error('Your browser is not supported. Please use Firefox, Chrome or Edge.');
    }
  }

  private static sanitizeHrefRegexp = () => { // allow href links that have same origin as our extension + cid + inline image
    if (typeof Xss.HREF_REGEX_CACHE === 'undefined') {
      if (window?.location?.origin && window.location.origin.match(/^(?:chrome-extension|moz-extension):\/\/[a-z0-9\-]+$/g)) {
        Xss.HREF_REGEX_CACHE = new RegExp(`^(?:(http|https|cid):|data:image/|${Str.regexEscape(window.location.origin)}|[^a-z]|[a-z+.\\-]+(?:[^a-z+.\\-:]|$))`, 'i');
      } else {
        Xss.HREF_REGEX_CACHE = /^(?:(http|https):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i;
      }
    }
    return Xss.HREF_REGEX_CACHE;
  }

}
