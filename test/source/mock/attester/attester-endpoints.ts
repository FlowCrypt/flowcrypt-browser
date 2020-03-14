/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { HttpClientErr } from '../lib/api';
import { Dict } from '../../core/common';
import { HandlersDefinition } from '../all-apis-mock';
import { isPost, isGet } from '../lib/mock-util';
import { oauth } from '../lib/oauth';
import { expect } from 'chai';

// tslint:disable:no-blank-lines-func

const knownMockEmails = [
  'test.ci.compose@org.flowcrypt.com',
  'flowcrypt.compatibility@gmail.com',
  'human@flowcrypt.com',
  'flowcrypt.test.key.new.manual@gmail.com',
  'flowcrypt.test.key.used.pgp@gmail.com',
  'flowcrypt.test.key.recovered@gmail.com',
];

export const mockAttesterEndpoints: HandlersDefinition = {
  '/attester/pub/?': async ({ body }, req) => {
    const emailOrLongid = req.url!.split('/').pop()!.toLowerCase().trim();
    if (isGet(req)) {
      if (knownMockEmails.includes(emailOrLongid)) {
        // the client does not yet check that the pubkey contains the right uids
        // once it starts checking that, we'll have to be more specific with the pubkeys
        return somePubkey;
      }
      if (emailOrLongid === 'expired.on.attester@domain.com') {
        return expiredPubkey;
      }
      if (emailOrLongid === 'flowcrypt.compatibility@protonmail.com') {
        return protonMailCompatKey;
      }
      if (emailOrLongid.startsWith('martin@p')) {
        return mpVerificationKey;
      }
      throw new HttpClientErr('Pubkey not found', 404);
    } else if (isPost(req)) {
      oauth.checkAuthorizationHeaderWithIdToken(req.headers.authorization);
      expect(body).to.contain('-----BEGIN PGP PUBLIC KEY BLOCK-----');
      return 'Saved'; // 200 OK
    } else {
      throw new HttpClientErr(`Not implemented: ${req.method}`);
    }
  },
  '/attester/initial/legacy_submit': async ({ body }, req) => {
    if (!isPost(req)) {
      throw new HttpClientErr(`Wrong method: ${req.method}`);
    }
    const { email, pubkey } = body as Dict<string>;
    expect(email).to.contain('@');
    expect(pubkey).to.contain('-----BEGIN PGP PUBLIC KEY BLOCK-----');
    if (email === 'no.pub@org-rules-test.flowcrypt.com') {
      throw new HttpClientErr(`Could not find LDAP pubkey on a LDAP-only domain for email ${email} on server keys.flowcrypt.com`);
    }
    return JSON.stringify({ saved: true });
  },
  '/attester/test/welcome': async ({ body }, req) => {
    if (!isPost(req)) {
      throw new HttpClientErr(`Wrong method: ${req.method}`);
    }
    const { email, pubkey } = body as Dict<string>;
    expect(email).to.contain('@');
    expect(pubkey).to.contain('-----BEGIN PGP PUBLIC KEY BLOCK-----');
    return JSON.stringify({ sent: true });
  },
};

const somePubkey = `-----BEGIN PGP PUBLIC KEY BLOCK-----
Version: CryptUP 3.2.0 Easy Gmail Encryption https://cryptup.org
Comment: Seamlessly send, receive and search encrypted email

xsBNBFU0WMgBCACZSzijeN4YozhjmHU7BGWzW7ZbY6GGtJinByt8OnEnQ9TX
9zrAxbyr0grPE4On7nd3uepwNxJbk5LlaCwHNkpX39xKgDgCskRO9CfeqOIO
4l5Wjj4XldrgLSOGJe8Vmimo9UKmqsP5v8fR3mMyIqQbtE4G+Vq/J9A3uabr
f0XYVsBdBvVoJkQ83gtQrZoTA/zihNmtLXH9pTwtX8FJcqgFK6RgvfAh2jCz
DhT+reI50ZcuHRvVRxvrL172DFSQsLSdj8PcewS1J89knH4sjjBC/kwbLa0n
tod/gBPWw/uetaOJna43wNueUKKOl2kAXE4sw6ESIrlFDynJ4g05T9yxABEB
AAHNIlRvbSBKYW1lcyBIb2x1YiA8dG9tQGJpdG9hc2lzLm5ldD7CwFwEEAEI
ABAFAlU0WM8JEA1WiOvzECvnAAAB4gf8DaIzZACUqkGEoI19HyBPtcrJT4mx
hKZ/Wts0C6TGj/OQXevDI+h2jQTYf8+fOqCdQev2Kwh/8mQV6wQqmN9uiVXO
5F4vAbWNfEve6mCVB5gi296mFf6kx04xC7VVYAJ3FUR72BplE/0+cwv9Nx2r
Jh3QGFhoPaFMPtCAk0TgKcO0UkcBwXNzAV5Pgz0MT1COTWBXEej4yOrqdWoP
A6fEpV8aLaFnAt+zh3cw4A7SNAO9omGAUZeBl4Pz1IlN2lC2grc2zpqoxo8o
3W49JYTfExeCNVWhlSU74f6bpN6CMdSdrh5phOr+ffQQhEhkNblUgSZe6tKa
VFI1MhkJ6Xhrug==
=+de8
-----END PGP PUBLIC KEY BLOCK-----`;

const expiredPubkey = `-----BEGIN PGP PUBLIC KEY BLOCK-----

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
wLiixN34mx9HOoCOwcFxC4+X6VVwVWQ=
=4FOH
-----END PGP PUBLIC KEY BLOCK-----`;

const protonMailCompatKey = `-----BEGIN PGP PUBLIC KEY BLOCK-----
Version: OpenPGP.js v3.0.5
Comment: https://openpgpjs.org

xsBNBFskt/ABCAD0N+Y+ZavNGwRif9vkjcHxmvWkkqBO+pA1KanPUftoi2b/
zMErfl+4P6xe+KpDS97W/BqBGKP7bzN08XSkqyROhv/lroofXgu1WSJ53znf
bRGiRmOjIntBX7iSKecSh9zcgjBRK6xnhoaXxUhCwp8ZsxapMRSwQmlXU6WQ
4XAI4JhtZVpBUtbeUW0/+4KRObmj9Dy+4nnNFFBubBrHV0F7FmkJkvksvkNL
4awmTFbfPE8vkapoDi1hFzMbWoYvEPLmv/HTRcqjPZASLr7fXG+AOefE8uJA
L++Zs0jw2ukrk9KHk3q70ii61CUz9zODCXzeoWQMNTUHoZFuhzawCFe1ABEB
AAHNT2Zsb3djcnlwdC5jb21wYXRpYmlsaXR5QHByb3Rvbm1haWwuY29tIDxm
bG93Y3J5cHQuY29tcGF0aWJpbGl0eUBwcm90b25tYWlsLmNvbT7CwHUEEAEI
ACkFAlskt/EGCwkHCAMCCRB+1D156WF2VQQVCAoCAxYCAQIZAQIbAwIeAQAA
2hYIANsYeRHhz5odpXWbeLc//Ex90llhgWb/kWWW5O5/mQwrOt+4Ct0ZL45J
GeXCQyirHiYhmA50BoDDfayqULDx17v6easDmfdZ2qkVxczc+TjF0VMI+Y/3
GrPuVddzBomc7qqYmEOkKEcnz4Q7mX5Ti1ImY8SSVPOchIbOQUFa96VhZJAq
Xyx+TIzalFQ0F8O1Xmcj2WuklBKAgR4LIX6RrESDcxrozYLZ+ggbFYtf2RBA
tEhsGyA3cJe0d/34jlhs9yxXpKsXGkfVd6atfHVoS7XlJyvZe8nZgUGtCaDf
h5kJ+ByNPQwhTIoK9zWIn1p6UXad34o4J2I1EM9LY4OuONvOwE0EWyS38AEI
ALh5KJNcXr0SSE3qZ7RokjsHl+Oi0YZBiHg0HBZsliIwMBLbR007aSSIAmLa
fJyZ0cD/BmQxHguluaTomfno3GYrjyM86ETz+C0YJJ441Fcji/0fFr8JexXf
eX4GEIVxQd4L0tB7VAAKMIGv/VAfLBpKjfY32LbgiVqVvgkxBtNNGXCaLXNa
3l6l3/xo6hd4/JFIlaVTEb8yI578NF5nZSYG5IlF96xX7kNKj2aKXvdppRDc
RG+nfmDsH9pN3bK4vmfnkI1FwUciKhbiwuDPjDtzBq6lQC4kP89DvLrdU7PH
n2PQxiJyxgjqBUB8eziKp63BMTCIUP5EUHfIV+cU0P0AEQEAAcLAXwQYAQgA
EwUCWyS38QkQftQ9eelhdlUCGwwAAKLKB/94R0jjyKfMGe6QY5hKnlMCNVdD
NqCl3qr67XXCnTuwnwR50Ideh+d2R4gHuu/+7nPo2juCkakZ6rSZA8bnWNiT
z6MOL1b54Jokoi1MreuyA7mOqlpjhTGbyJewFhUI8ybGlFWCudajobY2liF6
AdeK17uMFfR6I1Rid3Qftszqg4FNExTOPHFZIc8CiGgWCye8NKcVqeuVlXKw
257TmI5YAxZAyzhc7iX/Ngv6ZoR18JwKvLP1TfTJxFCG5APb5OSlQmwG747I
EexnUn1E1mOjFwiYOZavCLvJRtazGCreO0FkWtrrtoa+5F2fbKUIVNGg44fG
7aGdFze6mNyI/fMU
=D34s
-----END PGP PUBLIC KEY BLOCK-----`;

const mpVerificationKey = `-----BEGIN PGP PUBLIC KEY BLOCK-----
Version: SKS 1.1.6
Comment: Hostname: keyserver.ubuntu.com

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
D+QpnsOtKCqDWiq6s1l0UasWPk7xv6awH29H
=EpXD
-----END PGP PUBLIC KEY BLOCK-----`;