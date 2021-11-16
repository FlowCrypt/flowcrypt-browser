/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

export const VERSION = '[BUILD_REPLACEABLE_VERSION]';
export const FLAVOR: 'consumer' | 'enterprise' = '[BUILD_REPLACEABLE_FLAVOR]' as any;
export const GOOGLE_API_HOST = '[BUILD_REPLACEABLE_GOOGLE_API_HOST]';
export const PEOPLE_API_HOST = '[BUILD_REPLACEABLE_PEOPLE_API_HOST]';
export const GOOGLE_OAUTH_SCREEN_HOST = '[BUILD_REPLACEABLE_GOOGLE_OAUTH_SCREEN_HOST]';
export const BACKEND_API_HOST = '[BUILD_REPLACEABLE_BACKEND_API_HOST]';
export const ATTESTER_API_HOST = '[BUILD_REPLACEABLE_ATTESTER_API_HOST]';

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
  return [
    'from:' + acctEmail,
    'to:' + acctEmail,
    '(subject:"' + GMAIL_RECOVERY_EMAIL_SUBJECTS.join('" OR subject: "') + '")',
    '-is:spam',
    '-is:trash'
  ].join(' ');
};
