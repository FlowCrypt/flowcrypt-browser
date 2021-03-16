/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { ApiErr } from '../../../js/common/api/shared/api-error.js';
import { KeyInfo } from '../../../js/common/core/crypto/key.js';
import { Lang } from '../../../js/common/lang.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { ViewModule } from '../../../js/common/view-module.js';
import { ComposeView } from '../compose.js';
import { Str } from '../../../js/common/core/common.js';
import { OpenPGPKey } from '../../../js/common/core/crypto/pgp/openpgp-key.js';

export class ComposeMyPubkeyModule extends ViewModule<ComposeView> {

  private toggledManually = false;
  private wkdLongids: { [acctEmail: string]: string[] } = {};

  public setHandlers = () => {
    this.view.S.cached('icon_pubkey').attr('title', Lang.compose.includePubkeyIconTitle);
    this.view.S.cached('icon_pubkey').click(this.view.setHandler((el) => this.iconPubkeyClickHandler(el), this.view.errModule.handle(`set/unset pub attachment`)));
  }

  public iconPubkeyClickHandler = (target: HTMLElement) => {
    this.toggledManually = true;
    const includePub = !$(target).is('.active'); // evaluating what the state of the icon was BEFORE clicking
    Ui.toast(`${includePub ? 'Attaching' : 'Removing'} your Public Key`);
    this.setAttachPreference(includePub);
  }

  public shouldAttach = () => {
    return this.view.S.cached('icon_pubkey').is('.active');
  }

  public chooseMyPublicKeyBySenderEmail = async (keys: KeyInfo[], email: string) => {
    for (const key of keys) {
      if (key.emails.includes(email.toLowerCase())) {
        return key;
      }
    }
    return undefined;
  }

  public reevaluateShouldAttachOrNot = () => {
    if (this.toggledManually) { // leave it as is if toggled manually before
      return;
    }
    (async () => {
      const senderEmail = this.view.senderModule.getSender();
      const senderKi = await this.view.storageModule.getKey(senderEmail);
      // if we have cashed this longid in this.wkdLongids, setAttachPreference(false) rightaway and return
      const cached = this.wkdLongids[senderEmail];
      if (Array.isArray(cached) && cached.some(id => id === senderKi.longid)) {
        this.setAttachPreference(false);
        return;
      }
      const myDomain = Str.getDomainFromEmailAddress(senderEmail);
      const foreignRecipients = this.view.recipientsModule.getRecipients().map(r => r.email)
        .filter(Boolean)
        .filter(email => myDomain !== Str.getDomainFromEmailAddress(email));
      if (foreignRecipients.length > 0) {
        if (!Array.isArray(cached)) {
          // slow operation -- test WKD for our own key and cache the result
          const { keys } = await this.view.pubLookup.wkd.rawLookupEmail(senderEmail);
          const longids = keys.map(key => OpenPGPKey.fingerprintToLongid(key.id));
          this.wkdLongids[senderEmail] = longids;
          // check fingerprint
          if (longids.some(id => id === senderKi.longid)) {
            this.setAttachPreference(false);
            return;
          }
        }
        for (const recipient of foreignRecipients) {
          // new message, and my key is not uploaded where the recipient would look for it
          if (! await this.view.recipientsModule.doesRecipientHaveMyPubkey(recipient)) {
            // either don't know if they need pubkey (can_read_emails false), or they do need pubkey
            this.setAttachPreference(true);
            return;
          }
        }
        this.setAttachPreference(false);
      }
    })().catch(ApiErr.reportIfSignificant);
  }

  private setAttachPreference = (includePubkey: boolean) => {
    if (includePubkey) {
      this.view.S.cached('icon_pubkey').addClass('active').attr('title', Lang.compose.includePubkeyIconTitleActive);
    } else {
      this.view.S.cached('icon_pubkey').removeClass('active').attr('title', Lang.compose.includePubkeyIconTitle);
    }
  }

}
