/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { ApiErr } from '../../../js/common/api/error/api-error.js';
import { Catch } from '../../../js/common/platform/catch.js';
import { KeyInfo } from '../../../js/common/core/pgp-key.js';
import { Lang } from '../../../js/common/lang.js';
import { PgpKey } from '../../../js/common/core/pgp-key.js';
import { Store } from '../../../js/common/platform/store.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { ViewModule } from '../../../js/common/view-module.js';
import { ComposeView } from '../compose.js';

export class ComposerMyPubkey extends ViewModule<ComposeView> {

  private toggledManually = false;

  public initActions = () => {
    this.view.S.cached('icon_pubkey').attr('title', Lang.compose.includePubkeyIconTitle);
    this.view.S.cached('icon_pubkey').click(this.view.setHandler(target => {
      this.toggledManually = true;
      const includePub = !$(target).is('.active'); // evaluating what the state of the icon was BEFORE clicking
      Ui.toast(`${includePub ? 'Attaching' : 'Removing'} your Public Key`).catch(Catch.reportErr);
      this.setAttachPreference(includePub);
    }, this.view.errModule.handlers(`set/unset pubkey attachment`)));
  }

  public shouldAttach = () => {
    return this.view.S.cached('icon_pubkey').is('.active');
  }

  public chooseMyPublicKeyBySenderEmail = async (keys: KeyInfo[], email: string) => {
    for (const key of keys) {
      const parsedkey = await PgpKey.read(key.public);
      if (parsedkey.users.find(u => !!u.userId && u.userId.userid.toLowerCase().includes(email.toLowerCase()))) {
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
      const contacts = await Store.dbContactGet(undefined, this.view.recipientsModule.getRecipients().map(r => r.email));
      for (const contact of contacts) {
        if (contact?.has_pgp && contact.client !== 'cryptup') {
          // new message, and my key is not uploaded where the recipient would look for it
          if (! await this.view.recipientsModule.doesRecipientHaveMyPubkey(contact.email)) {
            // either don't know if they need pubkey (can_read_emails false), or they do need pubkey
            this.setAttachPreference(true);
            return;
          }
        }
      }
      this.setAttachPreference(false);
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
