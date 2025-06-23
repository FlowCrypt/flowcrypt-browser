/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */
import { Url } from '../core/common.js';

export class CatchHelper {
  public static test(type: 'error' | 'object' = 'error') {
    if (type === 'error') {
      throw new Error('intentional error for debugging');
    } else {
      // eslint-disable-next-line no-throw-literal, @typescript-eslint/only-throw-error
      throw { what: 'intentional thrown object for debugging' };
    }
  }

  public static stackTrace(): string {
    try {
      CatchHelper.test();
    } catch (e) {
      // return stack after removing first 3 lines plus url
      return `${((e as Error).stack || '').split('\n').splice(3).join('\n')}\n\nurl: ${CatchHelper.censoredUrl(location.href)}\n`;
    }
    return ''; // make ts happy - this will never happen
  }

  public static censoredUrl(url: string | undefined): string {
    if (!url) {
      return '(unknown url)';
    }
    const sensitiveFields = ['message', 'senderEmail', 'acctEmail'];
    for (const field of sensitiveFields) {
      url = Url.replaceUrlParam(url, field, '[SCRUBBED]');
    }
    if (url.includes('refreshToken=')) {
      return `${url.split('?')[0]}~censored:refreshToken`;
    }
    if (url.includes('token=')) {
      return `${url.split('?')[0]}~censored:token`;
    }
    if (url.includes('code=')) {
      return `${url.split('?')[0]}~censored:code`;
    }
    if (url.includes('idToken=')) {
      return `${url.split('?')[0]}~censored:idToken`;
    }
    return url;
  }
}
