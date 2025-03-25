/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { GmailCategory } from '../tests/gmail';

export class TestUrls {
  public constructor(
    public extensionId: string,
    public port?: number
  ) {}

  public static googleChat = (acctLoginIndex = 0) => {
    return `https://mail.google.com/chat/u/${acctLoginIndex}`;
  };

  public static gmail = (acctLoginIndex = 0, urlEnd = '', category: GmailCategory = 'inbox') => {
    return `https://mail.google.com/mail/u/${acctLoginIndex}/#${category}${urlEnd}`;
  };

  public extension = (path: string) => {
    return `chrome-extension://${this.extensionId}/${path}`;
  };

  public extensionSettings = (acctEmail?: string) => {
    return this.extension(`chrome/settings/index.htm?account_email=${acctEmail || ''}`);
  };

  public extensionInbox = (acctEmail: string, threadId?: string) => {
    const url = this.extension(`chrome/settings/inbox/inbox.htm?acctEmail=${acctEmail}`);
    return threadId ? url + `&threadId=${threadId}` : url;
  };

  public mockGmailUrl = () => `https://gmail.localhost:${this.port}/gmail`;
}
