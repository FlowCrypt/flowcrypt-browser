/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { Catch } from '../../../js/common/platform/catch.js';
import { ComposerComponent } from './composer-abstract-component.js';

export class ComposerSize extends ComposerComponent {

  public composeWindowIsMinimized = false;

  private FULL_WINDOW_CLASS = 'full_window';
  private lastReplyBoxTableHeight = 0;
  private composeWindowIsMaximized = false;
  private refBodyHeight?: number;

  public initActions = () => {
    $('body').click(event => {
      const target = $(event.target);
      if (this.composeWindowIsMaximized && target.is($('body'))) {
        this.minimizeComposerWindow();
      }
    });
    if (!this.view.isReplyBox) {
      $('.minimize_new_message').click(this.view.setHandler(() => this.minimizeComposerWindow()));
      $('.popout').click(this.view.setHandler(async () => {
        this.composer.S.cached('body').hide(); // Need to hide because it seems laggy on some devices
        await this.toggleFullScreen();
        this.composer.S.cached('body').show();
      }));
    }
  }

  public onComposeTableRender = () => {
    Catch.setHandledTimeout(() => { // delay automatic resizing until a second later
      // we use veryslowspree for reply box because hand-resizing the main window will cause too many events
      // we use spree (faster) for new messages because rendering of window buttons on top right depend on it, else visible lag shows
      $(window).resize(this.view.setHandlerPrevent(this.view.isReplyBox ? 'veryslowspree' : 'spree', () => this.windowResized().catch(Catch.reportErr)));
      this.composer.input.squire.addEventListener('keyup', () => this.view.setHandlerPrevent('slowspree', () => this.windowResized().catch(Catch.reportErr)));
    }, 1000);
  }

  public resizeComposeBox = (addExtra: number = 0) => {
    if (this.view.isReplyBox) {
      this.composer.S.cached('input_text').css('max-width', (this.composer.S.cached('body').width()! - 20) + 'px'); // body should always be present
      let minHeight = 0;
      let currentHeight = 0;
      if (this.composer.S.cached('compose_table').is(':visible')) {
        currentHeight = this.composer.S.cached('compose_table').outerHeight() || 0;
        minHeight = 260;
      } else if (this.composer.S.cached('reply_msg_successful').is(':visible')) {
        currentHeight = this.composer.S.cached('reply_msg_successful').outerHeight() || 0;
      } else {
        currentHeight = this.composer.S.cached('prompt').outerHeight() || 0;
      }
      if (currentHeight !== this.lastReplyBoxTableHeight && Math.abs(currentHeight - this.lastReplyBoxTableHeight) > 2) { // more then two pixel difference compared to last time
        this.lastReplyBoxTableHeight = currentHeight;
        BrowserMsg.send.setCss(this.view.parentTabId, { selector: `iframe#${this.view.frameId}`, css: { height: `${(Math.max(minHeight, currentHeight) + addExtra)}px` } });
      }
    } else {
      this.composer.S.cached('input_text').css('max-width', '');
      this.resizeInput();
      this.composer.S.cached('input_text').css('max-width', $('.text_container').width()! - 8 + 'px');
    }
  }

  /**
   * On Firefox, we have to manage textbox height manually. Only applies to composing new messages
   * (else ff will keep expanding body element beyond frame view)
   * A decade old firefox bug is the culprit: https://bugzilla.mozilla.org/show_bug.cgi?id=202081
   *
   * @param updateRefBodyHeight - set to true to take a new snapshot of intended html body height
   */
  public setInputTextHeightManuallyIfNeeded = (updateRefBodyHeight: boolean = false) => {
    if (!this.view.isReplyBox && Catch.browser().name === 'firefox') {
      this.composer.S.cached('input_text').css('height', '0');
      let cellHeightExceptText = 0;
      for (const cell of this.composer.S.cached('all_cells_except_text')) {
        cellHeightExceptText += $(cell).is(':visible') ? ($(cell).parent('tr').height() || 0) + 1 : 0; // add a 1px border height for each table row
      }
      if (updateRefBodyHeight || !this.refBodyHeight) {
        this.refBodyHeight = this.composer.S.cached('body').height() || 605;
      }
      const attListHeight = $("#att_list").height() || 0;
      const inputTextVerticalPadding = parseInt(this.composer.S.cached('input_text').css('padding-top')) + parseInt(this.composer.S.cached('input_text').css('padding-bottom'));
      const iconShowPrevMsgHeight = this.composer.S.cached('triple_dot').outerHeight(true) || 0;
      this.composer.S.cached('input_text').css('height', this.refBodyHeight - cellHeightExceptText - attListHeight - inputTextVerticalPadding - iconShowPrevMsgHeight);
    }
  }

  public resizeInput = (inputs?: JQuery<HTMLElement>) => {
    if (!inputs) {
      inputs = this.composer.S.cached('recipients_inputs'); // Resize All Inputs
    }
    inputs.css('width', '100%'); // this indeed seems to effect the line below (noticeable when maximizing / back to default)
    for (const inputElement of inputs) {
      const jqueryElem = $(inputElement);
      const containerWidth = Math.floor(jqueryElem.parent().innerWidth()!);
      let additionalWidth = Math.ceil(Number(jqueryElem.css('padding-left').replace('px', '')) + Number(jqueryElem.css('padding-right').replace('px', '')));
      const minInputWidth = 150;
      let offset = 0;
      if (jqueryElem.next().length) {
        additionalWidth += Math.ceil(jqueryElem.next().outerWidth()!);
      }
      const lastRecipient = jqueryElem.siblings('.recipients').children().last();
      if (lastRecipient.length && lastRecipient.position().left + lastRecipient.outerWidth()! + minInputWidth + additionalWidth < containerWidth) {
        offset = Math.ceil(lastRecipient.position().left + lastRecipient.outerWidth()!);
      }
      jqueryElem.css('width', (containerWidth - offset - additionalWidth - 11) + 'px');
    }
  }

  private windowResized = async () => {
    this.resizeComposeBox();
    this.setInputTextHeightManuallyIfNeeded(true);
    if (this.composer.S.cached('recipients_placeholder').is(':visible')) {
      await this.composer.recipients.setEmailsPreview(this.composer.recipients.getRecipients());
    }
  }

  private minimizeComposerWindow = () => {
    if (this.composeWindowIsMaximized) {
      this.addOrRemoveFullScreenStyles(this.composeWindowIsMinimized);
    }
    BrowserMsg.send.setCss(this.view.parentTabId, {
      selector: `iframe#${this.view.frameId}, div#new_message`,
      css: { height: this.composeWindowIsMinimized ? '' : this.composer.S.cached('header').css('height') },
    });
    this.composeWindowIsMinimized = !this.composeWindowIsMinimized;
  }

  private toggleFullScreen = async () => {
    if (this.composeWindowIsMinimized) {
      this.minimizeComposerWindow();
    }
    this.addOrRemoveFullScreenStyles(!this.composeWindowIsMaximized);
    if (!this.composeWindowIsMaximized) {
      this.composer.S.cached('icon_popout').attr('src', '/img/svgs/minimize.svg');
    } else {
      this.composer.S.cached('icon_popout').attr('src', '/img/svgs/maximize.svg');
    }
    if (this.composer.S.cached('recipients_placeholder').is(':visible')) {
      await this.composer.recipients.setEmailsPreview(this.composer.recipients.getRecipients());
    }
    this.composeWindowIsMaximized = !this.composeWindowIsMaximized;
  }

  private addOrRemoveFullScreenStyles = (add: boolean) => {
    if (add) {
      this.composer.S.cached('body').addClass(this.FULL_WINDOW_CLASS);
      BrowserMsg.send.addClass(this.view.parentTabId, { class: this.FULL_WINDOW_CLASS, selector: 'div#new_message' });
    } else {
      this.composer.S.cached('body').removeClass(this.FULL_WINDOW_CLASS);
      BrowserMsg.send.removeClass(this.view.parentTabId, { class: this.FULL_WINDOW_CLASS, selector: 'div#new_message' });
    }
  }

}
