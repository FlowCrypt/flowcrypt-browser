/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */


import { HttpClientErr } from '../lib/api';
import { Dict } from '../../core/common';
import { HandlersDefinition } from '../all-apis-mock';
import { isPost, isGet } from '../lib/mock-util';
import { oauth } from '../lib/oauth';
import { expect } from 'chai';

const knownEmails = [
  'flowcrypt.compatibility@gmail.com',
  'human@flowcrypt.com',
];

export const mockAttesterEndpoints: HandlersDefinition = {
  '/attester/pub/?': async ({ body }, req) => {
    const emailOrLongid = req.url!.split('/').pop().toLowerCase().trim();
    if (isGet(req)) {
      if (knownEmails.includes(emailOrLongid)) {
        // the client does not yet check that the pubkey contains the right uids
        // once it starts checking that, we'll have to be more specific with the pubkeys
        return getSomePubkey();
      }
      throw new HttpClientErr('Pubkey not found', 404);
    } else if (isPost(req)) {
      const email = oauth.checkAuthorizationHeaderWithIdToken(req.headers.authorization);
      expect(email).to.be.oneOf(knownEmails);
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

const getSomePubkey = () => {
  return `-----BEGIN PGP PUBLIC KEY BLOCK-----
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
};