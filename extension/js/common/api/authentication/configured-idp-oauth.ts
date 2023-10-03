/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { GoogleOAuth } from './google/google-oauth.js';
import { Ui } from '../../browser/ui.js';
import { AcctStore } from '../../platform/store/acct-store.js';
import { OAuth } from './generic/oauth.js';

export class ConfiguredIdpOAuth extends OAuth {
  public static newAuthPopupForEnterpriseServerAuthenticationIfNeeded = async (acctEmail: string) => {
    const storage = await AcctStore.get(acctEmail, ['authentication']);
    if (storage?.authentication?.oauth?.clientId && storage.authentication.oauth.clientId !== GoogleOAuth.OAUTH.client_id) {
      await Ui.modal.warning(
        `Custom IdP is configured on this domain, but it is not supported on browser extension yet.
        Authentication with Enterprise Server will continue using Google IdP until implemented in a future update.`
      );
    } else {
      return;
    }
  };
}
