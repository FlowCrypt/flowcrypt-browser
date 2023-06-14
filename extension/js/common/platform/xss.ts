/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import * as DOMPurify from 'dompurify';

import { checkValidURL, CID_PATTERN, Str } from '../core/common.js';

export type SanitizeImgHandling = 'IMG-DEL' | 'IMG-KEEP' | 'IMG-TO-PLAIN-TEXT';

/**
 * This class is in platform/ folder because most of it depends on platform specific code
 *  - in browser the implementation uses DOMPurify
 *  - in node it uses sanitize-html
 */
export class Xss {
  private static ALLOWED_HTML_TAGS = [
    'p',
    'div',
    'br',
    'u',
    'i',
    'em',
    'b',
    'ol',
    'ul',
    'pre',
    'li',
    'table',
    'tr',
    'td',
    'th',
    'img',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'hr',
    'address',
    'blockquote',
    'dl',
    'fieldset',
    'a',
    'font',
    'colgroup',
    'col',
  ];
  private static ADD_ATTR = ['email', 'page', 'addurltext', 'longid', 'index', 'target', 'fingerprint', 'cryptup-data'];
  private static FORBID_ATTR = ['background'];
  private static HREF_REGEX_CACHE: RegExp | undefined;
  private static FORBID_CSS_STYLE = /z-index:[^;]+;|position:[^;]+;|background[^;]+;/g;

  public static sanitizeRender = (selector: string | HTMLElement | JQuery<HTMLElement>, dirtyHtml: string) => {
    // browser-only (not on node)
    return $(selector as HTMLElement).html(Xss.htmlSanitize(dirtyHtml)); // xss-sanitized
  };

  public static sanitizeAppend = (selector: string | HTMLElement | JQuery<HTMLElement>, dirtyHtml: string) => {
    // browser-only (not on node)
    return $(selector as HTMLElement).append(Xss.htmlSanitize(dirtyHtml)); // xss-sanitized
  };

  public static sanitizePrepend = (selector: string | HTMLElement | JQuery<HTMLElement>, dirtyHtml: string) => {
    // browser-only (not on node)
    return $(selector as HTMLElement).prepend(Xss.htmlSanitize(dirtyHtml)); // xss-sanitized
  };

  public static sanitizeReplace = (selector: string | HTMLElement | JQuery<HTMLElement>, dirtyHtml: string) => {
    // browser-only (not on node)
    return $(selector as HTMLElement).replaceWith(Xss.htmlSanitize(dirtyHtml)); // xss-sanitized
  };

  /**
   * Sanitize HTML to protect from nasty content from untrusted sources
   *
   * This is the most tolerant sanitisation method we use.
   * Typically we will only use this method for internally generated content,
   * content that we already believe is safe but want to have a second layer of defense.
   */
  public static htmlSanitize = (dirtyHtml: string, tagCheck = false): string => {
    Xss.throwIfNotSupported();
    /* eslint-disable @typescript-eslint/naming-convention */
    return DOMPurify.sanitize(dirtyHtml, {
      ADD_ATTR: Xss.ADD_ATTR,
      FORBID_ATTR: Xss.FORBID_ATTR,
      ...(tagCheck && { ALLOWED_TAGS: Xss.ALLOWED_HTML_TAGS }),
      ALLOWED_URI_REGEXP: Xss.sanitizeHrefRegexp(),
    });
    /* eslint-enable @typescript-eslint/naming-convention */
  };

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
   */
  public static htmlSanitizeKeepBasicTags = (dirtyHtml: string, imgHandling: SanitizeImgHandling = 'IMG-KEEP'): string => {
    Xss.throwIfNotSupported();
    // used whenever untrusted remote content (eg html email) is rendered, but we still want to preserve html
    DOMPurify.removeAllHooks();
    DOMPurify.addHook('afterSanitizeAttributes', node => {
      if (!node) {
        return;
      }
      if ('style' in node) {
        // mitigation rather than a fix, which will involve updating CSP, see https://github.com/FlowCrypt/flowcrypt-browser/issues/2648
        const style = (node as Element).getAttribute('style')?.toLowerCase();
        if (style && (style.includes('url(') || style.includes('@import'))) {
          (node as Element).removeAttribute('style'); // don't want any leaks through css url()
        }
        // strip css styles that could use to overlap with the extension UI
        if (style && Xss.FORBID_CSS_STYLE.test(style)) {
          const updatedStyle = style.replace(Xss.FORBID_CSS_STYLE, '');
          (node as HTMLElement).setAttribute('style', updatedStyle);
        }
      }
      if ('src' in node) {
        const img = node as HTMLImageElement;
        const src = img.getAttribute('src');
        if (imgHandling === 'IMG-DEL') {
          img.remove(); // just skip images
        } else if (!src) {
          img.remove(); // src that exists but is null is suspicious
        } else if (imgHandling === 'IMG-KEEP' && checkValidURL(src)) {
          // replace remote image with remote_image_container
          const remoteImgEl = `<div class="remote_image_container" data-src="${src}" data-test="remote-image-container"><span>Authenticity of this remote image cannot be verified.</span></div>`;
          Xss.replaceElementDANGEROUSLY(img, remoteImgEl); // xss-safe-value
        }
      }
      if ((node.classList.contains('remote_image_container') || CID_PATTERN.test(node.getAttribute('src') ?? '')) && imgHandling === 'IMG-TO-PLAIN-TEXT') {
        Xss.replaceElementDANGEROUSLY(node, node.getAttribute('data-src') ?? node.getAttribute('alt') ?? ''); // xss-safe-value
      }
      if ('target' in node) {
        // open links in new window
        (node as Element).setAttribute('target', '_blank');
        // prevents https://www.owasp.org/index.php/Reverse_Tabnabbing
        (node as Element).setAttribute('rel', 'noopener noreferrer');
      }
    });
    const cleanHtml = Xss.htmlSanitize(dirtyHtml, true);
    DOMPurify.removeAllHooks();
    return cleanHtml;
  };

  /**
   * Append the remote image `img` element to the remote_image_container.
   * We couldn't add it directly to htmlSanitizeKeepBasicTags because doing so would cause an infinite loop.
   */
  public static appendRemoteImagesToContainer = () => {
    const imageContainerList = $('#pgp_block .remote_image_container');
    for (const imageContainer of imageContainerList) {
      const imgUrl = imageContainer.dataset.src;
      if (imgUrl) {
        Xss.sanitizeAppend(imageContainer, `<img src="${imgUrl}"/>`);
      }
    }
  };

  /**
   * Convert untrusted rich html to plain text, preserving newlines caused by div/p/h1/pre/br and similar tags,
   * in a way that is consistent across browsers, unlike `element.textContent`. Maximum two consecutive newlines preserved.
   *
   * Will be used when generating a text/plain alternative to outgoing rich text email, or when quoting previous email in a reply.
   */
  public static htmlSanitizeAndStripAllTags = (dirtyHtml: string, outputNl: string, trim = true): string => {
    Xss.throwIfNotSupported();
    let html = Xss.htmlSanitizeKeepBasicTags(dirtyHtml, 'IMG-TO-PLAIN-TEXT');
    const random = Str.sloppyRandom(5);
    const br = `CU_BR_${random}`;
    const blockStart = `CU_BS_${random}`;
    const blockEnd = `CU_BE_${random}`;
    html = html.replace(/<br[^>]*>/gi, br);
    html = html.replace(/\n/g, '');
    html = html.replace(/<\/(p|h1|h2|h3|h4|h5|h6|ol|ul|pre|address|blockquote|dl|div|fieldset|form|hr|table)[^>]*>/gi, blockEnd);
    html = html.replace(/<(p|h1|h2|h3|h4|h5|h6|ol|ul|pre|address|blockquote|dl|div|fieldset|form|hr|table)[^>]*>/gi, blockStart);
    html = html.replace(RegExp(`(${blockStart})+`, 'g'), blockStart).replace(RegExp(`(${blockEnd})+`, 'g'), blockEnd);
    html = html
      .split(br + blockEnd + blockStart)
      .join(br)
      .split(blockEnd + blockStart)
      .join(br)
      .split(br + blockEnd)
      .join(br);
    let text = html
      .split(br)
      .join('\n')
      .split(blockStart)
      .filter(v => !!v)
      .join('\n')
      .split(blockEnd)
      .filter(v => !!v)
      .join('\n');
    text = text.replace(/\n{2,}/g, '\n\n');
    // not all tags were removed above. Remove all remaining tags
    // eslint-disable-next-line @typescript-eslint/naming-convention
    text = DOMPurify.sanitize(text, { ALLOWED_TAGS: [] });
    if (trim) {
      text = text.trim();
    }
    if (outputNl !== '\n') {
      text = text.replace(/\n/g, outputNl);
    }
    return text;
  };

  public static escape = (str: string) => {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\//g, '&#x2F;');
  };

  public static htmlUnescape = (str: string) => {
    // the &nbsp; at the end is replaced with an actual NBSP character, not a space character. IDE won't show you the difference. Do not change.
    return str
      .replace(/&nbsp;/g, ' ')
      .replace(/&#x2F;/g, '/')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
  };

  // prettier-ignore
  public static replaceElementDANGEROUSLY = (el: Element, safeHtml: string) => { // xss-dangerous-function - must pass a sanitized value
    el.outerHTML = safeHtml; // xss-dangerous-function - must pass a sanitized value
  };

  // prettier-ignore
  public static setElementContentDANGEROUSLY = (el: Element, safeHtml: string) => { // xss-dangerous-function - must pass a sanitized value
    el.innerHTML = safeHtml; // xss-dangerous-function - must pass a sanitized value
  };

  private static throwIfNotSupported = () => {
    if (!DOMPurify.isSupported) {
      throw new Error('Your browser is not supported. Please use Firefox, Chrome or Edge.');
    }
  };

  /**
   * allow href links that have same origin as our extension + cid + inline image
   */
  private static sanitizeHrefRegexp = () => {
    if (typeof Xss.HREF_REGEX_CACHE === 'undefined') {
      Xss.HREF_REGEX_CACHE = new RegExp(
        `^(?:(http|https|cid):|data:image/|${Str.regexEscape(chrome.runtime.getURL('/'))}|[^a-z]|[a-z+.\\-]+(?:[^a-z+.\\-:]|$))`,
        'i'
      );
    }
    return Xss.HREF_REGEX_CACHE;
  };
}
