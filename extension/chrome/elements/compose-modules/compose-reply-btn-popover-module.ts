/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Xss } from '../../../js/common/platform/xss.js';
import { ViewModule } from '../../../js/common/view-module.js';
import { ComposeView } from '../compose.js';

export type ReplyOptions = 'a_reply' | 'a_reply_all' | 'a_forward';

export class ComposeReplyBtnPopoverModule extends ViewModule<ComposeView> {
  /* eslint-disable @typescript-eslint/naming-convention */
  private popoverItems: Record<ReplyOptions, { text: string; iconPath: string }> = {
    a_reply: { text: 'Reply', iconPath: '/img/reply-icon.png' },
    a_reply_all: { text: 'Reply All', iconPath: '/img/reply-all-icon.png' },
    a_forward: { text: 'Forward', iconPath: '/img/forward-icon.png' },
  };
  /* eslint-enable @typescript-eslint/naming-convention */

  public setHandlers = (): void => {
    this.view.S.cached('toggle_reply_options').on(
      'click',
      this.view.setHandler((el, ev) => this.toggleVisible(ev))
    );
  };

  public render = async (isReply = true) => {
    if (!isReply) {
      $('.reply-container').hide();
    }
    for (const key of Object.keys(this.popoverItems)) {
      const option = key as ReplyOptions;
      const item = this.popoverItems[option];
      const elem = $(`
        <div class="action-toggle-key-reply-option reply-option" id="popover_${key}_option" data-test="action-toggle-${Xss.escape(key)}">
            <span class="option-name">${Xss.escape(item.text)}</span>
        </div>`);
      elem.on(
        'click',
        this.view.setHandler(() => this.didOptionClick(option))
      );
      elem.find('.option-name').prepend(`<img src="${item.iconPath}" />`); // xss-direct
      this.view.S.cached('reply_options_container').append(elem); // xss-safe-factory
    }
  };

  public changeOptionImage = (option: ReplyOptions) => {
    $('.reply-options-icon').attr('src', this.popoverItems[option].iconPath);
  };

  private didOptionClick = async (option: ReplyOptions) => {
    await this.view.renderModule.changeReplyOption(option);
    this.changeOptionImage(option);
  };

  private toggleVisible = (event: JQuery.TriggeredEvent<HTMLElement>) => {
    event.stopPropagation();
    const replyContainer = $('.reply-container');
    replyContainer.toggleClass('popover-opened');
    const popoverClickHandler = this.view.setHandler((elem, event) => {
      const ev = event as JQuery.BlurEvent<HTMLElement>;
      if (!this.view.S.cached('reply_options_container')[0].contains(ev.relatedTarget as HTMLElement)) {
        replyContainer.removeClass('popover-opened');
        $('body').off('click', popoverClickHandler);
      }
    });
    if (replyContainer.hasClass('popover-opened')) {
      $('body').on('click', popoverClickHandler);
      const replyOptions = this.view.S.cached('reply_options_container').find('.reply-option');
      replyOptions.hover(function () {
        replyOptions.removeClass('active');
        $(this).addClass('active');
      });
    } else {
      $('body').off('click', popoverClickHandler);
    }
  };
}
