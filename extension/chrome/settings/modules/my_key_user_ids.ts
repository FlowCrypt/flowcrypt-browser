/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { KeyInfo, PgpKey } from '../../../js/common/core/pgp-key.js';

import { Assert } from '../../../js/common/assert.js';
import { Url, Str } from '../../../js/common/core/common.js';
import { View } from '../../../js/common/view.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { AcctKeyStore } from '../../../js/common/platform/store/acct-key-store.js';

View.run(class MyKeyUserIdsView extends View {
  private readonly acctEmail: string;
  private readonly longid: string;
  private readonly myKeyUrl: string;
  private primaryKi: KeyInfo | undefined;
  constructor() {
    super();
    const uncheckedUrlParams = Url.parse(['acctEmail', 'longid', 'parentTabId']);
    this.acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
    this.longid = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'longid') || 'primary';
    this.myKeyUrl = Url.create('my_key.htm', uncheckedUrlParams);
  }

  public render = async () => {
    [this.primaryKi] = await AcctKeyStore.keysGet(this.acctEmail, [this.longid]);
    Assert.abortAndRenderErrorIfKeyinfoEmpty(this.primaryKi);
    $('.action_show_public_key').attr('href', this.myKeyUrl);
    const prv = await PgpKey.read(this.primaryKi.private);
    const userIds = prv.users.map(u => u.userId).filter(Boolean).map(uid => uid!.userid); // todo - create a common function in settings.js for here and setup.js user_ids
    Xss.sanitizeRender('.user_ids', userIds.map((uid: string) => `<div>${Xss.escape(uid)}</div>`).join(''));
    $('.email').text(this.acctEmail);
    $('.longid').text(Str.spaced(this.primaryKi.longid));
  }

  public setHandlers = () => {
    // No need
  }
});
