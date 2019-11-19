/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypcom */

'use strict';

import { ComposerComponent } from './interfaces/composer-component.js';
import { PopoverOpt, PopoverChoices } from './interfaces/composer-types.js';
import { Xss } from '../platform/xss.js';
import { Lang } from '../lang.js';
import { Ui } from '../browser.js';

export class ComposerSendBtnPopover extends ComposerComponent {

  public choices: PopoverChoices = { encrypt: true, sign: true, richText: false }; // defaults, may be changed by user using the popover

  initActions(): void {
    this.composer.S.cached('toggle_send_options').on('click', this.toggleVisible);
  }

  render() {
    const popoverItems = {
      richText: { text: 'Rich text (PGP/MIME)', iconPath: undefined },
      encrypt: { text: 'Encrypt message', iconPath: '/img/svgs/locked-icon-green.svg' },
      sign: { text: 'Sign message', iconPath: '/img/svgs/signature-gray.svg' },
    };
    for (const key of Object.keys(popoverItems)) {
      const popoverOpt = key as PopoverOpt;
      if (popoverOpt === 'richText') {
        continue; // richText not supported yet. Only used for local dev
      }
      const item = popoverItems[popoverOpt];
      const elem = $(`
        <div class="action-toggle-${Xss.escape(popoverOpt)}-sending-option sending-option" data-test="action-toggle-${Xss.escape(popoverOpt)}">
            <span class="option-name">${Xss.escape(item.text)}</span>
        </div>`);
      this.renderCrossOrTick(elem, popoverOpt, this.choices[popoverOpt]);
      elem.on('click', Ui.event.handle(() => this.toggleItemTick(elem, popoverOpt)));
      if (item.iconPath) {
        elem.find('.option-name').prepend(`<img src="${item.iconPath}" />`); // xss-direct
      }
      this.composer.S.cached('sending_options_container').append(elem); // xss-safe-factory
    }
    this.composer.S.cached('title').text(this.composeHeaderText());
  }

  private toggleVisible = (event: JQuery.Event<HTMLElement, null>) => {
    event.stopPropagation();
    const sendingContainer = $('.sending-container');
    sendingContainer.toggleClass('popover-opened');
    if (sendingContainer.hasClass('popover-opened')) {
      $('body').click(Ui.event.handle((elem, event) => {
        if (!this.composer.S.cached('sending_options_container')[0].contains(event.relatedTarget)) {
          sendingContainer.removeClass('popover-opened');
          $('body').off('click');
          this.composer.S.cached('toggle_send_options').off('keydown');
        }
      }));
      this.composer.S.cached('toggle_send_options').on('keydown', Ui.event.handle(async (target, e) => this.keydownHandler(e)));
      const sendingOptions = this.composer.S.cached('sending_options_container').find('.sending-option');
      sendingOptions.hover(function () {
        sendingOptions.removeClass('active');
        $(this).addClass('active');
      });
    } else {
      $('body').off('click');
      this.composer.S.cached('toggle_send_options').off('keydown');
    }
  }

  private keydownHandler = (e: JQuery.Event<HTMLElement, null>): void => {
    const sendingOptions = this.composer.S.cached('sending_options_container').find('.sending-option');
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
      currentActive.click();
    }
  }

  public toggleItemTick(elem: JQuery<HTMLElement>, popoverOpt: PopoverOpt, forceStateTo?: boolean) {
    const currentlyTicked = this.isTicked(elem);
    const newToggleTicked = (typeof forceStateTo !== 'undefined') ? forceStateTo : !currentlyTicked;
    if (newToggleTicked === this.choices[popoverOpt] && newToggleTicked === currentlyTicked) {
      return; // internal state as well as UI state is in sync with newly desired result, nothing to do
    }
    this.choices[popoverOpt] = newToggleTicked;
    if (currentlyTicked && !newToggleTicked) {
      this.renderCrossOrTick(elem, popoverOpt, false);
    }
    if (!currentlyTicked && newToggleTicked) {
      this.renderCrossOrTick(elem, popoverOpt, true);
    }
    this.composer.S.cached('title').text(this.composeHeaderText());
    if (this.choices.encrypt) {
      this.composer.S.cached('compose_table').removeClass('not-encrypted');
      this.composer.S.now('attached_files').removeClass('not-encrypted');
    } else {
      this.composer.S.cached('compose_table').addClass('not-encrypted');
      this.composer.S.now('attached_files').addClass('not-encrypted');
    }
    this.composer.composerSendBtn.resetSendBtn();
    this.composer.showHidePwdOrPubkeyContainerAndColorSendBtn();
  }

  private renderCrossOrTick(elem: JQuery<HTMLElement>, popoverOpt: PopoverOpt, renderTick: boolean) {
    if (renderTick) {
      elem.find('img.icon-tick,img.icon-cross').remove();
      elem.append(`<img class="icon-tick" src="/img/svgs/tick.svg" data-test="icon-toggle-${Xss.escape(popoverOpt)}-tick" />`); // xss-escaped
      elem.css('opacity', '1');
    } else {
      elem.find('img.icon-tick,img.icon-cross').remove();
      elem.append(`<img class="icon-cross" src="/img/red-cross-mark.png" data-test="icon-toggle-${Xss.escape(popoverOpt)}-cross" />`); // xss-escaped
      elem.css('opacity', '0.5');
    }
  }

  private isTicked(popoverItemElem: JQuery<HTMLElement>) {
    return !!popoverItemElem.find('img.icon-tick').length;
  }

  private composeHeaderText(): string {
    if (this.choices.encrypt && this.choices.sign) {
      return Lang.compose.headers.encryptedAndSigned;
    } else if (this.choices.encrypt) {
      return Lang.compose.headers.encrypted;
    } else if (this.choices.sign) {
      return Lang.compose.headers.signed;
    } else {
      return Lang.compose.headers.plain;
    }
  }

}
