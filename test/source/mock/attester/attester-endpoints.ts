/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { HttpClientErr } from '../lib/api';
import { Dict } from '../../core/common';
import { HandlersDefinition } from '../all-apis-mock';
import { isPost, isGet } from '../lib/mock-util';
import { oauth } from '../lib/oauth';
import { expect } from 'chai';
import { GoogleData } from '../google/google-data';
import { Buf } from '../../core/buf';
import { testConstants } from '../../tests/tooling/consts';

// tslint:disable:no-blank-lines-func

const knownMockEmails = [
  'ci.tests.gmail@flowcrypt.test',
  'flowcrypt.compatibility@gmail.com',
  'human@flowcrypt.com',
  'flowcrypt.test.key.new.manual@gmail.com',
  'flowcrypt.test.key.used.pgp@gmail.com',
  'flowcrypt.test.key.recovered@gmail.com',
];

let data: GoogleData;
export const MOCK_ATTESTER_LAST_INSERTED_PUB: { [email: string]: string } = {};

const getDC26454AFB71D18EABBAD73D1C7E6D3C5563A941 = async () => {
  if (!data) {
    data = await GoogleData.withInitializedData('flowcrypt.compatibility@gmail.com');
  }

  const msg = data.getMessage('1754cfc37886899e')!;
  const msgText = Buf.fromBase64Str(msg!.raw!).toUtfStr();
  const dhartleyPubkey = msgText
    .match(/\-\-\-\-\-BEGIN PGP PUBLIC KEY BLOCK\-\-\-\-\-.*\-\-\-\-\-END PGP PUBLIC KEY BLOCK\-\-\-\-\-/s)![0]
    .replace(/=\r\n/g, '').replace(/=3D/g, '=');

  return dhartleyPubkey;
};

export const mockAttesterEndpoints: HandlersDefinition = {
  '/attester/pub/?': async ({ body }, req) => {
    const emailOrLongid = req.url!.split('/').pop()!.toLowerCase().trim();
    if (isGet(req)) {
      if (knownMockEmails.includes(emailOrLongid)) {
        // the client does not yet check that the pubkey contains the right uids
        // once it starts checking that, we'll have to be more specific with the pubkeys
        return somePubkey;
      }
      if (emailOrLongid === 'mock.only.pubkey@flowcrypt.com') {
        return somePubkey;
      }
      if (emailOrLongid === 'mock.only.pubkey@other.com') {
        return somePubkey;
      }
      if (emailOrLongid === 'expired.on.attester@domain.com') {
        return expiredPubkey;
      }
      if (emailOrLongid === 'flowcrypt.compatibility@protonmail.com') {
        return protonMailCompatKey;
      }
      if (['dhartley@verdoncollege.school.nz', '1C7E6D3C5563A941'.toLowerCase()].includes(emailOrLongid)) {
        return await getDC26454AFB71D18EABBAD73D1C7E6D3C5563A941();
      }
      if (['sams50sams50sept@gmail.com', 'sender@example.com'].includes(emailOrLongid)) {
        return testConstants.pubkey2864E326A5BE488A;
      }
      if (emailOrLongid.startsWith('martin@p')) {
        return mpVerificationKey;
      }
      if (emailOrLongid === 'sha1@sign.com') {
        return sha1signpubkey;
      }
      if (emailOrLongid === 'auto.refresh.expired.key@recipient.com') { // newer version of expired pubkey
        return newerVersionOfExpiredPubkey;
      }
      if (emailOrLongid === '8EC78F043CEB022498AFD4771E62ED6D15A25921'.toLowerCase()) {
        return testConstants.oldHasOlderKeyOnAttester;
      }
      throw new HttpClientErr('Pubkey not found', 404);
    } else if (isPost(req)) {
      oauth.checkAuthorizationHeaderWithIdToken(req.headers.authorization);
      expect(body).to.contain('-----BEGIN PGP PUBLIC KEY BLOCK-----');
      MOCK_ATTESTER_LAST_INSERTED_PUB[emailOrLongid] = body as string;
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
    if (email === 'no.pub@org-rules-test.flowcrypt.test') {
      throw new HttpClientErr(`Could not find LDAP pubkey on a LDAP-only domain for email ${email} on server keys.flowcrypt.test`);
    }
    MOCK_ATTESTER_LAST_INSERTED_PUB[email] = pubkey;
    return { saved: true };
  },
  '/attester/test/welcome': async ({ body }, req) => {
    if (!isPost(req)) {
      throw new HttpClientErr(`Wrong method: ${req.method}`);
    }
    const { email, pubkey } = body as Dict<string>;
    expect(email).to.contain('@');
    expect(pubkey).to.contain('-----BEGIN PGP PUBLIC KEY BLOCK-----');
    return { sent: true };
  },
};

export const somePubkey = `-----BEGIN PGP PUBLIC KEY BLOCK-----
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

xsBNBGANSYYBCACkVfVUKS9ura0KSiRu6i4bC0mEpwOjuYotor1d1NciysN977UMKQw1uux0GIZz
3PvJUL4Ij77eyF5wxOueOwqON/LHunqnufvES9zj2BgQLwfE5d7gXp0IjQqWEg4YfSkTNIwzP67R
qDbvW4E7XScLY1BYutrZhq53rzXurON9eftFi2ScW4/Pja2eCah5bMxFqoINRGFYJwK6Z6rD1h2+
/w5s9Ir+qELUKxIYtwfp2Uf3uTDnT4BRFPcuNh9rXLPpXprTjGe2cZ6i9ENzMj0dTlU8kqvTyhPm
BReZZZcUe5teVyfbLXmz/nQCnxnuH/e8LDeQ5TC6knTFd8d9gTI7ABEBAAHNHmV4cGlyZWQub24u
YXR0ZXN0ZXJAZG9tYWluLmNvbcLAjwQTAQgAORYhBBr54+QEmYDLPhttjC90yktngnCgBQJgDUmL
BQkAAAA8AhsDBQsJCAcCBhUICQoLAgUWAgMBAAAKCRAvdMpLZ4JwoLb0B/0cFAn266wKMNSq556G
ldLCLDpPrMaKy6r3qsiG/Y3otvnn+iBLqkuEo7P9XmfQooiplpUxLnmiBmGxlVmUcNMBh15Z7GXP
cj4fas++H1sjAbF6mPqhggIsxGcnk9YjbZC+GaDzKp5BKgDUUIitsYzSENdADqeL6SQixSMWAiGA
CiOQ8mnriH/CGb1XW76YVjYa5fK2OqflQj+l5IiJ4gqWuHpYs5zR24tnxIiv5UtvxglahV8Tugdf
KfjnkfYbJEwxyUGzXNtmqhsrhoSWaYbrqjRqNolnFP6hr5NlVVNA9XNWLhWd0HdhzgJWYvd+ukLE
eTY/IvQlyIVMV9nqQqOVzsBNBGANSYwBCADFzPusdjjO0zcI/7sfgUHk/XmPawR6WIhzTHaM38Pg
1woaXZt0oSU6K2OSKwYRnuVGM0zbjhhICPhtAo3m26h4LojPlM1Dnp+U/p9hXVFa7MPtlUupfhZt
9Ip4nNLWyYhQrSAI73InVtJvYQbQU/t7or+twrXZJqAPIqMBQ+pkYab8+bOfdY+/QoHM7SKyvggg
6E+4fw9IwwaoZpxcbc2Wbcn1LpaF2xZUq0kWxtQ86b6rMQWbNgfs4xVUKAeP74SINM5iYDV4qjD0
KTTzAmn/rlBbvwP2r7SX1gmismLJYDJCpZrYdJEMOMhfXBQaz+0rlHIT6YIyr1mpLecJzIXRABEB
AAHCwHwEGAEIACYWIQQa+ePkBJmAyz4bbYwvdMpLZ4JwoAUCYA1JkQUJAAAAPAIbDAAKCRAvdMpL
Z4JwoGmXB/97g6/UkdVtBv5bP1V7JZpxEo31Q0S3dZR6pMVaEpVgtksSIcO2i9PdCZhYZ9noRkdO
BpSNkgVOzk6/WvpVBl8TZ7bpWa7ux6ExiJLKKjWSHnJJ3SkviARSrAmDfvDCxKh3duEmjsmBy/r0
ugFu0E2D/Oxqa6ZUv7swwx8kuq7/UchZLQQCiKCGosRqiApqhp2ze/CNzeD/na+q0yvT6pFFDjGl
82Yrr1oqCyZZedSFSLelVqBJ8FkyJlqN3J9Q3M5rEp5vcRqGOHxfO5j2Gb88mmmtnWnBzRPPX8CB
DDF85HtNOR10V1aJrfE7F6e3QTzu5SZBjDPi5vVcbtK72eyd
=o0Ib
-----END PGP PUBLIC KEY BLOCK-----
`;

export const protonMailCompatKey = `-----BEGIN PGP PUBLIC KEY BLOCK-----
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

const newerVersionOfExpiredPubkey = `-----BEGIN PGP PUBLIC KEY BLOCK-----
Version: FlowCrypt Email Encryption 7.8.4
Comment: Seamlessly send and receive encrypted email

xsBNBF8PcdUBCADi8no6T4Bd9Ny5COpbheBuPWEyDOedT2EVeaPrfutB1D8i
CP6Rf1cUvs/qNUX/O7HQHFpgFuW2uOY4OU5cvcrwmNpOxT3pPt2cavxJMdJo
fwEvloY3OfY7MCqdAj5VUcFGMhubfV810V2n5pf2FFUNTirksT6muhviMymy
uWZLdh0F4WxrXEon7k3y2dZ3mI4xsG+Djttb6hj3gNr8/zNQQnTmVjB0mmpO
FcGUQLTTTYMngvVMkz8/sh38trqkVGuf/M81gkbr1egnfKfGz/4NT3qQLjin
nA8In2cSFS/MipIV14gTfHQAICFIMsWuW/xkaXUqygvAnyFa2nAQdgELABEB
AAHNKDxhdXRvLnJlZnJlc2guZXhwaXJlZC5rZXlAcmVjaXBpZW50LmNvbT7C
wI0EEAEIACAFAl8Pc5cGCwkHCAMCBBUICgIEFgIBAAIZAQIbAwIeAQAhCRC+
46QtmpyKyRYhBG0+CYZ1RO5ify6Sj77jpC2anIrJ/awIAMVNZmNzQkWA9uZr
Rity+QME43ySC6p9cRx3o39apmOuVn6TOv/n9tfAlR/lYNZR80myhNi4xkQe
BpuTSJ8WAIw+9CIXrROV/YBdqvPXucYUZGjkAWzN6StQUfYP8nRm6+MebgLI
B/s+Lkr1d7wrDDF8rh7Ir9SkpXqr5FPTkDMsiFEbUR7oKpRoeI9zVtF375FB
ZJMUxm8YU+Tj1LAEullgrO9omHyMVqAVffZe6rH62c7L9ZR3C3/oG5rNcC/0
kIRsh0QGrq+kuZ6bsLFBhDLIjci8DH9yO1auceNy+Xa1U6scLb1ZZpVfV5R9
HWPy4QcNitDMoAtqVPYxPQYqRXXOwE0EXw9x1QEIALdJgAsQ0JnvLXwAKoOa
mmWlUQmracK89v1Yc4mFnImtHDHS3pGsbx3DbNGuiz5BhXCdoPDfgMxlGmJg
Shy9JAhrhWFXkvsjW/7aO4bM1wU486VPKXb7Av/dcrfHH0ASj4zj/TYAeubN
oxQtxHgyb13LVCW1kh4Oe6s0ac/hKtxogwEvNFY3x+4yfloHH0Ik9sbLGk0g
S03bPABDHMpYk346406f5TuP6UDzb9M90i2cFxbq26svyBzBZ0vYzfMRuNsm
6an0+B/wS6NLYBqsRyxwwCTdrhYS512yBzCHDYJJX0o3OJNe85/0TqEBO1pr
gkh3QMfw13/Oxq8PuMsyJpUAEQEAAcLAdgQYAQgACQUCXw9zlwIbDAAhCRC+
46QtmpyKyRYhBG0+CYZ1RO5ify6Sj77jpC2anIrJzogH/2sRLw/hL2asprWR
U78VdhG+oUKKoNYvLFMJ93jhIB805E87kDB1Cietxg1xTj/lt911oK6eyoe4
CekCU25WkxmsAh0NUKz/1D6wJ1uDyh2lkmgyX+Iz9RCjtDHnnuzM1It77z6F
lGemOmYh8ZLYxJmG6e3MqHelRH25TuPm6fB0TN7lRlleTl26/8aJDBCvp7N1
4AdIgRWhBCoByCNe8QuNiZ0Bb+TLOt0jVVder645fVWx+4te0tpHTbGn9e3c
nLDskCEyJFvADug883x3lswUqh65zLO22m/plVmJ7X++whhSsDyQQRFiH0Du
1uh93GjDDNgrP1GfAMeRjZ4V8R8=
=R9m4
-----END PGP PUBLIC KEY BLOCK-----
`;

const sha1signpubkey = `-----BEGIN PGP PUBLIC KEY BLOCK-----

xsBNBGANYRQBCADI3WP21Ut4L+g+qBBMk24cxsAX4N+FisqcxW7jhrqksH9Mi2vhpDFZyUCRe4d8
liXGTfiWnkp9qQIos8vnC6yPf9gNxsrjlccVVIiusoJB18KqsiKVBUiiqbNQwLUCACMA5PCALaBJ
1TRrTy5hWPCa8v+iyxTr2LaE7BcJCv1eGB3/vfsIt9zf2fsRga7FroJHSOdrxAPMu5rIU5iHwGPe
nFe2dSt8Y+dX5YKV7IBbjP7/Vp+/gV2HItaKmHFXP5FOtndPPCOtnIp6vUNZwA/o4K7tmiz6ZFp0
/Yn2DwUK0Nmmr+2v75FRnWqtelgACEDuGfrvYeJwAZIOmV0fr5yxABEBAAHNDXNoYTFAc2lnbi5j
b23CwIkEEwECADMWIQRXddqCmBkCxSCZ5qPIqyMsf2dexAUCYA1hGgIbAwULCQgHAgYVCAkKCwIF
FgIDAQAACgkQyKsjLH9nXsTM5AgAwWhDr2X9LY+7eJGyihkwXDCBZUvjF0hpY+8FYyxllfbW45pu
0bVs5T/EfnUYr+fOZuHdmhz4lNI2BPDwHhdQZpIqrrimD6jrypwcb500hwu5FKUBzw6U39QDuOSc
W6wIkiZ7hajTSTzniQRpbYZaKPrsFY40uZeQo6rAl71iuRsVvCjCazX8McOdGGP7oJCxtCpxaHoL
S2RcVu5/SWmEi8wHopDCKf/1UJphjJDeIHgdLwM6xMLrYBfbt6Fd2PYpJ17+ECs8Y9Q2v5nyXFaD
q+/Ri36rk3lz5YJGyB2AOFG+ma80SlOsCbA6j9Ky49tJZ1we6F368Lujrxnb+xMKY87ATQRgDWEa
AQgAqy0j+/GZvh4o7EabTtPKLOkVtQp/OV0ZGw6SKnhDB7pJhHKqgRduK4NYr1u+t575NI7EwgR3
7qoZkuvs/KmFizTxosCgL7WC6o5Groibc2XrL8mXbGDqWzKGllvKO+7gfkwx5qh0MoOXHWaavxE3
eXM6vvlATcjLkTjISiqzK/jSAmqB9J3GdqFafmtjqm/4Nfu1FGgpWi9JJxpv5aN8nILYksL/X+s8
ounYOz+OpUU+liv2wU3eRXP2/Qzc7Acdkrw5hRert9u+klHB3MckNUujVqq0mxB1yrPeJjqOBPCl
2n/wNLUoLqWbP/TW40MSFPAYdR/z+T67MDmRzVlewQARAQABwsB2BBgBAgAgFiEEV3XagpgZAsUg
meajyKsjLH9nXsQFAmANYR8CGwwACgkQyKsjLH9nXsSw8wf8CedMX61foCmCOEmKCscH+GcFKWwH
S4xlOPQZG4RXFla/VMvJrHqbxZ5vIID0GQ+t6kdhuD0ws9Y7DObFcSCxqPm8idkJUvC4kv1MSu+P
7NbWDS8t7e/b1EOu+aeIxqUhaQrJacWWiUn9tbobpld8GGlquLIteY9Ix2H/xjXnDvpB30v/fDNG
T/X6OnVQdcOI7SvdQI74SxbaHnEeCLDEk7dOhWLJBLuZwK7M3cT6BX+V2v6Fm7SX0hSpDg1HK0KL
qHJuDNEmMUvx3cMUd5HtsOFO9JapCp1iCVo2p49CIXA4NUrLETNM2ZddknhbFm8bsK48tTJEH6l4
Wq3aCVXYGg==
=Ldag
-----END PGP PUBLIC KEY BLOCK-----`;
