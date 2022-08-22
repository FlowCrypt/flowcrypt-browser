/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Api } from './../shared/api.js';
import { ApiErr } from '../shared/api-error.js';
import { Buf } from '../../core/buf.js';
import { PubkeysSearchResult } from './../pub-lookup.js';
import { Key, KeyUtil } from '../../core/crypto/key.js';

// tslint:disable:no-direct-ajax

export class Wkd extends Api {

  // https://datatracker.ietf.org/doc/draft-koch-openpgp-webkey-service/?include_text=1
  // https://www.sektioneins.de/en/blog/18-11-23-gnupg-wkd.html
  // https://metacode.biz/openpgp/web-key-directory

  public port: number | undefined;

  constructor(
    private domainName: string,
    private usesKeyManager: boolean
  ) {
    super();
  }

  // returns all the received keys
  public rawLookupEmail = async (email: string): Promise<{ keys: Key[], errs: Error[] }> => {
    // todo: should we return errs on network failures etc.?
    const parts = email.split('@');
    if (parts.length !== 2) {
      return { keys: [], errs: [] };
    }
    const [user, recipientDomain] = parts;
    if (!user || !recipientDomain) {
      return { keys: [], errs: [] };
    }
    const lowerCaseRecipientDomain = recipientDomain.toLowerCase();
    const directDomain = lowerCaseRecipientDomain;
    const timeout = (this.usesKeyManager && lowerCaseRecipientDomain === this.domainName) ? 10 : 4;
    const advancedDomainPrefix = (directDomain === 'localhost') ? '' : 'openpgpkey.';
    const hashed = await window.crypto.subtle.digest('SHA-1', Buf.fromUtfStr(user.toLowerCase()));
    const hu = this.encodeZBase32(new Uint8Array(hashed));
    const directHost = (typeof this.port === 'undefined') ? directDomain : `${directDomain}:${this.port}`;
    const advancedHost = `${advancedDomainPrefix}${directHost}`;
    const userPart = `hu/${hu}?l=${encodeURIComponent(user)}`;
    const advancedUrl = `https://${advancedHost}/.well-known/openpgpkey/${directDomain}`;
    const directUrl = `https://${directHost}/.well-known/openpgpkey`;
    let response = await this.urlLookup(advancedUrl, userPart, timeout);
    if (!response.buf && response.hasPolicy) {
      return { keys: [], errs: [] }; // do not retry direct if advanced had a policy file
    }
    if (!response.buf) {
      response = await this.urlLookup(directUrl, userPart, timeout);
    }
    if (!response.buf) {
      return { keys: [], errs: [] }; // do not retry direct if advanced had a policy file
    }
    return await KeyUtil.readMany(response.buf);
  };

  public lookupEmail = async (email: string): Promise<PubkeysSearchResult> => {
    const { keys, errs } = await this.rawLookupEmail(email);
    if (errs.length) {
      return { pubkeys: [] };
    }
    const pubkeys = keys.filter(key => key.emails.some(x => x.toLowerCase() === email.toLowerCase()));
    if (!pubkeys.length) {
      return { pubkeys: [] };
    }
    try {
      return { pubkeys: pubkeys.map(pubkey => KeyUtil.armor(pubkey)) };
    } catch (e) {
      return { pubkeys: [] };
    }
  };

  private urlLookup = async (methodUrlBase: string, userPart: string, timeout: number): Promise<{ hasPolicy: boolean, buf?: Buf }> => {
    try {
      await Wkd.download(`${methodUrlBase}/policy`, undefined, timeout);
    } catch (e) {
      return { hasPolicy: false };
    }
    try {
      const buf = await Wkd.download(`${methodUrlBase}/${userPart}`, undefined, timeout);
      if (buf.length) {
        console.info(`Loaded WKD url ${methodUrlBase}/${userPart} and will try to extract Public Keys`);
      }
      return { hasPolicy: true, buf };
    } catch (e) {
      if (!ApiErr.isNotFound(e)) {
        console.info(`Wkd.lookupEmail error retrieving key: ${String(e)}`);
      }
      return { hasPolicy: true };
    }
  };

  /**
   * The following method is a modified version of code under LGPL 3.0 received from:
   * https://github.com/openpgpjs/wkd-client/blob/a175bc6c90fcea0c91e94061237a53c5b43ee0f8/src/wkd.js
   * This method remains under the same license.
   */
  private encodeZBase32 = (data: Uint8Array) => {
    if (data.length === 0) {
      return '';
    }
    const ALPHABET = "ybndrfg8ejkmcpqxot1uwisza345h769";
    const SHIFT = 5;
    const MASK = 31;
    let buffer = data[0];
    let index = 1;
    let bitsLeft = 8;
    let result = '';
    while (bitsLeft > 0 || index < data.length) {
      if (bitsLeft < SHIFT) {
        if (index < data.length) {
          buffer <<= 8;
          buffer |= data[index++] & 0xff;
          bitsLeft += 8;
        } else {
          const pad = SHIFT - bitsLeft;
          buffer <<= pad;
          bitsLeft += pad;
        }
      }
      bitsLeft -= SHIFT;
      result += ALPHABET[MASK & (buffer >> bitsLeft)];
    }
    return result;
  };

}
