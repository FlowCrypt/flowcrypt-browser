/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { AcctStore } from '../../platform/store/acct-store.js';
import { OAuth } from './oauth.js';
import { GoogleOAuth } from './google/google-oauth.js';
import { Ui } from '../../browser/ui.js';

export class ConfiguredIdpOAuth extends OAuth {
  public static newAuthPopupForEnterpriseServerAuthenticationIfNeeded = async (acctEmail: string | undefined) => {
    if (acctEmail) {
      const authentication = (await AcctStore.get(acctEmail, ['authentication'])).authentication;
      if (authentication?.oauth?.clientId && authentication?.oauth?.clientId !== GoogleOAuth.OAUTH.client_id) {
        return await Ui.modal.warning(
          `Custom IdP is configured on this domain, but it is not supported on browser extension yet.\n
      Authentication with Enterprise Server will continue using Google IdP until implemented in a future update.`
        );
      }
    }
    return Promise<void>;
  };
}
