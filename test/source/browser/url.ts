
import { Config } from '../util';

export class Url {

  public static extension = (path: string) => `chrome-extension://${Config.extensionId}/${path}`;

  public static extensionSettings = (acctEmail?: string | undefined) => `chrome/settings/index.htm?account_email=${acctEmail || ''}`;

  public static gmail = (acctLoginIndex = 0, urlEnd = '') => `https://mail.google.com/mail/u/${acctLoginIndex}/#inbox${urlEnd}`;

}
