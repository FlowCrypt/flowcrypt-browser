/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { PgpBlockView } from '../pgp_block';
import { Ui } from '../../../js/common/browser/ui.js';
import { VerifyRes } from '../../../js/common/core/crypto/pgp/msg-util.js';

export class PgpBlockViewSignatureModule {

  constructor(private view: PgpBlockView) {
  }

  public renderPgpSignatureCheckResult = (signature: VerifyRes | undefined) => {
    this.view.renderModule.doNotSetStateAsReadyYet = true; // so that body state is not marked as ready too soon - automated tests need to know when to check results
    if (!signature) {
      $('#pgp_signature').addClass('bad');
      $('#pgp_signature > .cursive').remove();
      $('#pgp_signature > .result').text('Message Not Signed');
    } else if (signature.error) {
      $('#pgp_signature').addClass('bad');
      $('#pgp_signature > .result').text(signature.error);
      this.view.renderModule.setFrameColor('red');
    } else if (signature.match) {
      $('#pgp_signature').addClass('good');
      $('#pgp_signature > .result').text('matching signature');
    } else {
      $('#pgp_signature').addClass('bad');
      $('#pgp_signature > .result').text('signature does not match');
      this.view.renderModule.setFrameColor('red');
    }
    if (signature) {
      this.setSigner(signature);
    }
    this.view.renderModule.doNotSetStateAsReadyYet = false;
    Ui.setTestState('ready');
  };

  private setSigner = (signature: VerifyRes): void => {
    const signerEmail = signature.match ? this.view.getSigner() : undefined;
    $('#pgp_signature > .cursive > span').text(signerEmail || 'Unknown Signer');
  };

  /**
   * don't have appropriate pubkey by longid in contacts
   *
   */
  /*
  private renderPgpSignatureCheckMissingPubkeyOptions = async (signerLongid: string, senderEmail: string,
    retryVerification?: () => Promise<VerifyRes | undefined>): Promise<VerifyRes | undefined> => {
    const render = (note: string, action: () => void) => $('#pgp_signature').addClass('neutral').find('.result').text(note).click(this.view.setHandler(action));
    try {
      if (senderEmail) { // we know who sent it
        const [senderContactByEmail] = await ContactStore.get(undefined, [senderEmail]);
        if (senderContactByEmail && senderContactByEmail.pubkey) {
          const foundId = senderContactByEmail.pubkey.id;
          render(`Fetched the right pubkey ${signerLongid} from keyserver, but will not use it because you have conflicting pubkey ${foundId} loaded.`, () => undefined);
          return undefined;
        }
        // ---> and user doesn't have pubkey for that email addr
        const { pubkeys } = await this.view.pubLookup.lookupEmail(senderEmail);
        if (!pubkeys.length) {
          render(`Missing pubkey ${signerLongid}`, () => undefined);
          return undefined;
        }
        // ---> and pubkey found on keyserver by sender email
        const { key: pubkey } = await BrowserMsg.send.bg.await.keyMatch({ pubkeys, longid: signerLongid });
        if (!pubkey) {
          render(`Fetched ${pubkeys.length} sender's pubkeys but message was signed with a different key: ${signerLongid}, will not verify.`, () => undefined);
          return undefined;
        }
        // ---> and longid it matches signature
        await ContactStore.update(undefined, senderEmail, { pubkey }); // <= TOFU auto-import
        if (retryVerification) {
          const newResult = await retryVerification();
          if (newResult) {
            return newResult;
          }
        }
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
    return undefined;
  };
*/
}
