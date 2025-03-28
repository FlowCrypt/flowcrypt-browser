/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { PopoverChoices, PopoverOpt } from './compose-types.js';

import { Catch } from '../../../js/common/platform/catch.js';
import { Lang } from '../../../js/common/lang.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { ViewModule } from '../../../js/common/view-module.js';
import { ComposeView } from '../compose.js';
import { AcctStore } from '../../../js/common/platform/store/acct-store.js';

export class ComposeSendBtnPopoverModule extends ViewModule<ComposeView> {
  public choices: PopoverChoices = { encrypt: true, sign: true, richtext: false }; // defaults, may be changed by user using the popover

  public setHandlers = (): void => {
    this.view.S.cached('toggle_send_options').on(
      'click',
      this.view.setHandler((el, ev) => this.toggleVisible(ev))
    );
  };

  public render = async () => {
    const popoverItems = {
      richtext: { text: 'Rich text (PGP/MIME) - experimental', iconPath: undefined },
      encrypt: { text: 'Encrypt message', iconPath: '/img/svgs/locked-icon-green.svg' },
      sign: { text: 'Sign message', iconPath: '/img/svgs/signature-gray.svg' },
    };
    this.choices.richtext = await this.richTextUserChoiceRetrieve();
    for (const key of Object.keys(popoverItems)) {
      const popoverOpt = key as PopoverOpt;
      if (popoverOpt === 'richtext' && !this.view.debug && !Catch.isFirefox()) {
        continue; // richtext not deployed to Chrome yet, for now only allow firefox (and also in automated tests which set debug===true)
      }
      const item = popoverItems[popoverOpt];
      const elem = $(`
        <div class="action-toggle-${Xss.escape(popoverOpt)}-sending-option sending-option" data-test="action-toggle-${Xss.escape(popoverOpt)}">
            <span class="option-name">${Xss.escape(item.text)}</span>
        </div>`);
      this.renderCrossOrTick(elem, popoverOpt, this.choices[popoverOpt]);
      elem.on(
        'click',
        this.view.setHandler(() => this.toggleItemTick(elem, popoverOpt))
      );
      if (item.iconPath) {
        elem.find('.option-name').prepend(`<img src="${item.iconPath}" />`); // xss-direct
      }
      this.view.S.cached('sending_options_container').append(elem); // xss-safe-factory
    }
    this.view.S.cached('title').text(this.composeHeaderText());
  };

  /**
   * @param machineForceStateTo - if this is present, this is a programmatic call, therefore such choices should not be sticky
   */
  public toggleItemTick = (elem: JQuery, popoverOpt: PopoverOpt, machineForceStateTo?: boolean) => {
    const currentlyTicked = this.isTicked(elem);
    let newToggleTicked = typeof machineForceStateTo !== 'undefined' ? machineForceStateTo : !currentlyTicked;
    if (newToggleTicked === this.choices[popoverOpt] && newToggleTicked === currentlyTicked) {
      return; // internal state as well as UI state is in sync with newly desired result, nothing to do
    }
    // https://github.com/FlowCrypt/flowcrypt-browser/issues/3475
    // on "encrypt" clicking, if user is enabling "encrypt", it should also auto-enable "sign"
    if (popoverOpt === 'encrypt' && newToggleTicked && !this.choices.sign) {
      this.choices.sign = true;
      this.renderCrossOrTick($('.action-toggle-sign-sending-option'), popoverOpt, true);
    }
    // on "sign" clicking, always set sign to true regardless of previous state if "encrypt" is selected
    if (popoverOpt === 'sign' && this.choices.encrypt && !newToggleTicked) {
      newToggleTicked = true;
    }
    this.choices[popoverOpt] = newToggleTicked;
    if (currentlyTicked && !newToggleTicked) {
      this.renderCrossOrTick(elem, popoverOpt, false);
    }
    if (!currentlyTicked && newToggleTicked) {
      this.renderCrossOrTick(elem, popoverOpt, true);
    }
    this.view.S.cached('title').text(this.composeHeaderText());
    if (this.choices.encrypt) {
      this.view.S.cached('compose_table').removeClass('not-encrypted');
      this.view.S.now('attached_files').removeClass('not-encrypted');
    } else {
      this.view.S.cached('compose_table').addClass('not-encrypted');
      this.view.S.now('attached_files').addClass('not-encrypted');
    }
    /* eslint-disable @typescript-eslint/no-unused-expressions */
    this.choices.richtext ? this.view.inputModule.addRichTextFormatting() : this.view.inputModule.removeRichTextFormatting();
    /* eslint-enable @typescript-eslint/no-unused-expressions */
    this.view.sendBtnModule.resetSendBtn();
    this.view.pwdOrPubkeyContainerModule.showHideContainerAndColorSendBtn().catch(Catch.reportErr);
    if (typeof machineForceStateTo === 'undefined' && popoverOpt === 'richtext') {
      // human-input choice of rich text
      this.richTextUserChoiceStore(newToggleTicked).catch(Catch.reportErr);
    }
  };

  private toggleVisible = (event: JQuery.TriggeredEvent<HTMLElement>) => {
    event.stopPropagation();
    const sendingContainer = $('.sending-container');
    sendingContainer.toggleClass('popover-opened');
    const popoverClickHandler = this.view.setHandler((_elem, event) => {
      const ev = event as JQuery.BlurEvent<HTMLElement>;
      if (!this.view.S.cached('sending_options_container')[0].contains(ev.relatedTarget as HTMLElement)) {
        sendingContainer.removeClass('popover-opened');
        $('body').off('click', popoverClickHandler);
        this.view.S.cached('toggle_send_options').off('keydown');
      }
    });
    if (sendingContainer.hasClass('popover-opened')) {
      $('body').on('click', popoverClickHandler);
      this.view.S.cached('toggle_send_options').on(
        'keydown',
        this.view.setHandler(async (target, e) => this.keydownHandler(e))
      );
      const sendingOptions = this.view.S.cached('sending_options_container').find('.sending-option');
      sendingOptions.on('hover', function () {
        sendingOptions.removeClass('active');
        $(this).addClass('active');
      });
    } else {
      $('body').off('click', popoverClickHandler);
      this.view.S.cached('toggle_send_options').off('keydown');
    }
  };

  private keydownHandler = (e: JQuery.TriggeredEvent<HTMLElement>): void => {
    const sendingOptions = this.view.S.cached('sending_options_container').find('.sending-option');
    const currentActive = sendingOptions.filter('.active');
    if (e.key === 'Escape') {
      e.stopPropagation();
      this.toggleVisible(e);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      let prev = currentActive.prev();
      if (!prev.length) {
        prev = sendingOptions.last();
      }
      currentActive.removeClass('active');
      prev.addClass('active');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      let next = currentActive.next();
      if (!next.length) {
        next = sendingOptions.first();
      }
      currentActive.removeClass('active');
      next.addClass('active');
    } else if (e.key === 'Enter') {
      e.stopPropagation();
      e.preventDefault();
      currentActive.trigger('click');
    }
  };

  private richTextUserChoiceStore = async (isTicked: boolean) => {
    await AcctStore.set(this.view.acctEmail, {
      use_rich_text: isTicked, // eslint-disable-line @typescript-eslint/naming-convention
    });
  };

  private richTextUserChoiceRetrieve = async (): Promise<boolean> => {
    const store = await AcctStore.get(this.view.acctEmail, ['use_rich_text']);
    return store.use_rich_text || false;
  };

  private renderCrossOrTick = (elem: JQuery, popoverOpt: PopoverOpt, renderTick: boolean) => {
    if (renderTick) {
      elem.find('img.icon-tick,img.icon-cross').remove();
      elem.append(`<img class="icon-tick" src="/img/svgs/tick.svg" data-test="icon-toggle-${Xss.escape(popoverOpt)}-tick" />`); // xss-escaped
      elem.css('opacity', '1');
    } else {
      elem.find('img.icon-tick,img.icon-cross').remove();
      elem.append(`<img class="icon-cross" src="/img/red-cross-mark.png" data-test="icon-toggle-${Xss.escape(popoverOpt)}-cross" />`); // xss-escaped
      elem.css('opacity', '0.5');
    }
  };

  private isTicked = (popoverItemElem: JQuery) => {
    return !!popoverItemElem.find('img.icon-tick').length;
  };

  private composeHeaderText = (): string => {
    if (this.choices.encrypt && this.choices.sign) {
      return Lang.compose.headers.encryptedAndSigned;
    } else if (this.choices.encrypt) {
      return Lang.compose.headers.encrypted;
    } else if (this.choices.sign) {
      return Lang.compose.headers.signed;
    } else {
      return Lang.compose.headers.plain;
    }
  };
}
