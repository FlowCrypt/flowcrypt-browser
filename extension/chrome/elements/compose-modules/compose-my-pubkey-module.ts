/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { ApiErr } from '../../../js/common/api/shared/api-error.js';
import { KeyUtil } from '../../../js/common/core/crypto/key.js';
import { Lang } from '../../../js/common/lang.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { ViewModule } from '../../../js/common/view-module.js';
import { ComposeView } from '../compose.js';
import { Str } from '../../../js/common/core/common.js';

export class ComposeMyPubkeyModule extends ViewModule<ComposeView> {

  private toggledManually = false;
  private wkdFingerprints: { [acctEmail: string]: string[] } = {};

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

  public reevaluateShouldAttachOrNot = () => {
    if (this.toggledManually) { // leave it as is if toggled manually before
      return;
    }
    (async () => {
      const senderEmail = this.view.senderModule.getSender();
      // todo: which one to attach? x509?
      const senderKi = await this.view.storageModule.getKey(senderEmail);
      const primaryFingerprint = (await KeyUtil.parse(senderKi.private)).id;
      // if we have cashed this fingerprint, setAttachPreference(false) rightaway and return
      const cached = this.wkdFingerprints[senderEmail];
      if (Array.isArray(cached) && cached.includes(primaryFingerprint)) {
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
          const fingerprints = keys.map(key => key.id);
          this.wkdFingerprints[senderEmail] = fingerprints;
          if (fingerprints.includes(primaryFingerprint)) {
            this.setAttachPreference(false);
            return;
          }
        }
        for (const recipient of foreignRecipients) {
          // new message, and my key is not uploaded where the recipient would look for it
          if (! await this.view.recipientsModule.doesRecipientHaveMyPubkey(recipient)) {
            // they do need pubkey
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
