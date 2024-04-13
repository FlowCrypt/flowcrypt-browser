/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { ApiErr } from '../../../js/common/api/shared/api-error.js';
import { Lang } from '../../../js/common/lang.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { ViewModule } from '../../../js/common/view-module.js';
import { ComposeView } from '../compose.js';
import { Str } from '../../../js/common/core/common.js';
import { KeyStoreUtil } from '../../../js/common/core/crypto/key-store-util.js';
import { KeyUtil } from '../../../js/common/core/crypto/key.js';

export class ComposeMyPubkeyModule extends ViewModule<ComposeView> {
  private toggledManually = false;
  private wkdFingerprints: { [acctEmail: string]: string[] | undefined } = {};

  public setHandlers = () => {
    this.view.S.cached('icon_pubkey').attr('title', Lang.compose.includePubkeyIconTitle);
    this.view.S.cached('icon_pubkey').on(
      'click',
      this.view.setHandler(el => this.iconPubkeyClickHandler(el), this.view.errModule.handle(`set/unset pub attachment`))
    );
  };

  public iconPubkeyClickHandler = (target: HTMLElement) => {
    this.toggledManually = true;
    const includePub = !$(target).is('.active'); // evaluating what the state of the icon was BEFORE clicking
    Ui.toast(`${includePub ? 'Attaching' : 'Removing'} your Public Key`);
    if (this.view.S.cached('warning_no_pubkey_on_attester').is(':visible')) {
      this.view.S.cached('warning_no_pubkey_on_attester').css('display', 'none');
    }
    this.setAttachPreference(includePub);
  };

  public shouldAttach = () => {
    return this.view.S.cached('icon_pubkey').is('.active');
  };

  public reevaluateShouldAttachOrNot = () => {
    if (this.toggledManually) {
      // leave it as is if toggled manually before
      return;
    }
    (async () => {
      const senderEmail = this.view.senderModule.getSender();
      // todo: disable attaching S/MIME certificate #4075
      const parsedStoredPrvs = await KeyStoreUtil.parse(await this.view.storageModule.getAccountKeys(senderEmail));
      // if we have cashed this fingerprint, setAttachPreference(false) rightaway and return
      const cached = this.wkdFingerprints[senderEmail];
      for (const parsedPrv of parsedStoredPrvs.filter(prv => prv.key.usableForEncryption || prv.key.usableForSigning)) {
        if (cached && cached.includes(parsedPrv.key.id)) {
          this.setAttachPreference(false); // at least one of our valid keys is on WKD: no need to attach
          return;
        }
      }
      const myDomain = Str.getDomainFromEmailAddress(senderEmail);
      const foreignRecipients = this.view.recipientsModule
        .getValidRecipients()
        .map(r => r.email)
        .filter(email => myDomain !== Str.getDomainFromEmailAddress(email));
      if (foreignRecipients.length > 0) {
        if (!Array.isArray(cached)) {
          // slow operation -- test WKD for our own key and cache the result
          const fetchedPubKeys = await this.view.pubLookup.wkd.rawLookupEmail(senderEmail);
          this.wkdFingerprints[senderEmail] = fetchedPubKeys.map(k => k.id);
          for (const parsedStoredPrv of parsedStoredPrvs) {
            for (const fetchedPubKey of fetchedPubKeys) {
              if (KeyUtil.identityEquals(fetchedPubKey, parsedStoredPrv.keyInfo)) {
                this.setAttachPreference(false);
                return;
              }
            }
          }
        }
        for (const recipient of foreignRecipients) {
          // new message, and my key is not uploaded where the recipient would look for it
          if (!(await this.view.recipientsModule.doesRecipientHaveMyPubkey(recipient))) {
            // they do need pubkey
            // To improve situation reported in #5609, a notification message about the automatic public key inclusion is displayed
            // while (!$('div#input_text').is(':visible') || !$('table#compose').is(':visible')) {
            // await new Promise<void>(resolve => setTimeout(resolve, 500)); // error-handled: Add a delay until the table #compose is displayed as a workaround for the toast UI not showing up too early when the email composer is not opened.
            // }
            this.view.S.cached('warning_no_pubkey_on_attester').css('display', 'block');
            this.setAttachPreference(true);
            // Ui.toast(
            //   `We couldn't find your public key on the server. We've included it for you so that they can use it to reply back to you encrypted. You may click the certificate icon to exclude it from this email.\n<p style="font-size: 0.9em">If you want to submit your public key, please ask ${this.view.fesUrl ? 'your administrator' : '<span class="link">human@flowcrypt.com</span>'} for assistance.</p>`,
            //   true,
            //   5
            // );
            return;
          }
        }
        this.setAttachPreference(false);
      }
    })().catch(ApiErr.reportIfSignificant);
  };

  private setAttachPreference = (includePubkey: boolean) => {
    if (includePubkey) {
      this.view.S.cached('icon_pubkey').addClass('active');
    } else {
      this.view.S.cached('icon_pubkey').removeClass('active');
    }
  };
}
