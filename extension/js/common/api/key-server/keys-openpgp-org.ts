/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { KEYS_OPENPGP_ORG_API_HOST } from '../../core/const.js';
import { ClientConfiguration } from '../../client-configuration.js';
import { ApiErr } from '../shared/api-error.js';
import { PubkeysSearchResult } from '../pub-lookup.js';
import { Api } from '../shared/api.js';

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
    try {
      const responseText: string = await Api.apiCall(
        KEYS_OPENPGP_ORG_API_HOST,
        `vks/v1/by-email/${encodeURIComponent(email)}`,
        undefined,
        undefined,
        undefined,
        'text'
      );
      return { pubkeys: [responseText] };
    } catch (e) {
      /**
       * Error 429 should be interpreted as error 404 - public key not found
       * (because their rate limits are excessively strict, and you could run into them just
       * by loading a conversation with 20 people in it a few time).
       */
      if (ApiErr.isNotFound(e) || ApiErr.isRateLimit(e)) {
        return { pubkeys: [] };
      }
      throw e;
    }
  };
}
