
import {config} from '../config';

export let gmail_seq : string[] = [];

export class Url {

  public static extension = (path: string) => `chrome-extension://${config.extension_id}/${path}`;

  public static extension_settings = (account_email?: string|undefined) => `chrome/settings/index.htm?account_email=${account_email || ''}`;

  public static gmail = (account_email: string, url_end='') => `https://mail.google.com/mail/u/${gmail_seq.indexOf(account_email)}/#inbox${url_end}`;

}
