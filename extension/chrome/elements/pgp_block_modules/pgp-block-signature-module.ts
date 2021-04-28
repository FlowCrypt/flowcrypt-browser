/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { ApiErr } from '../../../js/common/api/shared/api-error.js';
import { BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { Catch } from '../../../js/common/platform/catch.js';
import { PgpBlockView } from '../pgp_block';
import { Ui } from '../../../js/common/browser/ui.js';
import { VerifyRes } from '../../../js/common/core/crypto/pgp/msg-util.js';
import { ContactStore } from '../../../js/common/platform/store/contact-store.js';
import { OpenPGPKey } from '../../../js/common/core/crypto/pgp/openpgp-key.js';
import { Str } from '../../../js/common/core/common.js';

export class PgpBlockViewSignatureModule {

  constructor(private view: PgpBlockView) {
  }

  public renderPgpSignatureCheckResult = (signature: VerifyRes | undefined) => {
    if (signature) {
      const signerEmail = signature.signer?.primaryUserId ? Str.parseEmail(signature.signer.primaryUserId).email : undefined;
      $('#pgp_signature > .cursive > span').text(signerEmail || 'Unknown Signer');
      if (signature.signer && !signature.contact) {
        this.view.renderModule.doNotSetStateAsReadyYet = true; // so that body state is not marked as ready too soon - automated tests need to know when to check results
        // todo signerEmail?
        this.renderPgpSignatureCheckMissingPubkeyOptions(signature.signer.longid, this.view.senderEmail).then(() => { // async so that it doesn't block rendering
          this.view.renderModule.doNotSetStateAsReadyYet = false;
          Ui.setTestState('ready');
          $('#pgp_block').css('min-height', '100px'); // signature fail can have a lot of text in it to render
          this.view.renderModule.resizePgpBlockFrame();
        }).catch(Catch.reportErr);
      } else if (signature.error) {
        $('#pgp_signature').addClass('bad');
        $('#pgp_signature > .result').text(signature.error);
        this.view.renderModule.setFrameColor('red');
      } else if (signature.match && signature.signer && signature.contact) {
        $('#pgp_signature').addClass('good');
        $('#pgp_signature > .result').text('matching signature');
      } else {
        $('#pgp_signature').addClass('bad');
        $('#pgp_signature > .result').text('signature does not match');
        this.view.renderModule.setFrameColor('red');
      }
    } else {
      $('#pgp_signature').addClass('bad');
      $('#pgp_signature > .cursive').remove();
      $('#pgp_signature > .result').text('Message Not Signed');
    }
    $('#pgp_signature').css('block');
  }

  /**
   * don't have appropriate pubkey by longid in contacts
   */
  private renderPgpSignatureCheckMissingPubkeyOptions = async (signerLongid: string, senderEmail: string): Promise<void> => {
    const render = (note: string, action: () => void) => $('#pgp_signature').addClass('neutral').find('.result').text(note).click(this.view.setHandler(action));
    try {
      if (senderEmail) { // we know who sent it
        const [senderContactByEmail] = await ContactStore.get(undefined, [senderEmail]);
        if (senderContactByEmail && senderContactByEmail.pubkey) {
          const foundId = senderContactByEmail.pubkey.id;
          render(`Fetched the right pubkey ${signerLongid} from keyserver, but will not use it because you have conflicting pubkey ${foundId} loaded.`, () => undefined);
          return;
        }
        // ---> and user doesn't have pubkey for that email addr
        const { pubkey } = await this.view.pubLookup.lookupEmail(senderEmail);
        if (!pubkey) {
          render(`Missing pubkey ${signerLongid}`, () => undefined);
          return;
        }
        // ---> and pubkey found on keyserver by sender email
        const { key } = await BrowserMsg.send.bg.await.keyParse({ armored: pubkey });
        if (!key.allIds.map(id => OpenPGPKey.fingerprintToLongid(id)).includes(signerLongid)) {
          render(`Fetched sender's pubkey ${OpenPGPKey.fingerprintToLongid(key.id)} but message was signed with a different key: ${signerLongid}, will not verify.`, () => undefined);
          return;
        }
        // ---> and longid it matches signature
        await ContactStore.save(undefined, await ContactStore.obj({ email: senderEmail, pubkey })); // <= TOFU auto-import
        render('Fetched pubkey, click to verify', () => window.location.reload());
      } else { // don't know who sent it
        render('Cannot verify: missing pubkey, missing sender info', () => undefined);
        // todo - try to fetch pubkey by longid, offer to import it, show warning explaining what it means
      }
    } catch (e) {
      if (ApiErr.isSignificant(e)) {
        Catch.reportErr(e);
        render(`Could not load sender pubkey ${signerLongid} due to an error.`, () => undefined);
      } else {
        render(`Could not look up sender's pubkey due to network error, click to retry.`, () => window.location.reload());
      }
    }
  }

}
