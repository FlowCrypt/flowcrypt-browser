/* © 2016-2019 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict'

import { Catch } from '../../js/common/platform/catch.js';
import { Ui, Env, Xss } from '../../js/common/browser.js';
import { Str } from '../../js/common/core/common.js';
import { mnemonic } from '../../js/common/core/mnemonic.js';
import { Pgp } from '../../js/common/core/pgp.js';
import { Store } from '../../js/common/platform/store.js';

declare const openpgp: typeof OpenPGP;

Catch.try(async () => {
    Ui.event.protect();

    const uncheckedUrlParams = Env.urlParams(['acctEmail', 'armoredPubkey']);
    const acctEmail = Env.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
    const armoredPubkey = Env.urlParamRequire.string(uncheckedUrlParams, 'armoredPubkey');
    const { keys: pubs } = await openpgp.key.readArmored(armoredPubkey);

    const render = async () => {
        const longId = await Pgp.key.longid(pubs[0]) || '';

        if (pubs.length === 1) {
            $('.line.fingerprints .fingerprint').text(await Pgp.key.fingerprint(pubs[0], 'spaced') || '(fingerprint error)');
            $('.line.fingerprints .keywords').text(mnemonic(longId) || '(mnemonic error)');
        } else {
            $('.line.fingerprints').css({ display: 'none' });
        }

        if (typeof pubs[0] !== 'undefined') {
            if (! await pubs[0].getEncryptionKey() && ! await pubs[0].getSigningKey()) {
                $('.line.add_contact').addClass('bad').text('This public key looks correctly formatted, but cannot be used for encryption. Email human@flowcrypt.com to get this resolved.');
                $('.line.fingerprints').css({ display: 'none', visibility: 'hidden' });
            } else {
                if (pubs.length === 1) {
                    const email = pubs[0].users[0].userId ? Str.parseEmail(pubs[0].users[0].userId ? pubs[0].users[0].userId!.userid : '').email : undefined;
                    if (email) {
                        $('.email').text(email);
                    }
                } else {
                    $('.email').text('more than one person');
                    $('.input_email').css({ display: 'none' });
                    const pubToEmail = (pubkey: OpenPGP.key.Key) => Str.parseEmail(pubkey.users[0].userId ? pubkey.users[0].userId!.userid : '').email;
                    Xss.sanitizeAppend('.add_contact', Xss.escape(' for ' + pubs.map(pubToEmail).filter(e => Str.isEmailValid(e)).join(', ')));
                }
            }
        }

        if (await Store.keysGet(acctEmail, [longId])) {
            $('.line .private_key_status').text('This key is already imported.')
        } else {
            $('.line .private_key_status').text('This private key was not imported. We suggest to import all backups so that you can read all incoming encrypted emails.')
        }
    }

    render();
})();