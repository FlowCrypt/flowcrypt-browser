/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { KeyInfoWithIdentity, KeyUtil } from '../../../js/common/core/crypto/key.js';

import { Assert } from '../../../js/common/assert.js';
import { Url, Str } from '../../../js/common/core/common.js';
import { View } from '../../../js/common/view.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { KeyStore } from '../../../js/common/platform/store/key-store.js';

View.run(class MyKeyUserIdsView extends View {

  private readonly acctEmail: string;
  private readonly fingerprint: string;
  private readonly myKeyUrl: string;
  private ki: KeyInfoWithIdentity | undefined;

  constructor() {
    super();
    const uncheckedUrlParams = Url.parse(['acctEmail', 'fingerprint', 'parentTabId']);
    this.acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
    this.fingerprint = Assert.urlParamRequire.string(uncheckedUrlParams, 'fingerprint');
    this.myKeyUrl = Url.create('my_key.htm', uncheckedUrlParams);
  }

  public render = async () => {
    [this.ki] = await KeyStore.get(this.acctEmail, [this.fingerprint]);
    Assert.abortAndRenderErrorIfKeyinfoEmpty(this.ki ? [this.ki] : []);
    $('.action_show_public_key').attr('href', this.myKeyUrl);
    const prv = await KeyUtil.parse(this.ki.private);
    Xss.sanitizeRender('.user_ids', prv.identities.map((uid: string) => `<div>${Xss.escape(uid)}</div>`).join(''));
    $('.email').text(this.acctEmail);
    $('.fingerprint').text(Str.spaced(this.ki.fingerprints[0]));
  };

  public setHandlers = () => {
    // No need
  };

});
