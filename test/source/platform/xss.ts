/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

export type SanitizeImgHandling = 'IMG-DEL' | 'IMG-KEEP';

/**
 * Look at https://github.com/FlowCrypt/flowcrypt-mobile-core/blob/master/TypeScript/source/platform/xss.ts if node implementation is ever needed for tests.
 */
export class Xss {
  /* eslint-disable @typescript-eslint/no-unused-vars */
  /**
   * used whenever untrusted remote content (eg html email) is rendered, but we still want to preserve html
   */
  public static htmlSanitizeKeepBasicTags = (dirtyHtml: string, imgHandling: SanitizeImgHandling): string => {
    throw new Error('not implemented / not needed by tests yet');
  };

  public static htmlSanitizeAndStripAllTags = (dirtyHtml: string, outputNl: string): string => {
    throw new Error('not implemented / not needed by tests yet');
  };

  public static escape = (str: string) => {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\//g, '&#x2F;');
  };

  public static htmlUnescape = (str: string) => {
    throw new Error('not implemented / not needed by tests yet');
  };
  /* eslint-enable @typescript-eslint/no-unused-vars */
}
