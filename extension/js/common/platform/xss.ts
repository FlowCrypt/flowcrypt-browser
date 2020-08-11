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
  private static ADD_ATTR = ['email', 'page', 'addurltext', 'longid', 'index', 'target', 'fingerprint'];
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

  public static htmlEscape = (str: string) => {
    return str.replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\//g, '&#x2F;');
  }

  /**
   * Sanitize HTML to protect from nasty content from untrusted sources
   *
   * This is the most tolerant sanitisation method we use.
   * Typically we will only use this method for internally generated content,
   * content that we already believe is safe but want to have a second layer of defense.
   */
  public static htmlSanitize = (dirtyHtml: string): string => {
    Xss.throwIfNotSupported();
    return DOMPurify.sanitize(dirtyHtml, { // tslint:disable-line:oneliner-object-literal
      SAFE_FOR_JQUERY: true,
      ADD_ATTR: Xss.ADD_ATTR,
      FORBID_ATTR: Xss.FORBID_ATTR,
      ALLOWED_URI_REGEXP: Xss.sanitizeHrefRegexp(),
    });
  }

  /**
   * Sanitize HTML to protect from nasty user-generated external content, and make it "less rich"
   *
   * This method is less tolerant and sanitizes everything we don't belive should be sent as email content.
   * Used when rendering rich-text emails (from untrusted sources - that is, all sources).
   *
   * @property {string} dirtyHtml     - HTML to be sanitized
   * @property {string} imgHandling   - how should images be treated, with the following options:
   *   - IMG-DEL: remove images, only leaving text
   *   - IMG-KEEP: keep images as they are
   *   - IMG-TO-LINK: transform images to clickable links that display the images inline upon click, as follows:
   *          from: <img src="there" title="that">
   *          to:   <a href="data:image/..." title="that" class="image_src_link" target="_blank" style="...">show image</a>
   *          or:   <a href="https://..." title="that" class="image_src_link" target="_blank" style="...">show image (remote)</a>
   *          (when rendered, we add event handler to `.image_src_link` that responds to a click and render the image)
   */
  public static htmlSanitizeKeepBasicTags = (dirtyHtml: string, imgHandling: SanitizeImgHandling): string => {
    Xss.throwIfNotSupported();
    // used whenever untrusted remote content (eg html email) is rendered, but we still want to preserve html
    DOMPurify.removeAllHooks();
    DOMPurify.addHook('afterSanitizeAttributes', (node) => {
      if (!node) {
        return;
      }
      if ('style' in node) {
        // mitigation rather than a fix, which will involve updating CSP, see https://github.com/FlowCrypt/flowcrypt-browser/issues/2648
        const style = (node as Element).getAttribute('style')?.toLowerCase();
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
          Xss.replaceElementDANGEROUSLY(img, a.outerHTML); // xss-safe-value - "a" was build using dom node api
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

  /**
   * Convert untrusted rich html to plain text, preserving newlines caused by div/p/h1/pre/br and similar tags,
   * in a way that is consistent across browsers, unlike `element.textContent`. Maximum two consecutive newlines preserved.
   *
   * Will be used when generating a text/plain alternative to outgoing rich text email, or when quoting previous email in a reply.
   */
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

  public static htmlUnescape = (str: string) => {
    // the &nbsp; at the end is replaced with an actual NBSP character, not a space character. IDE won't show you the difference. Do not change.
    return str.replace(/&nbsp;/g, ' ').replace(/&#x2F;/g, '/').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  }

  public static replaceElementDANGEROUSLY = (el: Element, safeHtml: string) => { // xss-dangerous-function - must pass a sanitized value
    el.outerHTML = safeHtml; // xss-dangerous-function - must pass a sanitized value
  }

  public static setElementContentDANGEROUSLY = (el: Element, safeHtml: string) => { // xss-dangerous-function - must pass a sanitized value
    el.innerHTML = safeHtml; // xss-dangerous-function - must pass a sanitized value
  }

  private static throwIfNotSupported = () => {
    if (!DOMPurify.isSupported) {
      throw new Error('Your browser is not supported. Please use Firefox, Chrome or Edge.');
    }
  }

  /**
   * allow href links that have same origin as our extension + cid + inline image
   */
  private static sanitizeHrefRegexp = () => {
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
