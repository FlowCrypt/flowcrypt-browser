
import {Config} from '../util';

export let gmail_seq : string[] = [];

export class Url {

  public static extension = (path: string) => `chrome-extension://${Config.config.extension_id}/${path}`;

  public static extension_settings = (account_email?: string|undefined) => `chrome/settings/index.htm?account_email=${account_email || ''}`;

  public static gmail = (account_login_index=0, url_end='') => `https://mail.google.com/mail/u/${account_login_index}/#inbox${url_end}`;

}
