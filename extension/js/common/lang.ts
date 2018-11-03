/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

export const Lang = {
  setup: {
    creatingKeysNotAllowedPleaseImport: 'Creating keys is not allowed on your domain. Please import your keys.',
    keyBackupsNotAllowed: 'Key backups are not allowed on this domain.',
  },
  account: {
    creditOrDebit: 'Enter credit or debit card to use. You can cancel anytime.',
  },
  pgpBlock: {
    cantOpen: 'Could not open this message with FlowCrypt.\n\n',
    yourKeyCantOpenImportIfHave: 'Your current key cannot open this message. If you have any other keys available, you should import them now.\n',
    encryptedCorrectlyFileBug: 'It\'s correctly encrypted for you. Please file a bug report if you see this on multiple messages. ',
    singleSender: 'Normally, messages are encrypted for at least two people (sender and the receiver). It seems the sender encrypted this message manually for themselves, and forgot to add you as a receiver. ',
    accountInfoOutdated: 'Some of your account information is incorrect. Update it to prevent future errors. ',
    wrongPubkeyUsed: 'It looks like it was encrypted for someone else. If you have more keys that may help decrypt this message, you can add them in the settings. ',
    askResend: 'Please ask them to send a new message.\n',
    receiversHidden: 'Cannot tell if the message was encrypted correctly for you. ',
    badFormat: 'Message is either badly formatted or not compatible with FlowCrypt. ',
    noPrivateKey: 'No private key to decrypt this message. Try reloading the page. ',
    refreshPage: 'Refresh page to see more information.',
    wrongPassword: 'Wrong password. ',
    decryptPasswordPrompt: 'Please enter password to decrypt the message',
    connError: 'Could not connect to email provider to open the message, please refresh the page to try again. ',
    dontKnowHowOpen: 'Please email us at human@flowcrypt.com to submit a bug report, and mention what software was used to send this message to you. We usually fix similar incompatibilities within one week. ',
    enterPassphrase: 'Enter passphrase',
    toOpenMsg: 'to open this message.',
    writeMe: 'Email human@flowcrypt.com to get this resolved. We respond promptly. ',
    refreshWindow: 'Please refresh your web mail window to read encrypted messages. ',
    updateChromeSettings: 'Need to update chrome settings to view encrypted messages. ',
    notProperlySetUp: 'FlowCrypt is not properly set up to decrypt messages. ',
    mdcWarning: 'This message has failed or missing integrity checks, and is not safe to render. The sender must be using a very old version of their software, and should update and send a new message.',
    msgExpiredOn: 'Message expired on ',
    msgsDontExpire: 'Messages don\'t expire if recipients also have encryption set up.',
    msgDestroyed: 'Message was destroyed 30 days after expiration and cannot be renewed.',
    askSenderRenew: 'Please ask the sender to renew the message if you still need the contents',
    cannotLocate: 'Could not locate this message.',
    brokenLink: 'It seems it contains a broken link.',
  },
  compose: {
    msgEncryptedHtml: {EN: 'This&nbsp;message&nbsp;is&nbsp;encrypted: ', DE: 'Diese&nbsp;Nachricht&nbsp;ist&nbsp;verschlüsselt: '},
    msgEncryptedText: {EN: 'This message is encrypted. Follow this link to open it: ', DE: 'Diese Nachricht ist verschlüsselt. Nachricht öffnen: '},
    alternativelyCopyPaste: {EN: 'Alternatively copy and paste the following link: ', DE: 'Alternativ kopieren Sie folgenden Link und fügen ihn in die Adresszeile Ihres Browsers ein: '},
    openMsg: {EN: 'Open Message', DE: 'Nachricht öffnen'},
    includePubkeyIconTitle: 'Include your Public Key with this message.\n\nThis allows people using non-FlowCrypt encryption to reply to you.',
    includePubkeyIconTitleActive: 'Your Public Key will be included with this message.\n\nThis allows people using non-FlowCrypt encryption to reply to you.',
    headerTitleComposeEncrypt: 'New Secure Message',
    headerTitleComposeSign: 'New Signed Message (not encrypted)',
  },
  general: {
    somethingWentWrongTryAgain: 'Something went wrong, please try again. If this happens again, please write us at human@flowcrypt.com to fix it. ',
    writeMeToFixIt: 'Email human@flowcrypt.com to get this resolved if it happens repeatedly. ',
    restartBrowserAndTryAgain: 'Unexpected error occured. Please restart your browser and try again. If this persists after a restart, please write us at human@flowcrypt.com.',
  },
};
