/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { ApiErr } from '../../../js/common/api/shared/api-error.js';
import { Catch } from '../../../js/common/platform/catch.js';
import { PgpBlockView } from '../pgp_block';
import { Ui } from '../../../js/common/browser/ui.js';
import { VerifyRes } from '../../../js/common/core/crypto/pgp/msg-util.js';

export class PgpBlockViewSignatureModule {

  constructor(private view: PgpBlockView) {
  }

  public renderPgpSignatureCheckResult = async (verifyRes: VerifyRes | undefined, verificationPubs: string[],
    retryVerification?: (verificationPubs: string[]) => Promise<VerifyRes | undefined>) => {
    this.view.renderModule.doNotSetStateAsReadyYet = true; // so that body state is not marked as ready too soon - automated tests need to know when to check results
    const signerLongids = verifyRes?.signerLongids;
    if (verifyRes?.error) {
      if (!verifyRes.isErrFatal && this.view.decryptModule.canFetchFromApi()) {
        this.view.signature!.parsedSignature = undefined; // force to re-parse
        await this.view.decryptModule.initialize(verificationPubs, true);
        return;
      }
      $('#pgp_signature').addClass('bad');
      $('#pgp_signature > .result').text(verifyRes.error);
      this.view.renderModule.setFrameColor('red');
    } else if (!signerLongids?.length) {
      $('#pgp_signature').addClass('bad');
      $('#pgp_signature > .cursive').remove();
      $('#pgp_signature > .result').text('Message Not Signed');
    } else if (verifyRes?.match) {
      $('#pgp_signature').addClass('good');
      $('#pgp_signature > .result').text('matching signature');
    } else {
      // todo: bad signature when pubkey is hit
      /*
            $('#pgp_signature').addClass('bad');
            $('#pgp_signature > .result').text('signature does not match');
            this.view.renderModule.setFrameColor('red');
      */
      if (retryVerification) {
        const signerEmail = this.view.getSigner();
        if (!signerEmail) {
          // in some tests we load the block without sender information
          $('#pgp_signature').addClass('neutral').find('.result').text(`Could not verify sender.`);
        } else {
          this.view.renderModule.renderText('Verifying message...');
          try {
            const { pubkeys: newPubkeys } = await this.view.pubLookup.lookupEmail(this.view.getSigner());
            if (newPubkeys.length) {
              await this.renderPgpSignatureCheckResult(await retryVerification(newPubkeys), newPubkeys, undefined);
              return;
            }
            this.renderMissingPubkey(signerLongids[0]);
          } catch (e) {
            if (ApiErr.isSignificant(e)) {
              Catch.reportErr(e);
              $('#pgp_signature').addClass('neutral').find('.result').text(`Could not load sender's pubkey due to an error.`);
            } else {
              $('#pgp_signature').addClass('neutral').find('.result').text(`Could not look up sender's pubkey due to network error, click to retry.`).click(
                this.view.setHandler(() => window.location.reload()));
            }
          }
        }
      } else { // !retryVerification
        this.renderMissingPubkey(signerLongids[0]);
      }
    }
    if (verifyRes) {
      this.setSigner(verifyRes);
    }
    this.view.renderModule.doNotSetStateAsReadyYet = false;
    Ui.setTestState('ready');
  };

  private setSigner = (signature: VerifyRes): void => {
    const signerEmail = signature.match ? this.view.getSigner() : undefined;
    $('#pgp_signature > .cursive > span').text(signerEmail || 'Unknown Signer');
  };

  private renderMissingPubkey = (signerLongid: string) => {
    $('#pgp_signature').addClass('neutral').find('.result').text(`Missing pubkey ${signerLongid}`);
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
