/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypcom */

'use strict';

import { ComposerComponent } from './interfaces/composer-component.js';
import { Ui } from '../browser.js';
import { Catch } from '../platform/catch.js';
import { Lang } from '../lang.js';
import { Api } from '../api/api.js';
import { Store } from '../platform/store.js';

export class ComposerMyPubkey extends ComposerComponent {

  private toggledManually = false;

  initActions() {
    this.composer.S.cached('icon_pubkey').attr('title', Lang.compose.includePubkeyIconTitle);
    this.composer.S.cached('icon_pubkey').click(Ui.event.handle(target => {
      this.toggledManually = true;
      const includePub = !$(target).is('.active'); // evaluating what the state of the icon was BEFORE clicking
      Ui.toast(`${includePub ? 'Attaching' : 'Removing'} your Public Key`).catch(Catch.reportErr);
      this.setAttachPreference(includePub);
    }, this.composer.errs.handlers(`set/unset pubkey attachment`)));
  }

  public reevaluateShouldAttachOrNot() {
    if (this.toggledManually) { // leave it as is if toggled manually before
      return;
    }
    (async () => {
      const contacts = await Store.dbContactGet(undefined, this.composer.recipients.getRecipients().map(r => r.email));
      for (const contact of contacts) {
        if (typeof contact === 'object' && contact.has_pgp && contact.client !== 'cryptup') {
          // new message, and my key is not uploaded where the recipient would look for it
          if (! await this.composer.app.doesRecipientHaveMyPubkey(contact.email)) {
            // either don't know if they need pubkey (can_read_emails false), or they do need pubkey
            this.setAttachPreference(true);
            return;
          }
        }
      }
      this.setAttachPreference(false);
    })().catch(Api.err.reportIfSignificant);
  }

  private setAttachPreference(includePubkey: boolean) {
    if (includePubkey) {
      this.composer.S.cached('icon_pubkey').addClass('active').attr('title', Lang.compose.includePubkeyIconTitleActive);
    } else {
      this.composer.S.cached('icon_pubkey').removeClass('active').attr('title', Lang.compose.includePubkeyIconTitle);
    }
  }

  public shouldAttach() {
    return this.composer.S.cached('icon_pubkey').is('.active');
  }

}
