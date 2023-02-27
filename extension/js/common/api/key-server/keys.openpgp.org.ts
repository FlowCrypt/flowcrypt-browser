/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { KEYS_OPENPGP_ORG_API_HOST } from 'js/common/core/const';
import { ClientConfiguration } from '../../client-configuration';
import { PubkeysSearchResult } from './../pub-lookup.js';
import { Api } from './../shared/api.js';

// Documentation url: https://keys.openpgp.org/about/api
export class KeysOpenpgpOrg extends Api {
  public constructor(private clientConfiguration: ClientConfiguration) {
    super();
  }

  public lookupEmail = async (email: string): Promise<PubkeysSearchResult> => {
    if (!this.clientConfiguration.canLookupThisRecipientOnKeysOpenPGP(email)) {
      console.info(`Skipping keys.openpgp.org search of ${email} because search on this domain is disabled.`);
      return { pubkeys: [] };
    }
    const keys = await Api.apiCall<string>(KEYS_OPENPGP_ORG_API_HOST, ` /vks/v1/by-email/${encodeURIComponent(email)}`);
    return { pubkeys: [keys] };
  };
}
