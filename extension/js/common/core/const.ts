/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

export const VERSION = '[BUILD_REPLACEABLE_VERSION]';
export const FLAVOR: 'consumer' | 'enterprise' = '[BUILD_REPLACEABLE_FLAVOR]' as unknown as 'consumer' | 'enterprise';
export const OAUTH_GOOGLE_API_HOST = '[BUILD_REPLACEABLE_OAUTH_GOOGLE_API_HOST]';
export const GMAIL_GOOGLE_API_HOST = '[BUILD_REPLACEABLE_GMAIL_GOOGLE_API_HOST]';
export const PEOPLE_GOOGLE_API_HOST = '[BUILD_REPLACEABLE_PEOPLE_GOOGLE_API_HOST]';
export const GOOGLE_OAUTH_SCREEN_HOST = '[BUILD_REPLACEABLE_GOOGLE_OAUTH_SCREEN_HOST]';
export const BACKEND_API_HOST = '[BUILD_REPLACEABLE_BACKEND_API_HOST]';
export const ATTESTER_API_HOST = '[BUILD_REPLACEABLE_ATTESTER_API_HOST]';
export const SHARED_TENANT_API_HOST = '[BUILD_REPLACEABLE_SHARED_TENANT_API_HOST]';
export const KEYS_OPENPGP_ORG_API_HOST = '[BUILD_REPLACEABLE_KEYS_OPENPGP_ORG_API_HOST]';
export const MOCK_PORT = '[TEST_REPLACEABLE_MOCK_PORT]';
export const WKD_API_HOST = ''; // empty means choose host per recipient domain

/**
 * Only put constants below if:
 *   - they are useful across web/extension/Nodejs environments, AND
 *   - the only other reasonable place to put them would be OUTSIDE of the /core folder
 *   - example: A Google query below would normally go in Google class, but that's outside of /core and we also need it on Android
 *
 * For any constants that are not expected to be reused that widely, just put them as private or public static props in relevant class.
 */

export const GMAIL_RECOVERY_EMAIL_SUBJECTS = [
  'Your FlowCrypt Backup',
  'Your CryptUp Backup',
  'All you need to know about CryptUP (contains a backup)',
  'CryptUP Account Backup',
];

export const gmailBackupSearchQuery = (acctEmail: string) => {
  return ['from:' + acctEmail, 'to:' + acctEmail, '(subject:"' + GMAIL_RECOVERY_EMAIL_SUBJECTS.join('" OR subject: "') + '")', '-is:spam', '-is:trash'].join(
    ' '
  );
};

export class InMemoryStoreKeys {
  public static readonly ID_TOKEN = 'idToken';
  public static readonly CUSTOM_IDP_ID_TOKEN = 'customIdpIdToken';
  public static readonly GOOGLE_TOKEN_ACCESS = 'google_token_access';
}
