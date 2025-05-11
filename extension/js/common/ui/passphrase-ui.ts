/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch } from '../platform/catch.js';
import { Ui } from '../browser/ui.js';
import { Xss } from '../platform/xss.js';
import { GlobalStore } from '../platform/store/global-store.js';
import { ClientConfiguration } from '../client-configuration.js';

export const shouldPassPhraseBeHidden = async () => {
  const storage = await GlobalStore.get(['hide_pass_phrases']);
  return !!storage.hide_pass_phrases;
};

export const initPassphraseToggle = async (passphraseInputIds: string[], forceInitialShowOrHide?: 'show' | 'hide') => {
  const buttonHide = '<img src="/img/svgs/eyeclosed-icon.svg" class="eye-closed"><br>hide';
  const buttonShow = '<img src="/img/svgs/eyeopen-icon.svg" class="eye-open"><br>show';
  let show: boolean;
  if (forceInitialShowOrHide === 'hide') {
    show = false;
  } else if (forceInitialShowOrHide === 'show') {
    show = true;
  } else {
    show = !(await shouldPassPhraseBeHidden());
  }
  for (const id of passphraseInputIds) {
    const passphraseInput = $(`#${id}`);
    passphraseInput.addClass('toggled_passphrase');
    if (!passphraseInput.attr('data-test')) {
      passphraseInput.attr('data-test', 'input-passphrase');
    }
    if (show) {
      passphraseInput.after(`<label href="#" id="toggle_${id}" class="toggle_show_hide_pass_phrase" for="${id}">${buttonHide}</label>`); // xss-direct
      passphraseInput.attr('type', 'text');
    } else {
      passphraseInput.after(`<label href="#" id="toggle_${id}" class="toggle_show_hide_pass_phrase" for="${id}">${buttonShow}</label>`); // xss-direct
      passphraseInput.attr('type', 'password');
    }
    $(`#toggle_${id}`)
      .on(
        'click',
        Ui.event.handle((target, event) => {
          if (event.originalEvent) {
            $('.toggle_show_hide_pass_phrase:visible').not(target).trigger('click'); // toggle the visibility of all other visible password fields on the page
          }
          if (passphraseInput.attr('type') === 'password') {
            $(`#${id}`).attr('type', 'text');
            Xss.sanitizeRender(target, buttonHide);
            // eslint-disable-next-line @typescript-eslint/naming-convention
            GlobalStore.set({ hide_pass_phrases: false }).catch(Catch.reportErr);
          } else {
            $(`#${id}`).attr('type', 'password');
            Xss.sanitizeRender(target, buttonShow);
            // eslint-disable-next-line @typescript-eslint/naming-convention
            GlobalStore.set({ hide_pass_phrases: true }).catch(Catch.reportErr);
          }
        })
      )
      .trigger('click')
      .trigger('click'); // double-click the toggle to prevent browser from prefilling values
  }
};

export const isCreatePrivateFormInputCorrect = async (section: string, clientConfiguration: ClientConfiguration): Promise<boolean> => {
  const password1 = $(`#${section} .input_password`);
  const password2 = $(`#${section} .input_password2`);
  if (!password1.val()) {
    await Ui.modal.warning('passphrase is needed to protect your private email. Please enter a passphrase.');
    password1.trigger('focus');
    return false;
  }
  if ($(`#${section} .action_proceed_private`).hasClass('gray')) {
    await Ui.modal.warning('passphrase is not strong enough. Please make it stronger, by adding a few words.');
    password1.trigger('focus');
    return false;
  }
  if (password1.val() !== password2.val()) {
    await Ui.modal.warning('The passphrases do not match. Please try again.');
    password2.val('').trigger('focus');
    return false;
  }
  let notePp = String(password1.val());
  if (await shouldPassPhraseBeHidden()) {
    notePp = notePp.substring(0, 2) + notePp.substring(2, notePp.length - 2).replace(/[^ ]/g, '*') + notePp.substring(notePp.length - 2, notePp.length);
  }
  if (!clientConfiguration.usesKeyManager()) {
    const paperPassPhraseStickyNote = `
        <div style="font-size: 1.2em">
          Please write down your passphrase and store it in safe place or even two.
          It is needed in order to access your FlowCrypt account.
        </div>
        <div class="passphrase-sticky-note">${notePp}</div>
      `;
    return await Ui.modal.confirmWithCheckbox('Yes, I wrote it down', paperPassPhraseStickyNote);
  }
  return true;
};
