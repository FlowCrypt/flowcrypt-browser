/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */
import { Buf } from '../../core/buf';
import { MsgUtil } from '../../core/crypto/pgp/msg-util';
import { FesClientConfiguration, FesConfig } from './shared-tenant-fes-endpoints';
import { expect } from 'chai';

/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */
export const flowcryptTestClientConfiguration: FesConfig = {
  clientConfiguration: {
    flags: ['NO_PRV_CREATE', 'NO_PRV_BACKUP', 'HIDE_ARMOR_META', 'ENFORCE_ATTESTER_SUBMIT', 'SETUP_ENSURE_IMPORTED_PRV_MATCH_LDAP_PUB'],
  },
};

/* eslint-disable @typescript-eslint/naming-convention */
export const getKeyManagerAutogenRules = (port: number): FesClientConfiguration => {
  return {
    flags: ['NO_PRV_BACKUP', 'ENFORCE_ATTESTER_SUBMIT', 'PRV_AUTOIMPORT_OR_AUTOGEN', 'PASS_PHRASE_QUIET_AUTOGEN', 'DEFAULT_REMEMBER_PASS_PHRASE'],
    key_manager_url: `https://localhost:${port}/flowcrypt-email-key-manager`,
    enforce_keygen_algo: 'rsa2048',
    disallow_attester_search_for_domains: [],
  };
};

export const getKeyManagerAutoImportNoPrvCreateRules = (port: number): FesClientConfiguration => {
  const rules = getKeyManagerAutogenRules(port);
  return {
    ...rules,
    flags: [...(rules.flags ?? []), 'NO_PRV_CREATE'],
  };
};

export const getKeyManagerChoosePassphraseForbidStoringRules = (port: number): FesClientConfiguration => {
  const rules = getKeyManagerAutogenRules(port);
  return {
    ...rules,
    flags: ['NO_PRV_BACKUP', 'PRV_AUTOIMPORT_OR_AUTOGEN', 'NO_ATTESTER_SUBMIT', 'FORBID_STORING_PASS_PHRASE'],
  };
};

export const processMessageFromUser = async (body: string, fesUrl: string) => {
  expect(body).to.contain('-----BEGIN PGP MESSAGE-----');
  expect(body).to.contain('"associateReplyToken":"mock-fes-reply-token"');
  expect(body).to.contain('"to":["Mr To <to@example.com>"]');
  expect(body).to.contain('"cc":[]');
  expect(body).to.contain('"bcc":["Mr Bcc <bcc@example.com>"]');
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const encryptedData = body.match(/-----BEGIN PGP MESSAGE-----.*-----END PGP MESSAGE-----/s)![0];
  const decrypted = await MsgUtil.decryptMessage({
    kisWithPp: [],
    msgPwd: 'lousy pwdgO0d-pwd',
    encryptedData,
    verificationPubs: [],
  });
  expect(decrypted.success).to.equal(true);
  const decryptedMimeMsg = decrypted.content?.toUtfStr();
  expect(decryptedMimeMsg).to.contain(
    'Content-Type: text/plain\r\n' + 'Content-Transfer-Encoding: quoted-printable\r\n\r\n' + 'PWD encrypted message with FES - ID TOKEN'
  );
  // small.txt
  expect(decryptedMimeMsg).to.contain('Content-Type: text/plain; name=small.txt\r\n' + 'Content-Disposition: attachment; filename=small.txt');
  expect(decryptedMimeMsg).to.contain('Content-Transfer-Encoding: base64\r\n\r\n' + 'c21hbGwgdGV4dCBmaWxlCm5vdCBtdWNoIGhlcmUKdGhpcyB3b3JrZWQK');
  const response = {
    // this url is required for pubkey encrypted message
    url: `http://${fesUrl}/message/FES-MOCK-MESSAGE-ID`,
    externalId: 'FES-MOCK-EXTERNAL-ID',
    emailToExternalIdAndUrl: {} as { [email: string]: { url: string; externalId: string } },
  };
  response.emailToExternalIdAndUrl['to@example.com'] = {
    url: `http://${fesUrl}/message/FES-MOCK-MESSAGE-FOR-TO@EXAMPLE.COM-ID`,
    externalId: 'FES-MOCK-EXTERNAL-FOR-TO@EXAMPLE.COM-ID',
  };
  response.emailToExternalIdAndUrl['bcc@example.com'] = {
    url: `http://${fesUrl}/message/FES-MOCK-MESSAGE-FOR-BCC@EXAMPLE.COM-ID`,
    externalId: 'FES-MOCK-EXTERNAL-FOR-BCC@EXAMPLE.COM-ID',
  };
  return response;
};

export const processMessageFromUser2 = async (body: string, fesUrl: string) => {
  expect(body).to.contain('-----BEGIN PGP MESSAGE-----');
  expect(body).to.contain('"associateReplyToken":"mock-fes-reply-token"');
  expect(body).to.contain('"to":["sender@domain.com","flowcrypt.compatibility@gmail.com","to@example.com","mock.only.pubkey@flowcrypt.com"]');
  expect(body).to.contain('"cc":[]');
  expect(body).to.contain('"bcc":[]');
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const encryptedData = Buf.fromUtfStr(body.match(/-----BEGIN PGP MESSAGE-----.*-----END PGP MESSAGE-----/s)![0]);
  const decrypted = await MsgUtil.decryptMessage({
    kisWithPp: [],
    msgPwd: 'gO0d-pwd',
    encryptedData,
    verificationPubs: [],
  });
  expect(decrypted.success).to.equal(true);
  const decryptedMimeMsg = decrypted.content?.toUtfStr();
  // small.txt
  expect(decryptedMimeMsg).to.contain('Content-Type: text/plain; name=small.txt\r\n' + 'Content-Disposition: attachment; filename=small.txt');
  expect(decryptedMimeMsg).to.contain('Content-Transfer-Encoding: base64\r\n\r\n' + 'c21hbGwgdGV4dCBmaWxlCm5vdCBtdWNoIGhlcmUKdGhpcyB3b3JrZWQK');
  // small.pdf
  expect(decryptedMimeMsg).to.contain('Content-Type: application/pdf; name=small.pdf\r\n' + 'Content-Disposition: attachment; filename=small.pdf');
  expect(decryptedMimeMsg).to.contain(
    'Content-Transfer-Encoding: base64\r\n\r\n' + 'JVBERi0xLjQKJcOkw7zDtsOfCjIgMCBvYmoKPDwvTGVuZ3RoIDMgMCBSL0ZpbHRlci9GbGF0ZURl'
  );
  const response = {
    // this url is required for pubkey encrypted message
    url: `http://${fesUrl}/message/FES-MOCK-MESSAGE-ID`,
    externalId: 'FES-MOCK-EXTERNAL-ID',
    emailToExternalIdAndUrl: {} as { [email: string]: { url: string; externalId: string } },
  };
  response.emailToExternalIdAndUrl['to@example.com'] = {
    url: `http://${fesUrl}/message/FES-MOCK-MESSAGE-FOR-TO@EXAMPLE.COM-ID`,
    externalId: 'FES-MOCK-EXTERNAL-FOR-TO@EXAMPLE.COM-ID',
  };
  response.emailToExternalIdAndUrl['sender@domain.com'] = {
    url: `http://${fesUrl}/message/FES-MOCK-MESSAGE-FOR-SENDER@DOMAIN.COM-ID`,
    externalId: 'FES-MOCK-EXTERNAL-FOR-SENDER@DOMAIN.COM-ID',
  };
  response.emailToExternalIdAndUrl['flowcrypt.compatibility@gmail.com'] = {
    url: `http://${fesUrl}/message/FES-MOCK-MESSAGE-FOR-FLOWCRYPT.COMPATIBILITY@GMAIL.COM-ID`,
    externalId: 'FES-MOCK-EXTERNAL-FOR-FLOWCRYPT.COMPATIBILITY@GMAIL.COM-ID',
  };
  response.emailToExternalIdAndUrl['mock.only.pubkey@flowcrypt.com'] = {
    url: `http://${fesUrl}/message/FES-MOCK-MESSAGE-FOR-MOCK.ONLY.PUBKEY@FLOWCRYPT.COM-ID`,
    externalId: 'FES-MOCK-EXTERNAL-FOR-MOCK.ONLY.PUBKEY@FLOWCRYPT.COM-ID',
  };
  return response;
};

export const processMessageFromUser3 = async (body: string, fesUrl: string) => {
  expect(body).to.contain('-----BEGIN PGP MESSAGE-----');
  expect(body).to.contain('"associateReplyToken":"mock-fes-reply-token"');
  expect(body).to.contain('"to":["to@example.com"]');
  expect(body).to.contain('"cc":[]');
  expect(body).to.contain('"bcc":["flowcrypt.compatibility@gmail.com"]');
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const encryptedData = body.match(/-----BEGIN PGP MESSAGE-----.*-----END PGP MESSAGE-----/s)![0];
  const decrypted = await MsgUtil.decryptMessage({
    kisWithPp: [],
    msgPwd: 'gO0d-pwd',
    encryptedData,
    verificationPubs: [],
  });
  expect(decrypted.success).to.equal(true);
  const decryptedMimeMsg = decrypted.content?.toUtfStr();
  // small.txt
  expect(decryptedMimeMsg).to.contain(
    'Content-Type: text/plain\r\n' + 'Content-Transfer-Encoding: quoted-printable\r\n\r\n' + 'PWD encrypted message with FES - pubkey recipient in bcc'
  );
  const response = {
    // this url is required for pubkey encrypted message
    url: `http://${fesUrl}/message/FES-MOCK-MESSAGE-ID`,
    externalId: 'FES-MOCK-EXTERNAL-ID',
    emailToExternalIdAndUrl: {} as { [email: string]: { url: string; externalId: string } },
  };
  response.emailToExternalIdAndUrl['to@example.com'] = {
    url: `http://${fesUrl}/message/FES-MOCK-MESSAGE-FOR-TO@EXAMPLE.COM-ID`,
    externalId: 'FES-MOCK-EXTERNAL-FOR-TO@EXAMPLE.COM-ID',
  };
  response.emailToExternalIdAndUrl['flowcrypt.compatibility@gmail.com'] = {
    url: `http://${fesUrl}/message/FES-MOCK-MESSAGE-FOR-FLOWCRYPT.COMPATIBILITY@GMAIL.COM-ID`,
    externalId: 'FES-MOCK-EXTERNAL-FOR-FLOWCRYPT.COMPATIBILITY@GMAIL.COM-ID',
  };
  return response;
};

export const processMessageFromUser4 = async (body: string, fesUrl: string) => {
  const response = {
    // this url is required for pubkey encrypted message
    url: `http://${fesUrl}/message/FES-MOCK-MESSAGE-ID`,
    externalId: 'FES-MOCK-EXTERNAL-ID',
    emailToExternalIdAndUrl: {} as { [email: string]: { url: string; externalId: string } },
  };
  if (body.includes('to@example.com')) {
    response.emailToExternalIdAndUrl['to@example.com'] = {
      url: `http://${fesUrl}/message/FES-MOCK-MESSAGE-FOR-TO@EXAMPLE.COM-ID`,
      externalId: 'FES-MOCK-EXTERNAL-FOR-TO@EXAMPLE.COM-ID',
    };
  }
  if (body.includes('invalid@example.com')) {
    response.emailToExternalIdAndUrl['invalid@example.com'] = {
      url: `http://${fesUrl}/message/FES-MOCK-MESSAGE-FOR-INVALID@EXAMPLE.COM-ID`,
      externalId: 'FES-MOCK-EXTERNAL-FOR-INVALID@EXAMPLE.COM-ID',
    };
  }
  if (body.includes('timeout@example.com')) {
    response.emailToExternalIdAndUrl['timeout@example.com'] = {
      url: `http://${fesUrl}/message/FES-MOCK-MESSAGE-FOR-TIMEOUT@EXAMPLE.COM-ID`,
      externalId: 'FES-MOCK-EXTERNAL-FOR-TIMEOUT@EXAMPLE.COM-ID',
    };
  }
  if (body.includes('Mr Cc <cc@example.com>')) {
    response.emailToExternalIdAndUrl['cc@example.com'] = {
      url: `http://${fesUrl}/message/FES-MOCK-MESSAGE-FOR-CC@EXAMPLE.COM-ID`,
      externalId: 'FES-MOCK-EXTERNAL-FOR-CC@EXAMPLE.COM-ID',
    };
  }
  if (body.includes('First Last <flowcrypt.compatibility@gmail.com>')) {
    response.emailToExternalIdAndUrl['flowcrypt.compatibility@gmail.com'] = {
      url: `http://${fesUrl}/message/FES-MOCK-MESSAGE-FOR-FLOWCRYPT.COMPATIBILITY@GMAIL.COM-ID`,
      externalId: 'FES-MOCK-EXTERNAL-FOR-FLOWCRYPT.COMPATIBILITY@GMAIL.COM-ID',
    };
  }
  if (body.includes('gatewayfailure@example.com')) {
    response.emailToExternalIdAndUrl['gatewayfailure@example.com'] = {
      url: `http://${fesUrl}/message/FES-MOCK-MESSAGE-FOR-GATEWAYFAILURE@EXAMPLE.COM-ID`,
      externalId: 'FES-MOCK-EXTERNAL-FOR-GATEWAYFAILURE@EXAMPLE.COM-ID',
    };
  }
  return response;
};
