/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { HttpClientErr } from '../lib/api';
import { Dict } from '../../core/common';
import { HandlersDefinition } from '../all-apis-mock';
import { isPost, isGet } from '../lib/mock-util';
import { oauth } from '../lib/oauth';
import { expect } from 'chai';
import { GoogleData } from '../google/google-data';
import { Buf } from '../../core/buf';
import { pubkey2864E326A5BE488A } from '../../tests/tooling/consts';

// tslint:disable:no-blank-lines-func

const knownMockEmails = [
  'ci.tests.gmail@flowcrypt.dev',
  'flowcrypt.compatibility@gmail.com',
  'human@flowcrypt.com',
  'flowcrypt.test.key.new.manual@gmail.com',
  'flowcrypt.test.key.used.pgp@gmail.com',
  'flowcrypt.test.key.recovered@gmail.com',
];

let data: GoogleData;

const getDC26454AFB71D18EABBAD73D1C7E6D3C5563A941 = () => {
  if (!data) {
    data = new GoogleData('flowcrypt.compatibility@gmail.com');
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
        return getDC26454AFB71D18EABBAD73D1C7E6D3C5563A941();
      }
      if (['sams50sams50sept@gmail.com', 'president@forged.com', '2864E326A5BE488A'.toLowerCase()].includes(emailOrLongid)) {
        return pubkey2864E326A5BE488A;
      }
      if (emailOrLongid.startsWith('martin@p')) {
        return mpVerificationKey;
      }
      if (emailOrLongid === 'sha1@sign.com') {
        return sha1signpubkey;
      }
      if (emailOrLongid === '6D3E09867544EE627F2E928FBEE3A42D9A9C8AC9'.toLowerCase()) { // newer version of expired pubkey
        return newerVersionOfExpiredPubkey;
      }
      if (emailOrLongid === '8EC78F043CEB022498AFD4771E62ED6D15A25921'.toLowerCase()) { // older version of expired pubkey
        return olderVersionOfExpiredPubkey;
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

xsBNBGAK/6UBCACvfHTa45uTNUM3LPl34zWM3wZB6om5TCXxdKbuy+32UftwqUOLJLXrCm7LPMEk
fScXjXzHuyfXjyrqnvHygHsbxNk0+klrOTA92EGrxpQEBIXV3E1344RDjRYZRp3IFbObWjuT+Uap
xH/J65dVyYfmknaDCreRxtChrYmKVSKu9ppBH/2WAsbeOR+wXmfLrz/64qORno8duVht8HrtpZGj
Em1XgEj0tZAmEEMy+VQ9g2QF+srDSpeVyELTlr88tkoqZDsmv0eNbiPQ6SUDf7hpAA/iir2C/94O
OQ8S3KuZ7yFNDYzcMJj/eICrNQ8l/sGgo6X4suETpjDPUDuFWL/nABEBAAHNHmV4cGlyZWQub24u
YXR0ZXN0ZXJAZG9tYWluLmNvbcLAjwQTAQgAORYhBCoWqTKGQ25ClvnHLRl/tn5K4WvNBQJgCv+q
BQkAAAABAhsDBQsJCAcCBhUICQoLAgUWAgMBAAAKCRAZf7Z+SuFrzXheB/4ncNK5u+Jc7/+PvsbA
GS00gU6UfizRa7gWYYLz5nW+vQKfKaghnUWX7rnODU3KFTcohjVOLHICzZI3A49YPhkRRCCtzTSU
drevojTSebdPM+PvxSGzAY+7jnzAAx6lrQBn8pUFNuMulVQ/xQbyIylSftF4/N/RNBYD7lAqkr5m
uZ3C9QnIPqfhAS2r0XkajKLb2Gj7uB8zkLGRcwH9l2pvVi5RfwHjswxHoqxsNR1woeD0q1G7SmHM
UxMZPOE6wkbyGuxi9xBXOFqbSVIApLu0F4aV0JqmKoiXB3+bsUm1fiajs0KP+tj/EwaoXhBOa48N
TNxXKHTaJeGvkdNEWZb7zsBNBGAK/6oBCADCa5DFIGwmELhFdqaRkGdoLKP7vYc8HM1UdlbeD+2l
3PoYCW8+iqaDaKdS1f0n8XkqVIuVRQtSw5IlNCQE5Dm/J+grL/+TpMDygn1juPWaBnNMLdIaqqKi
kJKxrWJwvXQNEhqHkDhQLku61b6H9FYuYMWPpdLBUj9FPpfdMr//pPzVwrAvS3vLLZDXw/xDh/RO
K0iuO8X6b9m743+7XJXoe05Gvi1EMU1dJJfoG0V5/i071wuL41bJcsBfp8hIlc5tFIwrTOWmqNBZ
68XyU/FQlbw1meOOiAfZ8Nn8wn/YErVMegKHS2xLsCmFHmyNbfWeTvrt7wA1Q+tMi93HtCG1ABEB
AAHCwHwEGAEIACYWIQQqFqkyhkNuQpb5xy0Zf7Z+SuFrzQUCYAr/rwUJAAAAAQIbDAAKCRAZf7Z+
SuFrzYgqB/9XmbEuewavXgySyqA0MyEBbkcFCuWptq+BD02h81IJfX5mJa3BFrVDTbhJz65fkCDf
06muDaY9CnDCJCBfWft9iyLYBfTwhwwnTfKEl/3emfzHIy3TBrVJFY/6lN8/eO1ZtZNlqna0HopJ
9yOTlffA1HcIWzgdCa9PrLH/hGyH3ZD5AhrLDd1Fnk46bswvbx3SfY49JQzEIh1RSQhxXfIyk6Qe
uNF3ucHu8SIcpfNG1/pNuI1eG40VkHP7CD/aH0sHj6jY6rzV7gCaLuyuJoB1YVfq5PUoHgIwvDQ/
a8rIPGFSHj4vKpBRYZmAOYAB68WkJlo0ppztrnxg2/JTcume
=6gv9
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

const olderVersionOfExpiredPubkey = `-----BEGIN PGP PUBLIC KEY BLOCK-----
Version: FlowCrypt Email Encryption 7.8.4
Comment: Seamlessly send and receive encrypted email

xsBNBF8QJFgBCACdPi2i6uflsgNVvSw20eVaqOwEgwRAu1wrwB+s3UxFxsnE
XBiJ6tvQU+NzNFLWjT5FwyTz8PM2lDnXz/j6nQGft+l/01l349u0L4WhTEES
ByPTOA1Wbs4YRbef1+T6tKklN8CKH93tBKRFTZXsMv0nLuEMmyxNgYHvNsnB
GXlGQrrsJ5qVr10YZh+dXo8Ir4mXXE5tCrVH/AzDBK/cBZcUbBD7gmvnt+HF
vuJYMRQ46/NR84S57Dwm5ZzER0PMQfnLYyjdKE4DEVtL84WVhGVqNhBqy1Z6
l/wvSHnBvrXe1Vdm2YXT0pIahe9wJmrA2dixA8c+SczICn+QZAkBsAZRABEB
AAHNKTxoYXMub2xkZXIua2V5Lm9uLmF0dGVzdGVyQHJlY2lwaWVudC5jb20+
wsCTBBABCAAmBQJfECRYBQkAAAACBgsJBwgDAgQVCAoCBBYCAQACGQECGwMC
HgEAIQkQHmLtbRWiWSEWIQSOx48EPOsCJJiv1HceYu1tFaJZIQewCACYWDJ5
3sbGDvIwRlPiAQqTp4IvjrvLC+unX4OVyaqXPcTbCWkjjUcZci2aO5V59J+I
fHkI7PVwheuEk4HjNBiPvSOy8BbwiGXYxkQX4Z4QZkcf6wCvd3rtwyICzhNh
jsehA4uaYStr0k0pxzHMWhpDeppzVL+yVnCoftiW9+9MuTFQ2ynQhBYp57yA
6LGn9X91L7ACZvWMstBwTNkT2N2Vw7ngCnacweIj0LMje2wt6cKO1IMm0U4Q
Ekag9pqTf1DnyC/dkw7GB6kT5lP9wAdZNxtIgJwHQNidH+0gfJlTQ31LQp5T
jFa6LU+7XK8sprZG27TjQX9w7NVyYbkib3mGzsBNBF8QJFgBCACnVXFdNoKA
THN6W7ewu8CDaDEOxrUGckrTFSOLN0hkLrlrHRZg4/N0gZf/TdUynGJ6fkXq
5ZDZWiPujAyjeTHhoUb3Oc0O9voX3TLRROduDxW6UAeurzXAiL/25qOp1TRr
Fhvllleg+fcZDNjPct4zyUxUW6NzWkHJ+XvNxq2fTH82n0RfPTyRoee/ymuR
exRU4vfYF8XNo+aEDx00rwQFpl8ot20Qus6vKejo0SIyr0bS4oHBB3sYHrxt
kfHLwiSfE27eW2pogta6JcH7w+OLGadoGxqGs1cYpbVhteDRUQ4nTov3JWt5
VoNlXiaBdV3vRF52Q+UuUwylsbcplDeDABEBAAHCwHwEGAEIAA8FAl8QJFgF
CQAAAAICGwwAIQkQHmLtbRWiWSEWIQSOx48EPOsCJJiv1HceYu1tFaJZIcYi
B/wNq0UOV3d1aaFtx2ie2CYX5f7o9/emyN7HomW53DBXSAlj98R0MnKrUadU
oIXkUnJlGIyU9NjzWWZsdPMrlaU/tCvceO/wvc2K/pqjiQKjtfiA/mR+0dGf
cVskq2WOiAfEuOcTAdrYmLeTs5r6RJueTb3qxUN7a9OWru+avuyJ7lDiOiNC
MnhQ8xZy1zREApD1weSz9JEUOTkcNYFm/dm08g0QfKneqi5/ZvNmRlKNW/Nf
9DCM/jCp1Nb33yNTC9n3HW8qMOd4pPfajDEtGivqi5aQGaZ+AbT6RTR4jD8q
7GiOeV7wDbZXG0MYLM9kqW7znnDTAGHWvTw+HanlU23+
=KVqr
-----END PGP PUBLIC KEY BLOCK-----`;

const sha1signpubkey = `-----BEGIN PGP PUBLIC KEY BLOCK-----
Version: GnuPG v2.0.19 (GNU/Linux)

mI0EUmEvTgEEANyWtQQMOybQ9JltDqmaX0WnNPJeLILIM36sw6zL0nfTQ5zXSS3+
fIF6P29lJFxpblWk02PSID5zX/DYU9/zjM2xPO8Oa4xo0cVTOTLj++Ri5mtr//f5
GLsIXxFrBJhD/ghFsL3Op0GXOeLJ9A5bsOn8th7x6JucNKuaRB6bQbSPABEBAAG0
JFRlc3QgTWNUZXN0aW5ndG9uIDx0ZXN0QGV4YW1wbGUuY29tPoi5BBMBAgAjBQJS
YS9OAhsvBwsJCAcDAgEGFQgCCQoLBBYCAwECHgECF4AACgkQSmNhOk1uQJQwDAP6
AgrTyqkRlJVqz2pb46TfbDM2TDF7o9CBnBzIGoxBhlRwpqALz7z2kxBDmwpQa+ki
Bq3jZN/UosY9y8bhwMAlnrDY9jP1gdCo+H0sD48CdXybblNwaYpwqC8VSpDdTndf
9j2wE/weihGp/DAdy/2kyBCaiOY1sjhUfJ1GogF49rC4jQRSYS9OAQQA6R/PtBFa
JaT4jq10yqASk4sqwVMsc6HcifM5lSdxzExFP74naUMMyEsKHP53QxTF0Grqusag
Qg/ZtgT0CN1HUM152y7ACOdp1giKjpMzOTQClqCoclyvWOFB+L/SwGEIJf7LSCEr
woBuJifJc8xAVr0XX0JthoW+uP91eTQ3XpsAEQEAAYkBPQQYAQIACQUCUmEvTgIb
LgCoCRBKY2E6TW5AlJ0gBBkBAgAGBQJSYS9OAAoJEOCE90RsICyXuqIEANmmiRCA
SF7YK7PvFkieJNwzeK0V3F2lGX+uu6Y3Q/Zxdtwc4xR+me/CSBmsURyXTO29OWhP
GLszPH9zSJU9BdDi6v0yNprmFPX/1Ng0Abn/sCkwetvjxC1YIvTLFwtUL/7v6NS2
bZpsUxRTg9+cSrMWWSNjiY9qUKajm1tuzPDZXAUEAMNmAN3xXN/Kjyvj2OK2ck0X
W748sl/tc3qiKPMJ+0AkMF7Pjhmh9nxqE9+QCEl7qinFqqBLjuzgUhBU4QlwX1GD
AtNTq6ihLMD5v1d82ZC7tNatdlDMGWnIdvEMCv2GZcuIqDQ9rXWs49e7tq1NncLY
hz3tYjKhoFTKEIq3y3Pp
=h/aX
-----END PGP PUBLIC KEY BLOCK-----`;
