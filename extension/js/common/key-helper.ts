/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Attester } from './api/key-server/attester.js';
import { ApiErr } from './api/shared/api-error.js';
import { Ui } from './browser/ui.js';
import { ClientConfiguration } from './client-configuration.js';
import { asyncSome } from './core/common.js';
import { InMemoryStoreKeys } from './core/const.js';
import { KeyUtil, Key } from './core/crypto/key.js';
import { KeyStoreUtil } from './core/crypto/key-store-util.js';
import { CompanyLdapKeyMismatchError } from './platform/catch.js';
import { InMemoryStore } from './platform/store/in-memory-store.js';
import { KeyStore } from './platform/store/key-store.js';

/**
 * empty pubkey means key not usable
 */
export const submitPublicKeyIfNeeded = async (
  clientConfiguration: ClientConfiguration,
  acctEmail: string,
  submitKeyForAddrs: string[],
  attester: Attester,
  armoredPubkey: string | undefined,
  options: { submit_main: boolean; submit_all: boolean } // eslint-disable-line @typescript-eslint/naming-convention
) => {
  if (!options.submit_main) {
    return;
  }
  if (!clientConfiguration.canSubmitPubToAttester()) {
    if (!clientConfiguration.usesKeyManager) {
      // users who use EKM get their setup automated - no need to inform them of this
      // other users chose this manually - let them know it's not allowed
      await Ui.modal.error('Not submitting public key to Attester - disabled for your org');
    }
    return;
  }
  if (!armoredPubkey) {
    await Ui.modal.warning('Public key not usable - not submitting to Attester');
    return;
  }
  const pub = await KeyUtil.parse(armoredPubkey);
  if (pub.usableForEncryption) {
    const idToken = await InMemoryStore.get(acctEmail, InMemoryStoreKeys.ID_TOKEN);
    attester.welcomeMessage(acctEmail, armoredPubkey, idToken).catch(ApiErr.reportIfSignificant);
  }
  let addresses;
  if (submitKeyForAddrs.length && options.submit_all) {
    addresses = [...submitKeyForAddrs];
  } else {
    addresses = [acctEmail];
  }
  await submitPubkeys(clientConfiguration, acctEmail, attester, addresses, armoredPubkey);
};

export const submitPubkeys = async (clientConfiguration: ClientConfiguration, acctEmail: string, attester: Attester, addresses: string[], pubkey: string) => {
  if (clientConfiguration.setupEnsureImportedPrvMatchLdapPub()) {
    // this will generally ignore errors if conflicting key already exists, except for certain orgs
    const result = await attester.doLookupLdap(acctEmail);
    if (result.pubkeys.length) {
      const prvs = await KeyStoreUtil.parse(await KeyStore.getRequired(acctEmail));
      const parsedPubKeys: Key[] = [];
      for (const pubKey of result.pubkeys) {
        parsedPubKeys.push(...(await KeyUtil.parseMany(pubKey)));
      }
      const hasMatchingKey = await asyncSome(prvs, async privateKey => {
        return parsedPubKeys.some(parsedPubKey => privateKey.key.id === parsedPubKey.id);
      });
      if (!hasMatchingKey) {
        const keyIds = prvs.map(prv => prv.key.id).join(', ');
        const pubKeyIds = parsedPubKeys.map(pub => pub.id).join(', ');
        throw new CompanyLdapKeyMismatchError(
          `Imported private key with ids ${keyIds} does not match public keys on company LDAP server with ids ${pubKeyIds} for ${acctEmail}. Please ask your help desk.`
        );
      }
    } else {
      throw new CompanyLdapKeyMismatchError(
        `Your organization requires public keys to be present on company LDAP server, but no public key was found for ${acctEmail}. Please ask your internal help desk.`
      );
    }
  } else {
    // this will actually replace the submitted public key if there was a conflict, better ux
    const idToken = await InMemoryStore.get(acctEmail, InMemoryStoreKeys.ID_TOKEN);
    await attester.submitPrimaryEmailPubkey(acctEmail, pubkey, idToken ?? '');
  }
  const aliases = addresses.filter(a => a !== acctEmail);
  if (aliases.length) {
    await Promise.all(aliases.map(a => attester.submitPubkeyWithConditionalEmailVerification(a, pubkey)));
  }
};
