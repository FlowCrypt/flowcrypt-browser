/* © 2016-2019 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict'

import { Catch } from '../../js/common/platform/catch.js';
import { Ui, Env } from '../../js/common/browser.js';
import { Str } from '../../js/common/core/common.js';
import { mnemonic } from '../../js/common/core/mnemonic.js';
import { Pgp } from '../../js/common/core/pgp.js';
import { BrowserMsg } from '../../js/common/extension.js';
import { Store } from '../../js/common/platform/store.js';

declare const openpgp: typeof OpenPGP;

Catch.try(async () => {
    Ui.event.protect();

    const uncheckedUrlParams = Env.urlParams(['primary', 'acctEmail', 'parentTabId', 'frameId']);
    const acctEmail = Env.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
    const parentTabId = Env.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');
    const frameId = Env.urlParamRequire.string(uncheckedUrlParams, 'frameId');
    const [primaryKey] = await Store.keysGet(acctEmail, ['primary']);
    const { keys: [key] } = await openpgp.key.readArmored(primaryKey.private);

    const render = async () => {
        const longId = await Pgp.key.longid(key) || '';
        if (key) {
            $('.line.fingerprints .fingerprint').text(await Pgp.key.fingerprint(key, 'spaced') || '(fingerprint error)');
            $('.line.fingerprints .keywords').text(mnemonic(longId) || '(mnemonic error)');
        } else {
            $('.line.fingerprints').css({ display: 'none' });
        }

        if (typeof key !== 'undefined') {
            if (! await key.getEncryptionKey() && ! await key.getSigningKey()) {
                $('.line.add_contact').addClass('bad').text('This public key looks correctly formatted, but cannot be used for encryption. Email human@flowcrypt.com to get this resolved.');
                $('.line.fingerprints').css({ display: 'none', visibility: 'hidden' });
            } else {
                const email = key.users[0].userId ? Str.parseEmail(key.users[0].userId ? key.users[0].userId!.userid : '').email : undefined;
                if (email) {
                    $('.email').text(email);
                }
            }
        }

        if (await Store.keysGet(acctEmail, [longId])) {
            $('.line .private_key_status').text('This key is already imported.')
        } else {
            $('.line .private_key_status')
                .text('This private key was not imported. We suggest to import all backups so that you can read all incoming encrypted emails.')
                .after('<div class="line"><div class="button green" id="action_import_key">Import Missing Private Key</div></div>');
            $("#action_import_key").click(Ui.event.handle(async target => {
                BrowserMsg.send.bg.settings({ acctEmail, page: '/chrome/settings/modules/add_key.htm' })
            }));
        }
    }

    const sendResizeMsg = () => {
        const desiredHeight = $('#backup_block').height()!;
        BrowserMsg.send.setCss(parentTabId, { selector: `iframe#${frameId}`, css: { height: `${desiredHeight}px` } });
    };

    $('.action_test_pass').click(Ui.event.handle(async target => {
        if (await Pgp.key.decrypt(key, [String($('#pass_phrase').val())]) === true) {
            $(".line.pass_phrase_test").addClass('green').text("Your pass phrase matches!");
            sendResizeMsg();
        } else {
            await Ui.modal.warning('Pass phrase did not match. Please try again. If you forgot your pass phrase, please change it, so that do don\'t get locked out of your encrypted messages.');
        }
    }));

    render();
    sendResizeMsg();
})();