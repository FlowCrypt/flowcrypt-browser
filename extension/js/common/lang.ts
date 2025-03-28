/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { FLAVOR } from './core/const.js';

const isEnterpriseBuildUsed = FLAVOR === 'enterprise';

const contactMinimalSubsentence = (isCustomerUrlFesUsed: boolean) =>
  isCustomerUrlFesUsed || isEnterpriseBuildUsed ? 'contact your Help Desk' : 'write us at human@flowcrypt.com';
const contactIfHappensAgain = (isCustomerUrlFesUsed: boolean) => `If this happens again, please ${contactMinimalSubsentence(isCustomerUrlFesUsed)}. `;
const contactForSupportSubsentence = (isCustomerUrlFesUsed: boolean, reason = '') =>
  isCustomerUrlFesUsed || isEnterpriseBuildUsed ? `Please contact your Help Desk ${reason}` : `Please write us at human@flowcrypt.com ${reason}`;

// eslint-disable-next-line @typescript-eslint/naming-convention
export const Lang = {
  error: {
    dbFailed:
      "Try restarting your browser first. If that doesn't help, this will have something to do with your browser settings. Try to install FlowCrypt on a brand new browser profile (both Firefox and Chrome allow you to have several different user profiles). If you leave the new profile on default settings, FlowCrypt should work without issues. Then you can compare your old profile settings to the new one to find out which settings are giving FlowCrypt trouble. Once you find out, please contact us know at human@flowcrypt.com and we will include it below to help other users.",
  },
  setup: {
    partiallyEncryptedKeyUnsupported:
      'This Private Key seems to be only partially encrypted (some secret packets are encrypted, some not).\n\nSuch keys are not supported - please either fully encrypt or fully decrypt the key before importing it.',
    confirmResetAcct: (acctEmail: string) =>
      `This will remove all your FlowCrypt settings for ${acctEmail} including your keys. It is not a recommended thing to do.\n\nMAKE SURE TO BACK UP YOUR PRIVATE KEY AND PASS PHRASE IN A SAFE PLACE FIRST OR YOU MAY LOSE IT`,
    confirmResetAcctForEkm: 'You may lose local settings by resetting this extension. Do you want to continue?',
    confirmManualAcctEmailChange: (currentAcctEmail: string) =>
      `Your current account email is ${currentAcctEmail}.\n\nUse this when your Google Account email address has changed and the account above is outdated.\n\nIn the following step, please sign in with your updated Google Account.\n\nContinue?`,
    keyFormattedWell: (begin: string, end: string) =>
      `Private key is not correctly formatted. Please insert complete key, including "${begin}" and "${end}"\n\nEnter the private key you previously used. The corresponding public key is registered with your email, and the private key is needed to confirm this change.\n\nIf you chose to download your backup as a file, you should find it inside that file. If you backed up your key on Gmail, you will find there it by searching your inbox.`,
    failedToCheckIfAcctUsesEncryption: 'Failed to check if encryption is already set up on your account. ',
    failedToCheckAccountBackups: 'Failed to check for account backups. ',
    failedToSubmitToAttester: 'Failed to submit to Attester. ',
    failedToImportUnknownKey: 'Attempting to import unknown key. ',
    failedToBackUpKey: 'Failed to back up your key. ',
    failedToLoadEmailAliases: 'Failed to load your email aliases. ',
    cannotLocateBackupPasteManually:
      'FlowCrypt can\'t locate your backup automatically.</div><div class="line">Find "Your FlowCrypt Backup" email, open the attachment, copy all text and paste it below.',
    confirmSkipRecovery:
      'Your account will be set up for encryption again, but your previous encrypted emails will be unreadable. You will need to inform your encrypted contacts that you have a new key. Regular email will not be affected. Are you sure?',
    nBackupsAlreadyRecoveredOrLeft: (nGot: number, nBups: number, txtTeft: string) =>
      `You successfully recovered ${nGot} of ${nBups} backups. There ${txtTeft} left.<br><br>Try a different pass phrase to unlock all backups.`,
    tryDifferentPassPhraseForRemainingBackups:
      'This pass phrase was already used to recover some of your backups.\n\nThe remaining backups use a different pass phrase.\n\nPlease try another one.\n\nYou can skip this step, but some of your encrypted email may not be readable.',
    creatingKeysNotAllowedPleaseImport: 'Creating keys is not allowed on your domain. Please import your keys.',
    keyBackupsNotAllowed: 'Key backups are not allowed on this domain.',
    prvHasFixableCompatIssue:
      'This key has minor usability issues that can be fixed. This commonly happens when importing keys from Symantec&trade; PGP Desktop or other legacy software. It may be missing User IDs, or it may be missing a self-signature. It is also possible that the key is simply expired.',
    ppMatchAllSet: "Your pass phrase matches. Good job! You're all set.",
    noKeys: 'Keys for your account were not set up yet - please ask your systems administrator.',
    prvBackupToDesignatedMailboxEmailSubject: (acctEmail: string, fingerprint: string) =>
      `FlowCrypt OpenPGP Private Key backup for user ${acctEmail} with id ${fingerprint}`,
    prvBackupToDesignatedMailboxEmailBody:
      "Please keep this email and attachment in the mailbox for safekeeping. It will be needed if the user ever needs to set up FlowCrypt again or forgets their pass phrase. Without this, the user won't be able to read their emails.\n\nSee https://flowcrypt.com/docs/technical/enterprise/configuration/backup-to-designated-mailbox.html#account-recovery.",
  },
  account: {
    googleAcctDisabledOrPolicy: `Your Google Account or Google Email seems to be disabled, or access to this app is disabled by your organisation admin policy. Contact your email administrator.`,
  },
  pgpBlock: {
    cantOpen: 'Could not open this message with FlowCrypt.\n\n',
    details: 'Details: ',
    pwdMsgOnlyReadableOnWeb:
      'This password-encrypted message (received before installing FlowCrypt?) is only readable on the web.\n\nPlease click "Open Message" above and enter sender-provided message password to open it.\n\nAlternatively, ask sender to re-send it - newly received messages will be readable in inbox.\n\n',
    yourKeyCantOpenImportIfHave: 'Your current key cannot open this message. If you have any other keys available, you should import them now.\n',
    encryptedCorrectlyFileBug: "It's correctly encrypted for you. Please file a bug report if you see this on multiple messages. ",
    singleSender:
      'Normally, messages are encrypted for at least two people (sender and the receiver). It seems the sender encrypted this message manually for themselves, and forgot to add you as a receiver. This sometimes happens when the sender is using OpenPGP software other than FlowCrypt, because they have to configure encryption manually, and mistakes can happen. ',
    accountInfoOutdated: 'Some of your account information is incorrect. Update it to prevent future errors. ',
    wrongPubkeyUsed:
      'It looks like it was encrypted for someone else. If you have more keys that may help decrypt this message, you can add them in the settings. ',
    askResend: 'Please ask them to send a new message.\n',
    receiversHidden: 'Cannot tell if the message was encrypted correctly for you. ',
    badFormat: 'Message is either badly formatted or not compatible with FlowCrypt. ',
    noPrivateKey: 'No private key to decrypt this message. Try reloading the page. ',
    refreshPage: 'Refresh page to see more information.',
    wrongPassword: 'Wrong password. ',
    decryptPasswordPrompt: 'Please enter password to decrypt the message',
    connError: 'Could not connect to email provider to open the message, please refresh the page to try again. ',
    dontKnowHowOpen: (isCustomerUrlFesUsed: boolean) =>
      `Please ${contactMinimalSubsentence(isCustomerUrlFesUsed)} to submit a bug report, and mention what software was used to send this message to you. `,
    enterPassphrase: 'Enter passphrase',
    passphraseAttemptIntroduce: (attemptsLeft: string) =>
      `For your protection and data security, there are currently only ${attemptsLeft} left.<br />If attempts are exceeded, there will a 5-minute cooldown period before you may try again.`,
    passphraseAntiBruteForceProtectionHint: `To protect you and your data, the next attempt will only be possible after the timer below finishes. Please wait until then before trying again.`,
    toOpenMsg: 'to open this message.',
    refreshWindow: 'Please refresh your web mail window to read encrypted messages. ',
    updateChromeSettings: 'Need to update chrome settings to view encrypted messages. ',
    notProperlySetUp: 'FlowCrypt is not properly set up to decrypt messages. ',
    msgExpiredOn: 'Message expired on ',
    msgsDontExpire: "Messages don't expire if recipients also have encryption set up.",
    msgDestroyed: 'Message was destroyed 30 days after expiration and cannot be renewed.',
    askSenderRenew: 'Please ask the sender to renew the message if you still need the contents',
    cannotLocate: 'Could not locate this message.',
    brokenLink: 'It seems it contains a broken link.',
    pwdMsgAskSenderUsePubkey: 'This appears to be a password-protected message. Please ask the sender to encrypt messages for your Public Key instead.',
    invalidCheckSum:
      'Warning: Checksum mismatch detected.\nThis indicates the message may have been altered or corrupted during transmission.\nDecryption may still succeed, but verify the message source and integrity if possible.',
  },
  compose: {
    abortSending: 'A message is currently being sent. Closing the compose window may abort sending the message.\nAbort sending?',
    addMissingRecipientPubkeys: `Some recipients don't have encryption set up. Please import their public keys or ask them to install Flowcrypt.`,
    pleaseReconnectAccount:
      'Please reconnect FlowCrypt to your Gmail Account. This is typically needed after a long time of no use, a password change, or similar account changes. ',
    pleaseReconnectCustomIDPAccount:
      'Please reconnect FlowCrypt to your custom IDP Account. This is typically needed after a long time of no use, a password change, or similar account changes. ',
    msgEncryptedHtml: (lang: string, senderEmail: string) =>
      lang === 'DE'
        ? `${senderEmail}&nbsp;hat&nbsp;Ihnen&nbsp;eine&nbsp;passwortverschlüsselte&nbsp;E-Mail&nbsp;gesendet `
        : `${senderEmail}&nbsp;has&nbsp;sent&nbsp;you&nbsp;a&nbsp;password-encrypted&nbsp;email `,
    msgEncryptedText: (lang: string, senderEmail: string) =>
      lang === 'DE'
        ? `${senderEmail} hat Ihnen eine passwortverschlüsselte E-Mail gesendet. Folgen Sie diesem Link, um es zu öffnen: `
        : `${senderEmail} has sent you a password-encrypted email. Follow this link to open it: `,
    alternativelyCopyPaste: {
      EN: 'Alternatively copy and paste the following link: ', // eslint-disable-line @typescript-eslint/naming-convention
      DE: 'Alternativ kopieren Sie folgenden Link und fügen ihn in die Adresszeile Ihres Browsers ein: ', // eslint-disable-line @typescript-eslint/naming-convention
    },
    openMsg: { EN: 'Click here to Open Message', DE: 'Klicken Sie hier, um die Nachricht zu öffnen' }, // eslint-disable-line @typescript-eslint/naming-convention
    includePubkeyIconTitle:
      'Include your public key in this email.\n\nIf enabled, your public key will be included.\n\nThis allows people using non-FlowCrypt encryption to reply to you.',
    headers: {
      encrypted: 'New Secure Message',
      encryptedAndSigned: 'New Signed Secure Message',
      signed: 'New Signed Message (not encrypted)',
      plain: 'New Plain Message (not encrypted)',
    },
    pubkeyExpiredConfirmCompose:
      'The public key of one of your recipients is expired.\n\nThe right thing to do is to ask the recipient to send you an updated Public Key.\n\nAre you sure you want to encrypt this message for an expired public key? (NOT RECOMMENDED)',
    needReadAccessToReply: 'FlowCrypt has limited functionality. Your browser needs to access this conversation to reply.',
    addMissingPermission: 'Add missing permission',
    enterprisePasswordPolicy:
      'Please use password with the following properties:\n - one uppercase\n - one lowercase\n - one number\n - one special character eg &"#-\'_%-@,;:!*()\n - 8 characters length',
    consumerPasswordPolicy: 'Please use a password at least 8 characters long.',
    inputLimitExceededOnPaste: "The paste operation can't be completed because the resulting text size would exceed the allowed limit of 50K.",
  },
  general: {
    contactMinimalSubsentence,
    contactIfHappensAgain,
    contactIfNeedAssistance: (isCustomerUrlFesUsed = false) => contactForSupportSubsentence(isCustomerUrlFesUsed, 'if you need an assistance.'),
    somethingWentWrongTryAgain: (isCustomerUrlFesUsed: boolean) => `Something went wrong, please try again. ${contactIfHappensAgain(isCustomerUrlFesUsed)}`,
    contactForSupportSubsentence,
    contactForSupportSentence: (isCustomerUrlFesUsed = false) => contactForSupportSubsentence(isCustomerUrlFesUsed, 'for support.'),
    writeMeToFixIt: (isCustomerUrlFesUsed: boolean) => contactForSupportSubsentence(isCustomerUrlFesUsed, 'to fix it.'),
    emailAliasChangedAskForReload: 'Your email aliases on Gmail have refreshed since the last time you used FlowCrypt.\nReload the compose window now?',
  },
  passphraseRequired: {
    sign: 'Enter FlowCrypt pass phrase to sign email',
    draft: 'Enter FlowCrypt pass phrase to load a draft',
    attachment: 'Enter FlowCrypt pass phrase to decrypt a file',
    quote: 'Enter FlowCrypt pass phrase to load quoted content',
    backup: 'Enter FlowCrypt pass phrase to back up',
    updateKey: 'Enter FlowCrypt pass phrase to keep your account keys up to date',
    email: 'Enter FlowCrypt pass phrase to read encrypted email',
  },
  settings: {
    deleteKeyConfirm: (fingerprint: string) => `Are you sure you want to remove encryption key with fingerprint ${fingerprint}?`,
  },
  attachment: {
    executableFileWarning: 'This executable file was not checked for viruses, and may be dangerous to download or run. Proceed anyway?', // xss-escaped
  },
};
