
import { Config } from '../util';

export class TestUrls {

  public static extension = (path: string) => {
    return `chrome-extension://${Config.extensionId}/${path}`;
  }

  public static extensionSettings = (acctEmail?: string | undefined) => {
    return `chrome/settings/index.htm?account_email=${acctEmail || ''}`;
  }

  public static gmail = (acctLoginIndex = 0, urlEnd = '') => {
    return `https://mail.google.com/mail/u/${acctLoginIndex}/#inbox${urlEnd}`;
  }

}
