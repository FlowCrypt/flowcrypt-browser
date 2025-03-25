/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Dict, Url } from '../../../js/common/core/common.js';
import { Assert } from '../../../js/common/assert.js';
import { Gmail } from '../../../js/common/api/email-provider/gmail/gmail.js';
import { View } from '../../../js/common/view.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { AcctStore } from '../../../js/common/platform/store/acct-store.js';

View.run(
  class DebugApiView extends View {
    private readonly acctEmail: string;
    private readonly which: string;
    private readonly gmail: Gmail;

    public constructor() {
      super();
      const uncheckedUrlParams = Url.parse(['acctEmail', 'parentTabId', 'which']);
      this.acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
      this.which = Assert.urlParamRequire.oneof(uncheckedUrlParams, 'which', ['google_account', 'flowcrypt_account', 'local_store']);
      this.gmail = new Gmail(this.acctEmail);
    }

    public render = async () => {
      if (this.which === 'google_account') {
        try {
          const r = await this.gmail.fetchAcctAliases();
          this.renderCallRes('gmail.fetchAcctAliases', {}, r);
        } catch (e) {
          this.renderCallRes('gmail.fetchAcctAliases', {}, undefined, e);
        }
      } else if (this.which === 'flowcrypt_account') {
        Xss.sanitizeAppend('#content', `Unsupported which: ${Xss.escape(this.which)} (not implemented)`);
      } else if (this.which === 'local_store') {
        const storage = await AcctStore.get(this.acctEmail, [
          'authentication',
          'notification_setup_needed_dismissed',
          'email_provider',
          'hide_message_password',
          'sendAs',
          'outgoing_language',
          'full_name',
          'cryptup_enabled',
          'setup_done',
          'notification_setup_done_seen',
          'rules',
          'use_rich_text',
          'fesUrl',
        ]);
        this.renderCallRes('Local account storage', { acctEmail: this.acctEmail }, storage);
      } else {
        Xss.sanitizeAppend('#content', `Unknown which: ${Xss.escape(this.which)}`);
      }
    };

    public setHandlers = () => {
      // No need
    };

    private renderCallRes = (api: string, variables: Dict<unknown>, result: unknown, error?: unknown) => {
      const r = `<b>${api} ${JSON.stringify(variables)}</b><pre data-test="container-pre">${JSON.stringify(result, undefined, 2)} (${
        error ? JSON.stringify(error) : 'no err'
      })</pre>`;
      Xss.sanitizeAppend('#content', r);
    };
  }
);
