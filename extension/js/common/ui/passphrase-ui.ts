/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch } from '../platform/catch.js';
import { Ui } from '../browser/ui.js';
import { Xss } from '../platform/xss.js';
import { GlobalStore } from '../platform/store/global-store.js';

export const shouldPassPhraseBeHidden = async () => {
  const storage = await GlobalStore.get(['hide_pass_phrases']);
  return !!storage.hide_pass_phrases;
};

export const initPassphraseToggle = async (passphraseInputIds: string[], forceInitialShowOrHide?: "show" | "hide") => {
  const buttonHide = '<img src="/img/svgs/eyeclosed-icon.svg" class="eye-closed"><br>hide';
  const buttonShow = '<img src="/img/svgs/eyeopen-icon.svg" class="eye-open"><br>show';
  let show: boolean;
  if (forceInitialShowOrHide === 'hide') {
    show = false;
  } else if (forceInitialShowOrHide === 'show') {
    show = true;
  } else {
    show = ! await shouldPassPhraseBeHidden();
  }
  for (const id of passphraseInputIds) {
    const passphraseInput = $(`#${id}`);
    passphraseInput.addClass('toggled_passphrase');
    if (show) {
      passphraseInput.after(`<label href="#" id="toggle_${id}" class="toggle_show_hide_pass_phrase" for="${id}">${buttonHide}</label>`);
      passphraseInput.attr('type', 'text');
    } else {
      passphraseInput.after(`<label href="#" id="toggle_${id}" class="toggle_show_hide_pass_phrase" for="${id}">${buttonShow}</label>`);
      passphraseInput.attr('type', 'password');
    }
    $(`#toggle_${id}`).click(Ui.event.handle((target, event) => {
      if (event.originalEvent) {
        $('.toggle_show_hide_pass_phrase:visible').not(target).click(); // toggle the visibility of all other visible password fields on the page
      }
      if (passphraseInput.attr('type') === 'password') {
        $(`#${id}`).attr('type', 'text');
        Xss.sanitizeRender(target, buttonHide);
        GlobalStore.set({ hide_pass_phrases: false }).catch(Catch.reportErr);
      } else {
        $(`#${id}`).attr('type', 'password');
        Xss.sanitizeRender(target, buttonShow);
        GlobalStore.set({ hide_pass_phrases: true }).catch(Catch.reportErr);
      }
    })).click().click(); // double-click the toggle to prevent browser from prefilling values
  }
};
