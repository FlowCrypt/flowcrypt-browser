/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { ApiErr } from '../../../js/common/api/error/api-error.js';
import { BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { Catch } from '../../../js/common/platform/catch.js';
import { Keyserver } from '../../../js/common/api/keyserver.js';
import { PgpBlockView } from '../pgp_block';
import { PgpKey } from '../../../js/common/core/pgp-key.js';
import { Store } from '../../../js/common/platform/store.js';
import { Str } from '../../../js/common/core/common.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { VerifyRes } from '../../../js/common/core/pgp-msg.js';

export class PgpBlockViewSignatureModule {

  constructor(private view: PgpBlockView) {
  }

  public renderPgpSignatureCheckResult = (signature: VerifyRes | undefined) => {
    if (signature) {
      const signerEmail = signature.contact ? signature.contact.name || this.view.senderEmail : this.view.senderEmail;
      $('#pgp_signature > .cursive > span').text(signerEmail || 'Unknown Signer');
      if (signature.signer && !signature.contact) {
        this.view.renderModule.doNotSetStateAsReadyYet = true; // so that body state is not marked as ready too soon - automated tests need to know when to check results
        this.renderPgpSignatureCheckMissingPubkeyOptions(signature.signer, this.view.senderEmail).then(() => { // async so that it doesn't block rendering
          this.view.renderModule.doNotSetStateAsReadyYet = false;
          Ui.setTestState('ready');
          $('#pgp_block').css('min-height', '100px'); // signature fail can have a lot of text in it to render
          this.view.renderModule.resizePgpBlockFrame();
        }).catch(Catch.reportErr);
      } else if (signature.match && signature.signer && signature.contact) {
        $('#pgp_signature').addClass('good');
        $('#pgp_signature > .result').text('matching signature');
      } else {
        $('#pgp_signature').addClass('bad');
        $('#pgp_signature > .result').text('signature does not match');
        this.view.renderModule.setFrameColor('red');
      }
      $('#pgp_signature').css('block');
    }
  }

  /**
   * don't have appropriate pubkey by longid in contacts
   */
  private renderPgpSignatureCheckMissingPubkeyOptions = async (signerLongid: string, senderEmail: string | undefined): Promise<void> => {
    const render = (note: string, action: () => void) => $('#pgp_signature').addClass('neutral').find('.result').text(note).click(this.view.setHandler(action));
    try {
      if (senderEmail) { // we know who sent it
        const [senderContactByEmail] = await Store.dbContactGet(undefined, [senderEmail]);
        if (senderContactByEmail && senderContactByEmail.pubkey) {
          render(`Fetched the right pubkey ${signerLongid} from keyserver, but will not use it because you have conflicting pubkey ${senderContactByEmail.longid} loaded.`, () => undefined);
          return;
        } // ---> and user doesn't have pubkey for that email addr
        const { pubkey, pgpClient } = await Keyserver.lookupEmail(this.view.acctEmail, senderEmail);
        if (!pubkey) {
          render(`Missing pubkey ${signerLongid}`, () => undefined);
          return;
        } // ---> and pubkey found on keyserver by sender email
        const { keys: [keyDetails] } = await BrowserMsg.send.bg.await.pgpKeyDetails({ pubkey });
        if (!keyDetails || !keyDetails.ids.map(ids => ids.longid).includes(signerLongid)) {
          render(`Fetched sender's pubkey ${keyDetails.ids[0].longid} but message was signed with a different key: ${signerLongid}, will not verify.`, () => undefined);
          return;
        } // ---> and longid it matches signature
        await Store.dbContactSave(undefined, await Store.dbContactObj({
          email: senderEmail, pubkey, client: pgpClient, expiresOn: await PgpKey.dateBeforeExpiration(pubkey)
        })); // <= TOFU auto-import
        render('Fetched pubkey, click to verify', () => window.location.reload());
      } else { // don't know who sent it
        const { pubkey, pgpClient } = await Keyserver.lookupLongid(this.view.acctEmail, signerLongid);
        if (!pubkey) { // but can find matching pubkey by longid on keyserver
          render(`Could not find sender's pubkey anywhere: ${signerLongid}`, () => undefined);
          return;
        }
        const { keys: [keyDetails] } = await BrowserMsg.send.bg.await.pgpKeyDetails({ pubkey });
        const pubkeyEmail = Str.parseEmail(keyDetails.users[0] || '').email!;
        if (!pubkeyEmail) {
          render(`Fetched matching pubkey ${signerLongid} but no valid email address is listed in it.`, () => undefined);
          return;
        }
        const [conflictingContact] = await Store.dbContactGet(undefined, [pubkeyEmail]);
        if (conflictingContact && conflictingContact.pubkey) {
          render(`Fetched matching pubkey ${signerLongid} but conflicting key is in local contacts ${conflictingContact.longid} for email ${pubkeyEmail}, cannot verify.`, () => undefined);
          return;
        }
        render(`Fetched matching pubkey ${signerLongid}. Click to load and use it.`, async () => {
          await Store.dbContactSave(undefined, await Store.dbContactObj({
            email: pubkeyEmail, pubkey, client: pgpClient, expiresOn: await PgpKey.dateBeforeExpiration(pubkey)
          })); // TOFU manual import
          window.location.reload();
        });
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
