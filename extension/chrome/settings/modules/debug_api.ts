/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Dict, Url } from '../../../js/common/core/common.js';

import { Assert } from '../../../js/common/assert.js';
import { Gmail } from '../../../js/common/api/email_provider/gmail/gmail.js';
import { Store } from '../../../js/common/platform/store.js';
import { View } from '../../../js/common/view.js';
import { Xss } from '../../../js/common/platform/xss.js';

View.run(class DebugApiView extends View {

  private readonly acctEmail: string;
  private readonly which: string;
  private readonly gmail: Gmail;

  constructor() {
    super();
    const uncheckedUrlParams = Url.parse(['acctEmail', 'parentTabId', 'which']);
    this.acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
    this.which = Assert.urlParamRequire.oneof(uncheckedUrlParams, 'which', ['google_account', 'flowcrypt_account', 'flowcrypt_subscription', 'local_store']);
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
      this.renderCallRes('Store.getAcct.openid', { acctEmail: this.acctEmail }, await Store.getAcct(this.acctEmail, ['openid']));
    } else if (this.which === 'flowcrypt_account') {
      Xss.sanitizeAppend('#content', `Unsupported which: ${Xss.escape(this.which)} (not implemented)`);
    } else if (this.which === 'flowcrypt_subscription') {
      Xss.sanitizeAppend('#content', `Unsupported which: ${Xss.escape(this.which)} (not implemented)`);
    } else if (this.which === 'local_store') {
      const storage = await Store.getAcct(this.acctEmail, [
        'notification_setup_needed_dismissed', 'email_provider', 'google_token_scopes', 'hide_message_password', 'sendAs', 'outgoing_language',
        'full_name', 'cryptup_enabled', 'setup_done', 'setup_simple', 'is_newly_created_key', 'key_backup_method',
        'key_backup_prompt', 'successfully_received_at_leat_one_message', 'notification_setup_done_seen', 'openid',
        'rules', 'subscription', 'use_rich_text',
      ]);
      this.renderCallRes('Local account storage', { acctEmail: this.acctEmail }, storage);
    } else {
      Xss.sanitizeAppend('#content', `Unknown which: ${Xss.escape(this.which)}`);
    }
  }

  public setHandlers = () => {
    // No need
  }

  private renderCallRes = (api: string, variables: Dict<any>, result: any, error?: any) => {
    const r = `<b>${api} ${JSON.stringify(variables)}</b><pre>${JSON.stringify(result, undefined, 2)} (${error ? JSON.stringify(error) : 'no err'})</pre>`;
    Xss.sanitizeAppend('#content', r);
  }

});
