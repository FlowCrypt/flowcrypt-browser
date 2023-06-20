/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Dict, Str } from '../../common/core/common.js';
import { FactoryReplyParams, XssSafeFactory } from '../../common/xss-safe-factory.js';
import { IntervalFunction, WebmailElementReplacer } from './setup-webmail-content-script.js';
import { ApiErr } from '../../common/api/shared/api-error.js';
import { Attachment } from '../../common/core/attachment.js';
import { BrowserMsg } from '../../common/browser/browser-msg.js';
import { Catch } from '../../common/platform/catch.js';
import { GlobalStore, LocalDraft } from '../../common/platform/store/global-store.js';
import { Injector } from '../../common/inject.js';
import { PubLookup } from '../../common/api/pub-lookup.js';
import { Notifications } from '../../common/notifications.js';
import { PgpArmor } from '../../common/core/crypto/pgp/pgp-armor.js';
import { Ui } from '../../common/browser/ui.js';
import { WebmailCommon } from '../../common/webmail.js';
import { Xss } from '../../common/platform/xss.js';
import { ClientConfiguration } from '../../common/client-configuration.js';
// todo: can we somehow define a purely relay class for ContactStore to clearly show that crypto-libraries are not loaded and can't be used?
import { ContactStore } from '../../common/platform/store/contact-store.js';
import { MessageRenderer } from '../../common/message-renderer.js';
import { RelayManager } from '../../common/relay-manager.js';
import { MessageInfo } from '../../common/render-message.js';
import { GmailLoaderContext } from './gmail-loader-context.js';
import { JQueryEl } from '../../common/loader-context-interface.js';
import { MessageBody, Mime } from '../../common/core/mime.js';
import { MsgBlock } from '../../common/core/msg-block.js';

export class GmailElementReplacer implements WebmailElementReplacer {
  private debug = false;

  private recipientHasPgpCache: Dict<boolean> = {};
  private pubLookup: PubLookup;
  private webmailCommon: WebmailCommon;
  private currentlyEvaluatingStandardComposeBoxRecipients = false;
  private currentlyReplacingAttachments = false;
  private switchToEncryptedReply = false;
  private removeNextReplyBoxBorders = false;
  private shouldShowEditableSecureReply = false;

  private sel = {
    // gmail_variant=standard|new
    convoRoot: 'div.if',
    convoRootScrollable: '.Tm.aeJ',
    subject: 'h2.hP',
    autoReplies: 'div.brb',
    msgOuter: 'div.adn',
    msgInner: 'div.a3s:visible:not(.undefined), .message_inner_body:visible',
    msgInnerText: 'table.cf.An',
    msgInnerContainingPgp: "div.a3s:not(.undefined):contains('" + PgpArmor.headers('null').begin + "')",
    attachmentsContainerOuter: 'div.hq.gt',
    attachmentsContainerInner: 'div.aQH',
    translatePrompt: '.adI',
    standardComposeWin: '.aaZ:visible',
    settingsBtnContainer: 'div.aeH > div > .fY',
    standardComposeRecipient: 'div.az9 span[email][data-hovercard-id]',
    numberOfAttachments: '.aVW',
    numberOfAttachmentsDigit: '.aVW span:first-child',
    attachmentsButtons: '.aZi',
    draftsList: '.ae4',
  };

  public constructor(
    private readonly factory: XssSafeFactory,
    clientConfiguration: ClientConfiguration,
    private readonly acctEmail: string,
    private readonly messageRenderer: MessageRenderer,
    private readonly injector: Injector,
    private readonly notifications: Notifications,
    private readonly relayManager: RelayManager
  ) {
    this.webmailCommon = new WebmailCommon(acctEmail, injector);
    this.pubLookup = new PubLookup(clientConfiguration);
  }

  public getIntervalFunctions = (): Array<IntervalFunction> => {
    return [
      { interval: 1000, handler: () => this.everything() },
      { interval: 30000, handler: () => this.webmailCommon.addOrRemoveEndSessionBtnIfNeeded() },
    ];
  };

  public setReplyBoxEditable = async () => {
    const replyContainerIframe = $('.reply_message_iframe_container > iframe').last();
    if (replyContainerIframe.length) {
      $(replyContainerIframe).replaceWith(this.factory.embeddedReply(this.getLastMsgReplyParams(this.getGonvoRootEl(replyContainerIframe[0])), true)); // xss-safe-value
    } else {
      await this.replaceStandardReplyBox(undefined, true);
    }
  };

  public reinsertReplyBox = (replyMsgId: string) => {
    const params: FactoryReplyParams = { replyMsgId };
    $('.reply_message_iframe_container:visible').last().append(this.factory.embeddedReply(params, false, true)); // xss-safe-value
  };

  public scrollToReplyBox = (replyMsgId: string) => {
    const convoRootScrollable = $(this.sel.convoRootScrollable);
    if (convoRootScrollable) {
      const replyMsg = $(replyMsgId);
      if (replyMsg) {
        convoRootScrollable.css('scroll-behavior', 'smooth');
        const gmailHeaderHeight = 120;
        const topGap = 80; // so the bottom of the prev message will be visible
        // scroll to the bottom of the element,
        // or to the top of the element if the element's height is bigger than the convoRoot
        /* eslint-disable @typescript-eslint/no-non-null-assertion */
        convoRootScrollable.get(0)!.scrollTop =
          replyMsg.position()!.top + $(replyMsg).height()! - Math.max(0, $(replyMsg).height()! - convoRootScrollable.height()! + gmailHeaderHeight + topGap);
        /* eslint-enable @typescript-eslint/no-non-null-assertion */
      }
    } else if (window.location.hash.match(/^#inbox\/[a-zA-Z]+$/)) {
      // is a conversation view, but no scrollable conversation element
      Catch.report(`Cannot find Gmail scrollable element: ${this.sel.convoRootScrollable}`);
    }
  };

  public scrollToCursorInReplyBox = (replyMsgId: string, cursorOffsetTop: number) => {
    const convoRootScrollable = $(this.sel.convoRootScrollable);
    if (convoRootScrollable) {
      const replyMsg = $(replyMsgId);
      /* eslint-disable @typescript-eslint/no-non-null-assertion */
      const replyMsgOffsetTop = replyMsg.offset()!.top - convoRootScrollable.offset()!.top;
      const bottomGap = 150;
      // check if cursor went above the visible part of convoRootScrollable
      if (replyMsgOffsetTop + cursorOffsetTop < 0) {
        convoRootScrollable.css('scroll-behavior', '');
        convoRootScrollable.get(0)!.scrollTop += replyMsgOffsetTop + cursorOffsetTop;
      }
      // check if cursor went below the visible part of convoRootScrollable
      if (replyMsgOffsetTop + cursorOffsetTop > convoRootScrollable.get(0)!.clientHeight - bottomGap) {
        convoRootScrollable.css('scroll-behavior', '');
        convoRootScrollable.get(0)!.scrollTop += replyMsgOffsetTop + cursorOffsetTop - convoRootScrollable.get(0)!.clientHeight + bottomGap;
      }
      /* eslint-enable @typescript-eslint/no-non-null-assertion */
    }
  };

  private everything = () => {
    this.replaceArmoredBlocks().catch(Catch.reportErr);
    this.replaceAttachments().catch(Catch.reportErr);
    this.replaceComposeDraftLinks();
    this.replaceConvoBtns();
    this.replaceStandardReplyBox().catch(Catch.reportErr);
    this.evaluateStandardComposeRecipients().catch(Catch.reportErr);
    this.addSettingsBtn();
    this.renderLocalDrafts().catch(Catch.reportErr);
    this.messageRenderer.deleteExpired();
  };

  private replaceArmoredBlocks = async () => {
    const emailsContainingPgpBlock = $(this.sel.msgOuter).find(this.sel.msgInnerContainingPgp).not('.evaluated');
    for (const emailContainer of emailsContainingPgpBlock) {
      if (this.debug) {
        console.debug('replaceArmoredBlocks() for of emailsContainingPgpBlock -> emailContainer', emailContainer);
      }
      $(emailContainer).addClass('evaluated');
      if (this.debug) {
        console.debug('replaceArmoredBlocks() for of emailsContainingPgpBlock -> emailContainer added evaluated');
      }
      const msgId = this.determineMsgId(emailContainer);
      let blocks: MsgBlock[] = [];
      let messageInfo: MessageInfo | undefined;
      try {
        ({ messageInfo, blocks } = await this.messageRenderer.msgGetProcessed(msgId));
      } catch (e) {
        this.handleException(e);
        // fill with fallback values from the element
        blocks = Mime.processBody({ text: emailContainer.innerText });
        // todo: print info for offline?
      }
      const setMessageInfo = messageInfo ?? {
        isPwdMsgBasedOnMsgSnippet: MessageRenderer.isPwdMsg(emailContainer.innerText),
        plainSubject: undefined, // todo: take from this.sel.subject?
      };
      if (blocks.length === 0 || (blocks.length === 1 && blocks[0].type === 'plainText')) {
        // only has single block which is plain text
        continue;
      }
      if (!setMessageInfo.from) {
        setMessageInfo.from = this.getFrom(this.getMsgBodyEl(msgId));
      }
      const { renderedXssSafe, blocksInFrames } = this.messageRenderer.renderMsg({ blocks, senderEmail: setMessageInfo.from?.email }, false); // xss-safe-value
      if (!renderedXssSafe) continue;
      $(this.sel.translatePrompt).hide();
      if (this.debug) {
        console.debug('replaceArmoredBlocks() for of emailsContainingPgpBlock -> emailContainer replacing');
      }
      GmailLoaderContext.updateMsgBodyEl_DANGEROUSLY(emailContainer, 'set', renderedXssSafe); // xss-safe-factory: replace_blocks is XSS safe
      if (this.debug) {
        console.debug('replaceArmoredBlocks() for of emailsContainingPgpBlock -> emailContainer replaced');
      }
      await this.messageRenderer.startProcessingInlineBlocks(this.relayManager, this.factory, setMessageInfo, blocksInFrames).catch(Catch.reportErr);
    }
  };

  private addfcConvoIcon = (containerSel: JQueryEl, iconHtml: string, iconSel: string, onClick: () => void) => {
    containerSel.addClass('appended').children('.use_secure_reply, .show_original_conversation').remove(); // remove previous FlowCrypt buttons, if any
    Xss.sanitizeAppend(containerSel, iconHtml)
      .children(iconSel)
      .off()
      .on('click', Ui.event.prevent('double', Catch.try(onClick)));
  };

  private isEncrypted = (): boolean => {
    return !!$('iframe.pgp_block').filter(':visible').length;
  };

  private replaceConvoBtns = (force = false) => {
    const convoUpperIcons = $('div.ade:visible');
    const useEncryptionInThisConvo = this.isEncrypted() || force;
    // reply buttons
    const visibleReplyBtns = $('td.acX:visible');
    if (visibleReplyBtns.not('.replaced, .inserted').length) {
      // last reply button in convo gets replaced
      if (this.isEncrypted()) {
        $(this.sel.autoReplies).remove(); // make smart replies available for non-encrypted conversations
      }
      const convoReplyBtnsToReplace = visibleReplyBtns.not('.replaced, .inserted');
      const convoReplyBtnsArr = convoReplyBtnsToReplace.get();
      // only replace the last one FlowCrypt reply button if does not have any buttons replaced yet, and only replace the last one
      for (const elem of convoReplyBtnsArr) {
        $(elem).addClass('inserted');
        const gmailReplyBtn = $(elem).find('[aria-label="Reply"]');
        const secureReplyBtn = $(this.factory.btnSecureReply()).insertAfter(gmailReplyBtn); // xss-safe-factory
        secureReplyBtn.addClass(gmailReplyBtn.attr('class') || '');
        secureReplyBtn.off();
        secureReplyBtn.on(
          'focusin',
          Ui.event.handle(target => {
            $(target).addClass('T-I-JO');
          })
        );
        secureReplyBtn.on(
          'focusout',
          Ui.event.handle(target => {
            $(target).removeClass('T-I-JO');
          })
        );
        secureReplyBtn.on(
          'mouseenter',
          Ui.event.handle(target => {
            $(target).addClass('T-I-JW');
          })
        );
        secureReplyBtn.on(
          'mouseleave',
          Ui.event.handle(target => {
            $(target).removeClass('T-I-JW');
          })
        );
        secureReplyBtn.on(
          'click',
          Ui.event.handle((el, ev: JQuery.Event) => this.actionActivateSecureReplyHandler(el, ev))
        );
        secureReplyBtn.keydown(event => {
          if (event.key === 'Enter') {
            event.stopImmediatePropagation();
            $(secureReplyBtn).trigger('click');
          }
        });
      }
    }
    // conversation top-right icon buttons
    if (convoUpperIcons.length) {
      if (useEncryptionInThisConvo) {
        if (!convoUpperIcons.is('.appended') || convoUpperIcons.find('.use_secure_reply').length) {
          // either not appended, or appended icon is outdated (convo switched to encrypted)
          this.addfcConvoIcon(convoUpperIcons, this.factory.btnWithoutFc(), '.show_original_conversation', () => {
            convoUpperIcons.find('.gZ').trigger('click');
          });
        }
      }
    }
  };

  private actionActivateSecureReplyHandler = async (btn: HTMLElement, event: JQuery.Event) => {
    event.stopImmediatePropagation();
    if ($('#switch_to_encrypted_reply').length) {
      $('#switch_to_encrypted_reply').trigger('click');
      return;
    }
    const messageContainer = $(btn.closest('.h7') as HTMLElement);
    if (messageContainer.is(':last-child')) {
      if (this.isEncrypted()) {
        await this.setReplyBoxEditable();
      } else {
        await this.replaceStandardReplyBox(undefined, true);
      }
    } else {
      this.insertEncryptedReplyBox(messageContainer);
    }
  };

  private replaceComposeDraftLinks = () => {
    const allContenteditableEls = $("div[contenteditable='true']").not('.evaluated').addClass('evaluated');
    for (const contenteditableEl of allContenteditableEls) {
      const contenteditable = $(contenteditableEl);
      let draftId = '';
      const legacyDraftLinkMatch = contenteditable
        .html()
        .substring(0, 1000)
        .match(/\[flowcrypt:link:draft_compose:([0-9a-fr\-]+)]/);
      if (legacyDraftLinkMatch) {
        const [, legacyDraftId] = legacyDraftLinkMatch;
        draftId = legacyDraftId;
      }
      const draftHtml = contenteditable.html();
      // Used some hacky way to check if draft is compose draft or draft from thread reply
      // Reply `table` element (class named aoP) has avatar image(class named ajn). Compose draft doesn't have it
      // For thread reply draft, we don't need to call openComposeWin
      // Reply draft window will be replaced by secure compose by replaceStandardReplyBox function
      const isComposeDraft = $(contenteditable).closest('table.aoP').find('img.ajn').length < 1;
      if (PgpArmor.isEncryptedMsg(draftHtml) && isComposeDraft) {
        draftId = String($(contenteditable).closest('.I5').find('input[name="draft"]')?.val())?.split(':')[1] ?? '';
      }
      if (draftId) {
        // close original draft window
        const closeGmailComposeWindow = (target: JQuery<HTMLElement>) => {
          const mouseUpEvent = document.createEvent('Event');
          mouseUpEvent.initEvent('mouseup', true, true); // Gmail listens for the mouseup event, not click
          target.closest('.nH.Hd').find('.Ha')[0].dispatchEvent(mouseUpEvent); // jquery's trigger('mouseup') doesn't work for some reason
        };
        if (this.injector.openComposeWin(draftId)) {
          closeGmailComposeWindow(contenteditable);
        }
      }
    }
  };

  /**
   * Related bugs (fixed):
   * https://github.com/FlowCrypt/flowcrypt-browser/issues/1870
   * https://github.com/FlowCrypt/flowcrypt-browser/issues/2309
   * https://github.com/FlowCrypt/flowcrypt-browser/issues/3180
   */
  private replaceAttachments = async () => {
    if (this.currentlyReplacingAttachments) {
      return;
    }
    try {
      this.currentlyReplacingAttachments = true;
      for (const attachmentsContainerEl of $(this.sel.attachmentsContainerInner).not('.evaluated')) {
        const attachmentsContainer = $(attachmentsContainerEl);
        if (this.debug) {
          console.debug('replaceAttachments() for of -> attachmentsContainer, setting evaluated', attachmentsContainer);
        }
        attachmentsContainer.addClass('evaluated');
        // In the exact moment we check, only some of the attachments of a message may be loaded into the DOM, while others won't
        // Because of that we need to listen to new attachments being inserted into the DOM
        const attachmentsContainerObserver = new MutationObserver(async mutationsList => {
          for (const mutation of mutationsList) {
            if (mutation.type === 'childList') {
              for (const addedNode of mutation.addedNodes) {
                if (this.debug) {
                  console.debug(
                    'replaceAttachments() for of -> attachmentsContainer MutationObserver -> processNewPgpAttachments(addedNode)',
                    $(addedNode as HTMLElement)
                  );
                }
                await this.processNewPgpAttachments($(addedNode as HTMLElement), attachmentsContainer);
              }
            }
          }
        });
        if (this.debug) {
          console.debug('replaceAttachments() for of -> attachmentsContainer enabling MutationObserver');
        }
        attachmentsContainerObserver.observe(attachmentsContainerEl, { subtree: true, childList: true });
        if (this.debug) {
          console.debug('replaceAttachments() for of -> processNewPgpAttachments(attachmentsContainerEl)');
        }
        await this.processNewPgpAttachments(attachmentsContainer.children().not('.evaluated'), attachmentsContainer);
      }
    } finally {
      this.currentlyReplacingAttachments = false;
    }
  };

  private processNewPgpAttachments = async (pgpAttachments: JQuery<HTMLElement>, attachmentsContainer: JQuery<HTMLElement>) => {
    if (this.debug) {
      console.debug('processNewPgpAttachments()');
    }
    const newPgpAttachments = this.filterAttachments(pgpAttachments, Attachment.webmailNamePattern);
    newPgpAttachments.addClass('evaluated');
    if (newPgpAttachments.length) {
      const msgId = this.determineMsgId(attachmentsContainer);
      if (msgId) {
        Xss.sanitizePrepend(newPgpAttachments, this.factory.embeddedAttachmentStatus('Getting file info..' + Ui.spinner('green')));
        try {
          if (this.debug) {
            console.debug('processNewPgpAttachments() -> msgGet may take some time');
          }
          const { attachments, messageInfo, body } = await this.messageRenderer.msgGetProcessed(msgId);
          if (this.debug) {
            console.debug('processNewPgpAttachments() -> msgGet done -> processAttachments', attachments);
          }
          await this.processAttachments(msgId, attachments, attachmentsContainer, messageInfo, body, false);
        } catch (e) {
          this.handleException(e, $(newPgpAttachments).find('.attachment_loader'));
        }
      } else {
        $(newPgpAttachments).prepend(this.factory.embeddedAttachmentStatus('Unknown message id')); // xss-safe-factory
      }
    }
  };

  private processAttachments = async (
    msgId: string,
    attachments: Attachment[],
    attachmentsContainerInner: JQueryEl,
    messageInfo: MessageInfo,
    body: MessageBody,
    skipGoogleDrive: boolean
  ) => {
    if (this.debug) {
      console.debug('processAttachments()', attachments);
    }
    const msgEl = this.getMsgBodyEl(msgId);
    if (!messageInfo.from?.email) {
      messageInfo.from = this.getFrom(msgEl);
    }
    const loaderContext = new GmailLoaderContext(this.factory, msgEl, attachmentsContainerInner);
    attachmentsContainerInner = $(attachmentsContainerInner);
    attachmentsContainerInner.parent().find(this.sel.numberOfAttachments).hide();
    let nRenderedAttachments = attachments.length;
    for (const a of attachments) {
      const attachmentSel = this.filterAttachments(
        attachmentsContainerInner.children().not('.attachment_processed'),
        new RegExp(`^${Str.regexEscape(a.name || 'noname')}$`)
      ).first();
      const renderStatus = await this.messageRenderer.processAttachment(
        a,
        body,
        attachments,
        loaderContext,
        attachmentSel,
        msgId,
        messageInfo,
        skipGoogleDrive
      );
      if (renderStatus === 'hidden') {
        nRenderedAttachments--;
      }
    }
    if (nRenderedAttachments !== attachments.length) {
      // according to #4200, no point in showing "download all" button if at least one attachment is encrypted etc.
      $(this.sel.attachmentsButtons).hide();
    }
    if (nRenderedAttachments >= 2) {
      // Aligned with Gmail, the label is shown only if there are 2 or more attachments
      attachmentsContainerInner.parent().find(this.sel.numberOfAttachmentsDigit).text(nRenderedAttachments);
      attachmentsContainerInner.parent().find(this.sel.numberOfAttachments).show();
    }
    if (nRenderedAttachments === 0) {
      attachmentsContainerInner.parents(this.sel.attachmentsContainerOuter).first().hide();
    }
    if (!skipGoogleDrive) {
      await this.processGoogleDriveAttachments(msgId, loaderContext.msgEl, attachmentsContainerInner, messageInfo);
    }
  };

  private processGoogleDriveAttachments = async (msgId: string, msgEl: JQueryEl, attachmentsContainerInner: JQueryEl, messageInfo: MessageInfo) => {
    const notProcessedAttachmentsLoaders = attachmentsContainerInner.find('.attachment_loader');
    if (notProcessedAttachmentsLoaders.length && msgEl.find('.gmail_drive_chip, a[href^="https://drive.google.com/file"]').length) {
      // replace google drive attachments - they do not get returned by Gmail API thus did not get replaced above
      const googleDriveAttachments: Attachment[] = [];
      for (const attachmentLoaderEl of notProcessedAttachmentsLoaders) {
        const downloadUrl = $(attachmentLoaderEl).parent().attr('download_url');
        if (downloadUrl) {
          const meta = downloadUrl.split(':');
          googleDriveAttachments.push(
            new Attachment({
              msgId,
              name: meta[1],
              type: meta[0],
              url: `${meta[2]}:${meta[3]}`,
              treatAs: 'encryptedFile',
            })
          );
          // todo: start download
        } else {
          console.info('Missing Google Drive attachments download_url');
        }
      }
      await this.processAttachments(msgId, googleDriveAttachments, attachmentsContainerInner, messageInfo, {}, true);
    }
  };

  private filterAttachments = (potentialMatches: JQueryEl | HTMLElement, regExp: RegExp) => {
    return $(potentialMatches)
      .filter('span.aZo:visible, span.a5r:visible')
      .find('span.aV3')
      .filter(function () {
        const name = $(this).text().trim();
        return regExp.test(name);
      })
      .closest('span.aZo, span.a5r');
  };

  private determineMsgId = (innerMsgEl: HTMLElement | JQueryEl) => {
    const parents = $(innerMsgEl).parents(this.sel.msgOuter);
    return parents.attr('data-legacy-message-id') || parents.attr('data-message-id') || '';
  };

  private getMsgBodyEl = (msgId: string) => {
    return $(this.sel.msgOuter).filter(`[data-legacy-message-id="${msgId}"]`).find(this.sel.msgInner);
  };

  private getFrom = (msgEl: HTMLElement | JQueryEl) => {
    const from = $(msgEl).closest('.gs').find('span.gD').attr('email')?.toLowerCase();
    return from ? Str.parseEmail(from) : undefined;
  };

  private getLastMsgReplyParams = (convoRootEl: JQueryEl): FactoryReplyParams => {
    return { replyMsgId: this.determineMsgId($(convoRootEl).find(this.sel.msgInner).last()) };
  };

  private getGonvoRootEl = (anyInnerElement: HTMLElement) => {
    return $(anyInnerElement).closest('div.if, td.Bu').first();
  };

  private insertEncryptedReplyBox = (messageContainer: JQuery<HTMLElement>) => {
    const msgIdElement = messageContainer.find('[data-legacy-message-id], [data-message-id]');
    const msgId = msgIdElement.attr('data-legacy-message-id') || msgIdElement.attr('data-message-id');
    const replyParams: FactoryReplyParams = { replyMsgId: msgId, removeAfterClose: true };
    const secureReplyBoxXssSafe = /* xss-safe-factory */ `<div class="remove_borders reply_message_iframe_container inserted">${this.factory.embeddedReply(
      replyParams,
      true,
      true
    )}</div>`;
    messageContainer.find('.adn.ads').parent().append(secureReplyBoxXssSafe); // xss-safe-factory
  };

  private replaceStandardReplyBox = async (msgId?: string, force = false) => {
    const legacyDraftReplyRegex = new RegExp(/\[(flowcrypt|cryptup):link:draft_reply:([0-9a-fr\-]+)]/);
    const newReplyBoxes = $('div.nr.tMHS5d, td.amr > div.nr, div.gA td.I5').not('.reply_message_evaluated').filter(':visible').get();
    if (newReplyBoxes.length) {
      // cache for subseqent loop runs
      const convoRootEl = this.getGonvoRootEl(newReplyBoxes[0]);
      const replyParams = this.getLastMsgReplyParams(convoRootEl);
      if (msgId) {
        replyParams.replyMsgId = msgId;
      }
      const hasDraft = newReplyBoxes.filter(replyBox => {
        const msgText = $(replyBox).find(this.sel.msgInnerText).text();
        return PgpArmor.isEncryptedMsg(msgText) || msgText.substring(0, 1000).match(legacyDraftReplyRegex);
      }).length;
      const doReplace = Boolean(
        convoRootEl.find('iframe.pgp_block').filter(':visible').closest('.h7').is(':last-child') || (convoRootEl.is(':visible') && force) || hasDraft
      );
      let midConvoDraft = false;
      if (doReplace) {
        for (const replyBoxEl of newReplyBoxes.reverse()) {
          // looping in reverse
          const replyBox = $(replyBoxEl);
          const msgInnerText = replyBox.find(this.sel.msgInnerText);
          if (msgInnerText.length && !msgInnerText.find('[contenteditable]').length) {
            // div[contenteditable] is not loaded yet (e.g. when refreshing a thread), do nothing
            continue;
          }
          const replyBoxInnerText = msgInnerText.text().trim();
          const legacyDraftReplyLinkMatch = replyBoxInnerText.substring(0, 1000).match(legacyDraftReplyRegex);
          if (legacyDraftReplyLinkMatch) {
            // legacy reply draft
            replyParams.draftId = legacyDraftReplyLinkMatch[2];
          } else if (PgpArmor.isEncryptedMsg(replyBoxInnerText)) {
            // reply draft
            replyParams.draftId = document.querySelector('[name=draft]')?.getAttribute('value')?.split(':')[1] ?? '';
          } else if (msgInnerText.length && !this.switchToEncryptedReply) {
            // plain reply
            this.showSwitchToEncryptedReplyWarningIfNeeded(replyBox);
            replyBox.addClass('reply_message_evaluated');
            continue;
          }
          this.switchToEncryptedReply = false;
          if (this.removeNextReplyBoxBorders) {
            replyBox.addClass('remove_borders');
            this.removeNextReplyBoxBorders = false;
          }
          if (!midConvoDraft) {
            // either is a draft in the middle, or the convo already had (last) box replaced: should also be useless draft
            const isReplyButtonView = replyBoxEl.className.includes('nr');
            const replyBoxes = document.querySelectorAll('iframe.reply_message');
            const alreadyHasSecureReplyBox = replyBoxes.length > 0;
            const secureReplyBoxXssSafe = /* xss-safe-factory */ `
              <div class="remove_borders reply_message_iframe_container">
                ${this.factory.embeddedReply(replyParams, this.shouldShowEditableSecureReply || alreadyHasSecureReplyBox)}
              </div>
            `;
            this.shouldShowEditableSecureReply = !isReplyButtonView;
            if (hasDraft || alreadyHasSecureReplyBox) {
              replyBox.addClass('reply_message_evaluated remove_borders').parent().append(secureReplyBoxXssSafe); // xss-safe-factory
              replyBox.hide();
            } else if (isReplyButtonView) {
              replyBox.replaceWith(secureReplyBoxXssSafe); // xss-safe-factory
            } else {
              const deleteReplyEl = document.querySelector('.oh.J-Z-I.J-J5-Ji.T-I-ax7');
              if (deleteReplyEl) {
                // Remove standard reply by clicking `delete` button
                (deleteReplyEl as HTMLElement).click();
              }
            }
            midConvoDraft = true; // last box was processed first (looping in reverse), and all the rest must be drafts
          }
        }
      }
    }
  };

  // loaderEl is a loader reference in case we're processing an attachment
  // todo: we could also re-use a common method like this in Inbox
  private handleException = (e: unknown, loaderEl?: JQueryEl) => {
    if (ApiErr.isAuthErr(e)) {
      this.notifications.showAuthPopupNeeded(this.acctEmail);
      loaderEl?.text('Auth needed');
    } else if (ApiErr.isNetErr(e)) {
      loaderEl?.text('Network error');
      // todo:    } else if (ApiErr.isInPrivateMode(e)) {
      //      this.notifications.show(`FlowCrypt does not work in a Firefox Private Window (or when Firefox Containers are used). Please try in a standard window.`);
    } else {
      if (!ApiErr.isServerErr(e) && !ApiErr.isMailOrAcctDisabledOrPolicy(e) && !ApiErr.isNotFound(e)) {
        Catch.reportErr(e);
      }
      loaderEl?.text('Failed to load');
      // todo: show somenotification if this error happened when replacing armored blocks?
    }
  };

  private showSwitchToEncryptedReplyWarningIfNeeded = (reployBox: JQueryEl) => {
    const showSwitchToEncryptedReplyWarning = reployBox.closest('div.h7').find(this.sel.msgOuter).find('iframe.pgp_block').hasClass('encryptedMsg');
    if (showSwitchToEncryptedReplyWarning) {
      const notification = $('<div class="error_notification">The last message was encrypted, but you are composing a reply without encryption. </div>');
      const switchToEncryptedReply = $('<a href id="switch_to_encrypted_reply">Switch to encrypted reply</a>');
      switchToEncryptedReply.on(
        'click',
        Ui.event.handle((el, ev: JQuery.Event) => {
          ev.preventDefault();
          $(el).closest('.reply_message_evaluated').removeClass('reply_message_evaluated');
          this.removeNextReplyBoxBorders = true;
          this.switchToEncryptedReply = true;
          notification.remove();
        })
      );
      notification.append(switchToEncryptedReply); // xss-direct
      reployBox.prepend(notification); // xss-direct
    }
  };

  private evaluateStandardComposeRecipients = async () => {
    if (!this.currentlyEvaluatingStandardComposeBoxRecipients) {
      this.currentlyEvaluatingStandardComposeBoxRecipients = true;
      for (const standardComposeWinEl of $(this.sel.standardComposeWin)) {
        const standardComposeWin = $(standardComposeWinEl);
        const recipients = standardComposeWin
          .find(this.sel.standardComposeRecipient)
          .get()
          .map(e => $(e).attr('email'))
          .filter(e => !!e);
        if (!recipients.length || $(this.sel.standardComposeWin).find('.close_gmail_compose_window').length === 1) {
          // draft, but not the secure one
          standardComposeWin.find('.recipients_use_encryption').remove();
        } else {
          let everyoneUsesEncryption = true;
          for (const email of recipients) {
            if (email) {
              const cache = this.recipientHasPgpCache[email];
              if (!Str.isEmailValid(email)) {
                everyoneUsesEncryption = false;
                break;
              }
              if (typeof cache === 'undefined') {
                try {
                  const contactWithPubKeys = await ContactStore.getOneWithAllPubkeys(undefined, email);
                  if (contactWithPubKeys && contactWithPubKeys.sortedPubkeys && contactWithPubKeys.sortedPubkeys.length > 0) {
                    this.recipientHasPgpCache[email] = true;
                  } else if ((await this.pubLookup.lookupEmail(email)).pubkeys.length) {
                    this.recipientHasPgpCache[email] = true;
                  } else {
                    this.recipientHasPgpCache[email] = false;
                  }
                  if (!this.recipientHasPgpCache[email]) {
                    everyoneUsesEncryption = false;
                    break;
                  }
                } catch (e) {
                  ApiErr.reportIfSignificant(e);
                  // this is a low-importance request, so evaluate hasPgp as false on errors
                  // this way faulty requests wouldn't unnecessarily repeat and overwhelm Attester
                  this.recipientHasPgpCache[email] = false;
                  everyoneUsesEncryption = false;
                  break;
                }
              } else if (cache === false) {
                everyoneUsesEncryption = false;
                break;
              }
            } else {
              everyoneUsesEncryption = false;
              break;
            }
          }
          if (everyoneUsesEncryption) {
            if (!standardComposeWin.find('.recipients_use_encryption').length) {
              const prependable = standardComposeWin.find('div.az9 span[email]').first().parents('form').first();
              prependable.prepend(this.factory.btnRecipientsUseEncryption('gmail')); // xss-safe-factory
              prependable.find('a').on(
                'click',
                Ui.event.handle(() => {
                  this.injector.openComposeWin();
                })
              );
            }
          } else {
            standardComposeWin.find('.recipients_use_encryption').remove();
          }
        }
      }
      this.currentlyEvaluatingStandardComposeBoxRecipients = false;
    }
  };

  private addSettingsBtn = () => {
    if (window.location.hash.startsWith('#settings')) {
      const settingsBtnContainer = $(this.sel.settingsBtnContainer);
      if (settingsBtnContainer.length && !settingsBtnContainer.find('#fc_settings_btn').length) {
        settingsBtnContainer.children().last().before(this.factory.btnSettings('gmail')); // xss-safe-factory
        settingsBtnContainer.find('#fc_settings_btn').on(
          'click',
          Ui.event.handle(() => BrowserMsg.send.bg.settings({ acctEmail: this.acctEmail }))
        );
      }
    }
  };

  private renderLocalDrafts = async () => {
    if (window.location.hash === '#drafts') {
      const storage = await GlobalStore.get(['local_drafts']);
      if (!storage.local_drafts) {
        return;
      }
      const offlineComposeDrafts: Dict<LocalDraft> = {};
      for (const draftId in storage.local_drafts) {
        if (draftId.startsWith('local-draft-compose-') && storage.local_drafts[draftId].acctEmail === this.acctEmail) {
          offlineComposeDrafts[draftId] = storage.local_drafts[draftId];
        }
      }
      let offlineDraftsContainer = $(this.sel.draftsList).find('#fc_offline_drafts');
      if (Object.keys(offlineComposeDrafts).length) {
        const offlineComposeDraftIds = Object.keys(offlineComposeDrafts);
        const draftIdsSortedByTimestamp = offlineComposeDraftIds.sort((a, b) => {
          return offlineComposeDrafts[b].timestamp - offlineComposeDrafts[a].timestamp;
        });
        if (offlineDraftsContainer.data('rendered-drafts') === draftIdsSortedByTimestamp.join(',')) {
          // already rendered
          return;
        }
        offlineDraftsContainer = $('<div id="fc_offline_drafts"><h4>FlowCrypt offline drafts:</h4></div>'); // xss-safe-value
        offlineDraftsContainer.data('rendered-drafts', draftIdsSortedByTimestamp.join(','));
        $(this.sel.draftsList).find('#fc_offline_drafts').remove();
        $(this.sel.draftsList).append(offlineDraftsContainer); // xss-safe-factory
        for (const draftId of draftIdsSortedByTimestamp) {
          const draft = offlineComposeDrafts[draftId];
          const draftLink = $(`<a href>${new Date(draft.timestamp).toLocaleString()}</a>`);
          draftLink.on('click', event => {
            event.preventDefault();
            this.injector.openComposeWin(draftId);
          });
          offlineDraftsContainer.append(draftLink); // xss-safe-value
        }
      } else {
        offlineDraftsContainer.remove();
      }
    }
  };
}
