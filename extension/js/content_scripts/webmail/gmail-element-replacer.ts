/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Dict, Str } from '../../common/core/common.js';
import { FactoryReplyParams, WebmailVariantString, XssSafeFactory } from '../../common/xss-safe-factory.js';
import { GmailParser, GmailRes } from '../../common/api/email-provider/gmail/gmail-parser.js';
import { IntervalFunction, WebmailElementReplacer } from './setup-webmail-content-script.js';
import { AjaxErr } from '../../common/api/error/api-error-types.js';
import { ApiErr } from '../../common/api/error/api-error.js';
import { Att } from '../../common/core/att.js';
import { Browser } from '../../common/browser/browser.js';
import { BrowserMsg } from '../../common/browser/browser-msg.js';
import { Catch } from '../../common/platform/catch.js';
import { Gmail } from '../../common/api/email-provider/gmail/gmail.js';
import { Injector } from '../../common/inject.js';
import { PubLookup } from '../../common/api/pub-lookup.js';
import { Notifications } from '../../common/notifications.js';
import { PgpArmor } from '../../common/core/pgp-armor.js';
import { Ui } from '../../common/browser/ui.js';
import { WebmailCommon } from "../../common/webmail.js";
import { Xss } from '../../common/platform/xss.js';
import { OrgRules } from '../../common/org-rules.js';
import { SendAsAlias, AcctStore } from '../../common/platform/store/acct-store.js';
import { ContactStore } from '../../common/platform/store/contact-store.js';
import { Buf } from '../../common/core/buf.js';

type JQueryEl = JQuery<HTMLElement>;

export class GmailElementReplacer implements WebmailElementReplacer {

  private gmail: Gmail;
  private recipientHasPgpCache: Dict<boolean> = {};
  private sendAs: Dict<SendAsAlias>;
  private factory: XssSafeFactory;
  private orgRules: OrgRules;
  private pubLookup: PubLookup;
  private acctEmail: string;
  private canReadEmails: boolean;
  private injector: Injector;
  private notifications: Notifications;
  private gmailVariant: WebmailVariantString;
  private webmailCommon: WebmailCommon;
  private cssHidden = `opacity: 0 !important; height: 1px !important; width: 1px !important; max-height: 1px !important;
  max-width: 1px !important; position: absolute !important; z-index: -1000 !important`;
  private currentlyEvaluatingStandardComposeBoxRecipients = false;
  private currentlyReplacingAtts = false;
  private keepNextNativeReplyBox = false;

  private sel = { // gmail_variant=standard|new
    convoRoot: 'div.if',
    convoRootScrollable: '.Tm.aeJ',
    subject: 'h2.hP',
    msgOuter: 'div.adn',
    msgInner: 'div.a3s:not(.undefined), .message_inner_body',
    msgInnerContainingPgp: "div.a3s:not(.undefined):contains('" + PgpArmor.headers('null').begin + "')",
    attsContainerOuter: 'div.hq.gt',
    attsContainerInner: 'div.aQH',
    translatePrompt: '.adI',
    standardComposeWin: '.aaZ:visible',
    settingsBtnContainer: 'div.aeH > div > .fY',
    standardComposeRecipient: 'div.az9 span[email][data-hovercard-id]',
  };

  constructor(factory: XssSafeFactory, orgRules: OrgRules, acctEmail: string, sendAs: Dict<SendAsAlias>, canReadEmails: boolean,
    injector: Injector, notifications: Notifications, gmailVariant: WebmailVariantString) {
    this.factory = factory;
    this.acctEmail = acctEmail;
    this.sendAs = sendAs;
    this.canReadEmails = canReadEmails;
    this.injector = injector;
    this.gmailVariant = gmailVariant;
    this.notifications = notifications;
    this.webmailCommon = new WebmailCommon(acctEmail, injector);
    this.gmail = new Gmail(acctEmail);
    this.orgRules = orgRules;
    this.pubLookup = new PubLookup(this.orgRules);
  }

  public getIntervalFunctions = (): Array<IntervalFunction> => {
    return [
      { interval: 1000, handler: () => this.everything() },
      { interval: 30000, handler: () => this.webmailCommon.addOrRemoveEndSessionBtnIfNeeded() }
    ];
  }

  public setReplyBoxEditable = async () => {
    const replyContainerIframe = $('.reply_message_iframe_container > iframe').last();
    if (replyContainerIframe.length) {
      $(replyContainerIframe).replaceWith(this.factory.embeddedReply(this.getLastMsgReplyParams(this.getGonvoRootEl(replyContainerIframe[0])), true)); // xss-safe-value
    } else {
      await this.replaceStandardReplyBox(undefined, true);
    }
  }

  public reinsertReplyBox = (replyMsgId: string) => {
    const params: FactoryReplyParams = { sendAs: this.sendAs, replyMsgId };
    $('.reply_message_iframe_container:visible').last().append(this.factory.embeddedReply(params, false, true)); // xss-safe-value
  }

  public scrollToElement = (selector: string) => {
    const scrollableEl = $(this.sel.convoRootScrollable).get(0);
    if (scrollableEl) {
      const element = $(selector).get(0);
      if (element) {
        scrollableEl.scrollTop = element.offsetTop + element.clientHeight; // scroll to the element (reply box) is
      }
    } else if (window.location.hash.match(/^#inbox\/[a-zA-Z]+$/)) { // is a conversation view, but no scrollable conversation element
      Catch.report(`Cannot find Gmail scrollable element: ${this.sel.convoRootScrollable}`);
    }
  }

  private everything = () => {
    this.replaceArmoredBlocks();
    this.replaceAtts().catch(Catch.reportErr);
    this.replaceFcTags();
    this.replaceConvoBtns();
    this.replaceStandardReplyBox().catch(Catch.reportErr);
    this.evaluateStandardComposeRecipients().catch(Catch.reportErr);
    this.addSettingsBtn();
  }

  private replaceArmoredBlocks = () => {
    const emailsEontainingPgpBlock = $(this.sel.msgOuter).find(this.sel.msgInnerContainingPgp).not('.evaluated');
    for (const emailContainer of emailsEontainingPgpBlock) {
      $(emailContainer).addClass('evaluated');
      const senderEmail = this.getSenderEmail(emailContainer);
      const isOutgoing = !!this.sendAs[senderEmail];
      const replacementXssSafe = XssSafeFactory.replaceRenderableMsgBlocks(this.factory, emailContainer.innerText, this.determineMsgId(emailContainer), senderEmail, isOutgoing);
      if (typeof replacementXssSafe !== 'undefined') {
        $(this.sel.translatePrompt).hide();
        this.updateMsgBodyEl_DANGEROUSLY(emailContainer, 'set', replacementXssSafe); // xss-safe-factory: replace_blocks is XSS safe
      }
    }
  }

  private addfcConvoIcon = (containerSel: JQueryEl, iconHtml: string, iconSel: string, onClick: () => void) => {
    containerSel.addClass('appended').children('.use_secure_reply, .show_original_conversation').remove(); // remove previous FlowCrypt buttons, if any
    Xss.sanitizeAppend(containerSel, iconHtml).children(iconSel).off().click(Ui.event.prevent('double', Catch.try(onClick)));
  }

  private isEncrypted = (): boolean => {
    return !!$('iframe.pgp_block').filter(':visible').length;
  }

  private replaceConvoBtns = (force: boolean = false) => {
    const convoUpperIcons = $('div.ade:visible');
    const useEncryptionInThisConvo = this.isEncrypted() || force;
    // reply buttons
    const visibleReplyBtns = $('td.acX:visible');
    if (visibleReplyBtns.not('.replaced, .inserted').length) { // last reply button in convo gets replaced
      const convoReplyBtnsToReplace = visibleReplyBtns.not('.replaced, .inserted');
      const convoReplyBtnsArr = convoReplyBtnsToReplace.get();
      // only replace the last one FlowCrypt reply button if does not have any buttons replaced yet, and only replace the last one
      for (const elem of convoReplyBtnsArr) {
        $(elem).addClass('inserted');
        const gmailReplyBtn = $(elem).find('[aria-label="Reply"]');
        const secureReplyBtn = $(this.factory.btnSecureReply()).insertAfter(gmailReplyBtn);  // xss-safe-factory
        secureReplyBtn.addClass(gmailReplyBtn.attr('class') || '');
        secureReplyBtn.off();
        secureReplyBtn.on('focusin', Ui.event.handle((target) => { $(target).addClass('T-I-JO'); }));
        secureReplyBtn.on('focusout', Ui.event.handle((target) => { $(target).removeClass('T-I-JO'); }));
        secureReplyBtn.on('mouseenter', Ui.event.handle((target) => { $(target).addClass('T-I-JW'); }));
        secureReplyBtn.on('mouseleave', Ui.event.handle((target) => { $(target).removeClass('T-I-JW'); }));
        secureReplyBtn.click(Ui.event.handle((el, ev: JQuery.Event) => this.actionActivateSecureReplyHandler(el, ev)));
        secureReplyBtn.keydown(event => {
          if (event.key === 'Enter') {
            event.stopImmediatePropagation();
            $(secureReplyBtn).click();
          }
        });
        gmailReplyBtn.click(Ui.event.handle(() => { this.keepNextNativeReplyBox = true; }));
      }
    }
    // conversation top-right icon buttons
    if (convoUpperIcons.length) {
      if (useEncryptionInThisConvo) {
        if (!convoUpperIcons.is('.appended') || convoUpperIcons.find('.use_secure_reply').length) { // either not appended, or appended icon is outdated (convo switched to encrypted)
          this.addfcConvoIcon(convoUpperIcons, this.factory.btnWithoutFc(), '.show_original_conversation', () => {
            convoUpperIcons.find('.gZ').click();
          });
        }
      }
    }
  }

  private actionActivateSecureReplyHandler = async (btn: HTMLElement, event: JQuery.Event) => {
    event.stopImmediatePropagation();
    const messageContainer = $(btn.closest('.h7') as HTMLElement);
    if (messageContainer.is(':last-child')) {
      if (this.isEncrypted()) {
        await this.setReplyBoxEditable();
      } else {
        await this.replaceStandardReplyBox(undefined, true, true);
      }
    } else {
      this.insertEncryptedReplyBox(messageContainer);
    }
  }

  private replaceFcTags = () => {
    const allContenteditableEls = $("div[contenteditable='true']").not('.evaluated').addClass('evaluated');
    for (const contenteditableEl of allContenteditableEls) {
      const contenteditable = $(contenteditableEl);
      const fcLinkMatch = contenteditable.html().substr(0, 1000).match(/\[cryptup:link:([a-z_]+):([0-9a-fr\-]+)]/);
      if (fcLinkMatch) {
        let button: string | undefined;
        const [, name, buttonHrefId] = fcLinkMatch;
        if (name === 'draft_compose') {
          button = `<a href="#" class="open_draft_${Xss.escape(buttonHrefId)}">Open draft</a>`;
        } else if (name === 'draft_reply') {
          button = `<a href="#inbox/${Xss.escape(buttonHrefId)}">Open draft</a>`;
        }
        if (button) {
          Xss.sanitizeReplace(contenteditable, button);
          $(`a.open_draft_${buttonHrefId}`).click(Ui.event.handle((target) => {
            $('div.new_message').remove();
            $('body').append(this.factory.embeddedCompose(buttonHrefId)); // xss-safe-factory
            // close original draft window
            const mouseUpEvent = document.createEvent('Event');
            mouseUpEvent.initEvent('mouseup', true, true); // Gmail listens for the mouseup event, not click
            $(target).closest('.dw').find('.Ha')[0].dispatchEvent(mouseUpEvent); // jquery's trigger('mouseup') doesn't work for some reason
          }));
        }
      }
    }
  }

  /**
   * The tricky part here is that we are checking attachments in intervals (1s)
   * In the exact moment we check, only some of the attachments of a message may be loaded into the DOM, while others won't
   * This is not fully handled (I don't yet know how to tell if attachment container already contains all attachments)
   * It may create unexpected behavior, such as removing the attachment but not rendering any message (sometimes noticeable for attached public keys)
   * Best would be, instead of checking every 1 second, to be able to listen to a certain element being inserted into the dom, and only respond then
   * --
   * Further complication is that certain elements may persist navigating away and back from conversation (but in a changed form)
   * --
   * Related bugs (fixed):
   * https://github.com/FlowCrypt/flowcrypt-browser/issues/1870
   * https://github.com/FlowCrypt/flowcrypt-browser/issues/2309
   */
  private replaceAtts = async () => {
    if (this.currentlyReplacingAtts) {
      return;
    }
    try {
      this.currentlyReplacingAtts = true;
      for (const attsContainerEl of $(this.sel.attsContainerInner)) {
        const attsContainer = $(attsContainerEl);
        const newPgpAtts = this.filterAtts(attsContainer.children().not('.evaluated'), Att.webmailNamePattern).addClass('evaluated');
        const newPgpAttsNames = Browser.arrFromDomNodeList(newPgpAtts.find('.aV3')).map(x => $.trim($(x).text()));
        if (newPgpAtts.length) {
          const msgId = this.determineMsgId(attsContainer);
          if (msgId) {
            if (this.canReadEmails) {
              Xss.sanitizePrepend(newPgpAtts, this.factory.embeddedAttaStatus('Getting file info..' + Ui.spinner('green')));
              try {
                const msg = await this.gmail.msgGet(msgId, 'full');
                await this.processAtts(msgId, GmailParser.findAtts(msg), attsContainer, false, newPgpAttsNames);
              } catch (e) {
                if (ApiErr.isAuthPopupNeeded(e)) {
                  this.notifications.showAuthPopupNeeded(this.acctEmail);
                  $(newPgpAtts).find('.attachment_loader').text('Auth needed');
                } else if (ApiErr.isNetErr(e)) {
                  $(newPgpAtts).find('.attachment_loader').text('Network error');
                } else {
                  if (!ApiErr.isServerErr(e) && !ApiErr.isMailOrAcctDisabledOrPolicy(e) && !ApiErr.isNotFound(e)) {
                    Catch.reportErr(e);
                  }
                  $(newPgpAtts).find('.attachment_loader').text('Failed to load');
                }
              }
            } else {
              const statusMsg = 'Missing Gmail permission to decrypt attachments. <a href="#" class="auth_settings">Settings</a></div>';
              $(newPgpAtts).prepend(this.factory.embeddedAttaStatus(statusMsg)).children('a.auth_settings').click(Ui.event.handle(() => { // xss-safe-factory
                BrowserMsg.send.bg.settings({ acctEmail: this.acctEmail, page: '/chrome/settings/modules/auth_denied.htm' });
              }));
            }
          } else {
            $(newPgpAtts).prepend(this.factory.embeddedAttaStatus('Unknown message id')); // xss-safe-factory
          }
        }
      }
    } finally {
      this.currentlyReplacingAtts = false;
    }
  }

  private processAtts = async (msgId: string, attMetas: Att[], attsContainerInner: JQueryEl | HTMLElement, skipGoogleDrive: boolean, newPgpAttsNames: string[] = []) => {
    let msgEl = this.getMsgBodyEl(msgId); // not a constant because sometimes elements get replaced, then returned by the function that replaced them
    const senderEmail = this.getSenderEmail(msgEl);
    const isOutgoing = !!this.sendAs[senderEmail];
    attsContainerInner = $(attsContainerInner);
    attsContainerInner.parent().find('span.aVW').hide(); // original gmail header showing amount of attachments
    let nRenderedAtts = attMetas.length;
    for (const a of attMetas) {
      const treatAs = a.treatAs();
      // todo - [same name + not processed].first() ... What if attachment metas are out of order compared to how gmail shows it? And have the same name?
      const attSel = this.filterAtts(attsContainerInner.children().not('.attachment_processed'), new RegExp(`^${Str.regexEscape(a.name || 'noname')}$`)).first();
      try {
        if (treatAs !== 'plainFile') {
          this.hideAtt(attSel, attsContainerInner);
          nRenderedAtts--;
          if (treatAs === 'encryptedFile') { // actual encrypted attachment - show it
            attsContainerInner.prepend(this.factory.embeddedAtta(a, true)); // xss-safe-factory
            nRenderedAtts++;
          } else if (treatAs === 'encryptedMsg') {
            const isAmbiguousAscFile = a.name.substr(-4) === '.asc' && !Att.encryptedMsgNames.includes(a.name); // ambiguous .asc name
            const isAmbiguousNonameFile = !a.name || a.name === 'noname'; // may not even be OpenPGP related
            if (isAmbiguousAscFile || isAmbiguousNonameFile) { // Inspect a chunk
              const data = await this.gmail.attGetChunk(msgId, a.id!); // .id is present when fetched from api
              const openpgpType = await BrowserMsg.send.bg.await.pgpMsgType({ data: data.toBase64Str() }); // base64 for FF, see #2587
              if (openpgpType && openpgpType.type === 'publicKey' && openpgpType.armored) { // if it looks like OpenPGP public key
                nRenderedAtts = await this.renderPublicKeyFromFile(a, attsContainerInner, msgEl, isOutgoing, attSel, nRenderedAtts);
              } else if (openpgpType && ['encryptedMsg', 'signedMsg'].includes(openpgpType.type)) {
                msgEl = this.updateMsgBodyEl_DANGEROUSLY(msgEl, 'append', this.factory.embeddedMsg('', msgId, false, senderEmail, false)); // xss-safe-factory
              } else {
                attSel.show().children('.attachment_loader').text('Unknown OpenPGP format');
                nRenderedAtts++;
              }
            } else {
              msgEl = this.updateMsgBodyEl_DANGEROUSLY(msgEl, 'append', this.factory.embeddedMsg('', msgId, false, senderEmail, false)); // xss-safe-factory
            }
          } else if (treatAs === 'publicKey') { // todo - pubkey should be fetched in pgp_pubkey.js
            nRenderedAtts = await this.renderPublicKeyFromFile(a, attsContainerInner, msgEl, isOutgoing, attSel, nRenderedAtts);
          } else if (treatAs === 'privateKey') {
            nRenderedAtts = await this.renderBackupFromFile(a, attsContainerInner, msgEl, attSel, nRenderedAtts);
          } else if (treatAs === 'signature') {
            const embeddedSignedMsgXssSafe = this.factory.embeddedMsg('', msgId, false, senderEmail, false, true);
            msgEl = this.updateMsgBodyEl_DANGEROUSLY(msgEl, 'set', embeddedSignedMsgXssSafe); // xss-safe-factory
          }
        } else if (treatAs === 'plainFile' && a.name.substr(-4) === '.asc') { // normal looking attachment ending with .asc
          const data = await this.gmail.attGetChunk(msgId, a.id!); // .id is present when fetched from api
          const openpgpType = await BrowserMsg.send.bg.await.pgpMsgType({ data: data.toBase64Str() }); // base64 for FF, see #2587
          if (openpgpType && openpgpType.type === 'publicKey' && openpgpType.armored) { // if it looks like OpenPGP public key
            nRenderedAtts = await this.renderPublicKeyFromFile(a, attsContainerInner, msgEl, isOutgoing, attSel, nRenderedAtts);
            this.hideAtt(attSel, attsContainerInner);
            nRenderedAtts--;
          } else {
            attSel.addClass('attachment_processed').children('.attachment_loader').remove();
          }
        } else { // standard file
          attSel.addClass('attachment_processed').children('.attachment_loader').remove();
        }
      } catch (e) {
        if (!ApiErr.isSignificant(e) || (e instanceof AjaxErr && e.status === 200)) {
          attSel.show().children('.attachment_loader').text('Categorize: net err');
          nRenderedAtts++;
        } else {
          Catch.reportErr(e);
          attSel.show().children('.attachment_loader').text('Categorize: unknown err');
          nRenderedAtts++;
        }
      }
    }
    if (nRenderedAtts === 0) {
      attsContainerInner.parents(this.sel.attsContainerOuter).first().hide();
    }
    if (!skipGoogleDrive) {
      await this.processGoogleDriveAtts(msgId, msgEl, attsContainerInner);
    }
  }

  private processGoogleDriveAtts = async (msgId: string, msgEl: JQueryEl, attsContainerInner: JQueryEl) => {
    const notProcessedAttsLoaders = attsContainerInner.find('.attachment_loader');
    if (notProcessedAttsLoaders.length && msgEl.find('.gmail_drive_chip, a[href^="https://drive.google.com/file"]').length) {
      // replace google drive attachments - they do not get returned by Gmail API thus did not get replaced above
      const googleDriveAtts: Att[] = [];
      for (const attLoaderEl of notProcessedAttsLoaders) {
        const downloadUrl = $(attLoaderEl).parent().attr('download_url');
        if (downloadUrl) {
          const meta = downloadUrl.split(':');
          googleDriveAtts.push(new Att({ msgId, name: meta[1], type: meta[0], url: `${meta[2]}:${meta[3]}`, treatAs: 'encryptedFile' }));
        } else {
          console.info('Missing Google Drive attachments download_url');
        }
      }
      await this.processAtts(msgId, googleDriveAtts, attsContainerInner, true);
    }
  }

  private renderPublicKeyFromFile = async (attMeta: Att, attsContainerInner: JQueryEl, msgEl: JQueryEl, isOutgoing: boolean, attSel: JQueryEl, nRenderedAtts: number) => {
    let downloadedAtt: GmailRes.GmailAtt;
    try {
      downloadedAtt = await this.gmail.attGet(attMeta.msgId!, attMeta.id!); // .id! is present when fetched from api
    } catch (e) {
      attsContainerInner.show().addClass('attachment_processed').find('.attachment_loader').text('Please reload page');
      nRenderedAtts++;
      return nRenderedAtts;
    }
    const openpgpType = await BrowserMsg.send.bg.await.pgpMsgType({ data: Buf.fromUint8(downloadedAtt.data.subarray(0, 1000)).toBase64Str() }); // base64 for FF, see #2587
    if (openpgpType && openpgpType.type === 'publicKey') {
      this.updateMsgBodyEl_DANGEROUSLY(msgEl, 'append', this.factory.embeddedPubkey(downloadedAtt.data.toUtfStr(), isOutgoing)); // xss-safe-factory
    } else {
      attSel.show().addClass('attachment_processed').children('.attachment_loader').text('Unknown Public Key Format');
      nRenderedAtts++;
    }
    return nRenderedAtts;
  }

  private renderBackupFromFile = async (attMeta: Att, attsContainerInner: JQueryEl, msgEl: JQueryEl, attSel: JQueryEl, nRenderedAtts: number) => {
    let downloadedAtt: GmailRes.GmailAtt;
    try {
      downloadedAtt = await this.gmail.attGet(attMeta.msgId!, attMeta.id!); // .id! is present when fetched from api
    } catch (e) {
      attsContainerInner.show().addClass('attachment_processed').find('.attachment_loader').text('Please reload page');
      nRenderedAtts++;
      return nRenderedAtts;
    }
    this.updateMsgBodyEl_DANGEROUSLY(msgEl, 'append', this.factory.embeddedBackup(downloadedAtt.data.toUtfStr())); // xss-safe-factory
    return nRenderedAtts;
  }

  private filterAtts = (potentialMatches: JQueryEl | HTMLElement, regExp: RegExp) => {
    return $(potentialMatches).filter('span.aZo:visible, span.a5r:visible').find('span.aV3').filter(function () {
      const name = this.innerText.trim();
      return regExp.test(name);
    }).closest('span.aZo, span.a5r');
  }

  private hideAtt = (attEl: JQueryEl | HTMLElement, attsContainerSel: JQueryEl | HTMLElement) => {
    attEl = $(attEl);
    attsContainerSel = $(attsContainerSel);
    attEl.hide();
    if (!attEl.length) {
      attsContainerSel.children('.attachment_loader').text('Missing file info');
    }
  }

  private determineMsgId = (innerMsgEl: HTMLElement | JQueryEl) => {
    const parents = $(innerMsgEl).parents(this.sel.msgOuter);
    return parents.attr('data-legacy-message-id') || parents.attr('data-message-id') || '';
  }

  private determineThreadId = (convoRootEl: HTMLElement | JQueryEl) => { // todo - test and use data-thread-id with Gmail API once available
    return $(convoRootEl).find(this.sel.subject).attr('data-legacy-thread-id') || '';
  }

  private getMsgBodyEl = (msgId: string) => {
    return $(this.sel.msgOuter).filter(`[data-legacy-message-id="${msgId}"]`).find(this.sel.msgInner);
  }

  private wrapMsgBodyEl = (htmlContent: string) => {
    return '<div class="message_inner_body evaluated">' + htmlContent + '</div>';
  }

  /**
   * XSS WARNING
   *
   * new_html_content must be XSS safe
   */ // tslint:disable-next-line:variable-name
  private updateMsgBodyEl_DANGEROUSLY(el: HTMLElement | JQueryEl, method: 'set' | 'append', newHtmlContent_MUST_BE_XSS_SAFE: string) {  // xss-dangerous-function
    // Messages in Gmail UI have to be replaced in a very particular way
    // The first time we update element, it should be completely replaced so that Gmail JS will lose reference to the original element and stop re-rendering it
    // Gmail message re-rendering causes the PGP message to flash back and forth, confusing the user and wasting cpu time
    // Subsequent times, it can be updated naturally
    const msgBody = $(el);
    const replace = !msgBody.is('.message_inner_body'); // not a previously replaced element, needs replacing
    if (method === 'set') {
      if (replace) {
        const parent = msgBody.parent();
        msgBody.replaceWith(this.wrapMsgBodyEl(newHtmlContent_MUST_BE_XSS_SAFE)); // xss-safe-value
        this.ensureHasParentNode(msgBody); // Gmail is using msgBody.parentNode (#2271)
        return parent.find('.message_inner_body'); // need to return new selector - old element was replaced
      } else {
        return msgBody.html(newHtmlContent_MUST_BE_XSS_SAFE); // xss-safe-value
      }
    } else if (method === 'append') {
      if (replace) {
        const parent = msgBody.parent();
        msgBody.replaceWith(this.wrapMsgBodyEl(msgBody.html() + newHtmlContent_MUST_BE_XSS_SAFE)); // xss-reinsert // xss-safe-value
        this.ensureHasParentNode(msgBody); // Gmail is using msgBody.parentNode (#2271)
        return parent.find('.message_inner_body'); // need to return new selector - old element was replaced
      } else {
        return msgBody.append(newHtmlContent_MUST_BE_XSS_SAFE); // xss-safe-value
      }
    } else {
      throw new Error('Unknown update_message_body_element method:' + method);
    }
  }

  private ensureHasParentNode = (el: JQuery<HTMLElement>) => {
    if (!el.parent().length) {
      const dummyParent = $('<div>');
      dummyParent.append(el); // xss-direct
    }
  }

  private getSenderEmail = (msgEl: HTMLElement | JQueryEl) => {
    return ($(msgEl).closest('.gs').find('span.gD').attr('email') || '').toLowerCase();
  }

  private getLastMsgReplyParams = (convoRootEl: JQueryEl): FactoryReplyParams => {
    return { sendAs: this.sendAs, replyMsgId: this.determineMsgId($(convoRootEl).find(this.sel.msgInner).last()) };
  }

  private getGonvoRootEl = (anyInnerElement: HTMLElement) => {
    return $(anyInnerElement).closest('div.if, td.Bu').first();
  }

  private insertEncryptedReplyBox = (messageContainer: JQuery<HTMLElement>) => {
    const msgIdElement = messageContainer.find('[data-legacy-message-id], [data-message-id]');
    const msgId = msgIdElement.attr('data-legacy-message-id') || msgIdElement.attr('data-message-id');
    const replyParams: FactoryReplyParams = { sendAs: this.sendAs, replyMsgId: msgId, removeAfterClose: true };
    const secureReplyBoxXssSafe = `<div class="remove_borders reply_message_iframe_container inserted">${this.factory.embeddedReply(replyParams, true, true)}</div>`;
    messageContainer.find('.adn.ads').parent().append(secureReplyBoxXssSafe); // xss-safe-factory
  }

  private replaceStandardReplyBox = async (msgId?: string, editable: boolean = false, force: boolean = false) => {
    const newReplyBoxes = $('div.nr.tMHS5d, td.amr > div.nr, div.gA td.I5').not('.reply_message_evaluated').filter(':visible').get();
    if (newReplyBoxes.length) {
      // cache for subseqent loop runs
      const { drafts_reply } = await AcctStore.get(this.acctEmail, ['drafts_reply']);
      const convoRootEl = this.getGonvoRootEl(newReplyBoxes[0]);
      const replyParams = this.getLastMsgReplyParams(convoRootEl!);
      const threadId = this.determineThreadId(convoRootEl!);
      if (msgId) {
        replyParams.replyMsgId = msgId;
      }
      const hasDraft = drafts_reply && threadId && !!drafts_reply[threadId];
      const doReplace = Boolean(convoRootEl.find('iframe.pgp_block').filter(':visible').closest('.h7').is(':last-child')
        || (convoRootEl.is(':visible') && force)
        || hasDraft);
      const alreadyHasEncryptedReplyBox = Boolean(convoRootEl.find('div.reply_message_iframe_container').filter(':visible').length);
      let midConvoDraft = false;
      if (doReplace) {
        if (this.keepNextNativeReplyBox) {
          for (const replyBoxEl of newReplyBoxes) {
            $(replyBoxEl).addClass('reply_message_evaluated');
          }
          this.keepNextNativeReplyBox = false;
          return;
        }
        for (const replyBoxEl of newReplyBoxes.reverse()) { // looping in reverse
          const replyBox = $(replyBoxEl);
          if (!midConvoDraft && !alreadyHasEncryptedReplyBox) { // either is a draft in the middle, or the convo already had (last) box replaced: should also be useless draft
            const secureReplyBoxXssSafe = `<div class="remove_borders reply_message_iframe_container">${this.factory.embeddedReply(replyParams, editable)}</div>`;
            if (replyBox.hasClass('I5')) { // activated standard reply box: cannot remove because would cause issues / gmail freezing
              const origChildren = replyBox.children();
              replyBox.addClass('reply_message_evaluated').append(secureReplyBoxXssSafe); // xss-safe-factory
              if (this.gmailVariant === 'new') { // even hiding causes issues in new gmail (encrypted -> see original -> reply -> archive)
                origChildren.attr('style', this.cssHidden);
              } else { // in old gmail, we can safely hide it without causing freezes navigating away
                origChildren.hide();
              }
            } else { // non-activated reply box: replaced so that originally bound events would go with it (prevents inbox freezing)
              replyBox.replaceWith(secureReplyBoxXssSafe); // xss-safe-factory
            }
            midConvoDraft = true; // last box was processed first (looping in reverse), and all the rest must be drafts
          }
        }
      }
    }
  }

  private evaluateStandardComposeRecipients = async () => {
    if (!this.currentlyEvaluatingStandardComposeBoxRecipients) {
      this.currentlyEvaluatingStandardComposeBoxRecipients = true;
      for (const standardComposeWinEl of $(this.sel.standardComposeWin)) {
        const standardComposeWin = $(standardComposeWinEl);
        const recipients = standardComposeWin.find(this.sel.standardComposeRecipient).get().map(e => $(e).attr('email')!).filter(e => !!e);
        if (!recipients.length) {
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
                  const [contact] = await ContactStore.get(undefined, [email]);
                  if (contact && contact.pubkey) {
                    this.recipientHasPgpCache[email] = true;
                  } else if ((await this.pubLookup.lookupEmail(email)).pubkey) {
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
                  // this is a low-importance request, so evaluate has_pgp as false on errors
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
              prependable.find('a').click(Ui.event.handle(() => this.injector.openComposeWin()));
            }
          } else {
            standardComposeWin.find('.recipients_use_encryption').remove();
          }
        }
      }
      this.currentlyEvaluatingStandardComposeBoxRecipients = false;
    }
  }

  private addSettingsBtn = () => {
    if (window.location.hash.startsWith('#settings')) {
      const settingsBtnContainer = $(this.sel.settingsBtnContainer);
      if (settingsBtnContainer.length && !settingsBtnContainer.find('#fc_settings_btn').length) {
        settingsBtnContainer.children().last().before(this.factory.btnSettings('gmail')); // xss-safe-factory
        settingsBtnContainer.find('#fc_settings_btn').click(Ui.event.handle(() => BrowserMsg.send.bg.settings({ acctEmail: this.acctEmail })));
      }
    }
  }

}
