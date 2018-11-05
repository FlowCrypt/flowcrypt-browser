/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Value, Str, Dict } from '../../common/common.js';
import { Injector } from '../../common/inject.js';
import { Notifications } from '../../common/notifications.js';
import { Api } from '../../common/api.js';
import { Pgp } from '../../common/pgp.js';
import { BrowserMsg } from '../../common/extension.js';
import { Xss, Ui, XssSafeFactory, WebmailVariantString } from '../../common/browser.js';
import { Att } from '../../common/att.js';
import { WebmailElementReplacer } from './setup_webmail_content_script.js';
import { Catch } from '../../common/catch.js';

type JQueryEl = JQuery<HTMLElement>;

export class GmailElementReplacer implements WebmailElementReplacer {

  private recipientHasPgpCache: Dict<boolean> = {};
  private addresses: string[];
  private factory: XssSafeFactory;
  private acctEmail: string;
  private canReadEmails: boolean;
  private injector: Injector;
  private notifications: Notifications;
  private gmailVariant: WebmailVariantString;
  private cssHidden = `opacity: 0 !important; height: 1px !important; width: 1px !important; max-height: 1px !important;
  max-width: 1px !important; position: absolute !important; z-index: -1000 !important`;
  private currentlyEvaluatingStandardComposeBoxRecipients = false;

  private sel = { // gmail_variant=standard|new
    convoRoot: 'div.if',
    convoRootScrollable: '.Tm.aeJ',
    subject: 'h2.hP',
    msgOuter: 'div.adn',
    msgInner: 'div.a3s:not(.undefined), .message_inner_body',
    msgInnerContainingPgp: "div.a3s:not(.undefined):contains('" + Pgp.armor.headers('null').begin + "')",
    attsContainerOuter: 'div.hq.gt',
    attsContainerInner: 'div.aQH',
    translatePrompt: '.adI',
    standardComposeWin: '.aaZ:visible',
  };

  constructor(factory: XssSafeFactory, acctEmail: string, addresses: string[], canReadEmails: boolean, injector: Injector, notifications: Notifications, gmailVariant: WebmailVariantString) {
    this.factory = factory;
    this.acctEmail = acctEmail;
    this.addresses = addresses;
    this.canReadEmails = canReadEmails;
    this.injector = injector;
    this.gmailVariant = gmailVariant;
    this.notifications = notifications;
  }

  everything = () => {
    this.replaceArmoredBlocks();
    this.replaceAtts().catch(Catch.handleException);
    this.replaceFcTags();
    this.replaceConvoBtns();
    this.replaceStandardReplyBox();
    this.evaluateStandardComposeReceivers().catch(Catch.handleException);
  }

  setReplyBoxEditable = () => {
    let replyContainerIframe = $('.reply_message_iframe_container > iframe').first();
    if (replyContainerIframe.length) {
      $(replyContainerIframe).replaceWith(this.factory.embeddedReply(this.getConvoParams(this.getGonvoRootEl(replyContainerIframe[0])), true)); // xss-safe-value
    } else {
      this.replaceStandardReplyBox(true);
    }
    this.scrollToBottomOfConvo();
  }

  reinsertReplyBox = (subject: string, myEmail: string, replyTo: string[], threadId: string) => {
    let params = { subject, replyTo, addresses: this.addresses, myEmail, threadId, threadMessageId: threadId };
    $('.reply_message_iframe_container:visible').last().append(this.factory.embeddedReply(params, false, true)); // xss-safe-value
  }

  scrollToBottomOfConvo = () => {
    let scrollableEl = $(this.sel.convoRootScrollable).get(0);
    if (scrollableEl) {
      scrollableEl.scrollTop = scrollableEl.scrollHeight; // scroll to the bottom of conversation where the reply box is
    } else if (window.location.hash.match(/^#inbox\/[a-zA-Z]+$/)) { // is a conversation view, but no scrollable conversation element
      Catch.report(`Cannot find Gmail scrollable element: ${this.sel.convoRootScrollable}`);
    }
  }

  private replaceArmoredBlocks = () => {
    let emailsEontainingPgpBlock = $(this.sel.msgOuter).find(this.sel.msgInnerContainingPgp).not('.evaluated');
    for (let emailContainer of emailsEontainingPgpBlock.get()) {
      $(emailContainer).addClass('evaluated');
      let senderEmail = this.getSenderEmail(emailContainer);
      let isOutgoing = Value.is(senderEmail).in(this.addresses);
      let replacementXssSafe = Ui.replaceRenderableMsgBlocks(this.factory, emailContainer.innerText, this.determineMsgId(emailContainer), senderEmail, isOutgoing);
      if (typeof replacementXssSafe !== 'undefined') {
        $(this.sel.translatePrompt).hide();
        let newSel = this.updateMsgBodyEl_DANGEROUSLY(emailContainer, 'set', replacementXssSafe); // xss-safe-factory: replace_blocks is XSS safe
      }
    }
  }

  private addfcConvoIcon = (containerSel: JQueryEl, iconHtml: string, iconSel: string, onClick: () => void) => {
    containerSel.addClass('appended').children('.use_secure_reply, .show_original_conversation').remove(); // remove previous FlowCrypt buttons, if any
    Xss.sanitizeAppend(containerSel, iconHtml).children(iconSel).off().click(Ui.event.prevent('double', Catch.try(onClick)));
  }

  private replaceConvoBtns = (force: boolean = false) => {
    let convoUpperIcons = $('div.ade:visible');
    let useEncryptionInThisConvo = $('iframe.pgp_block').filter(':visible').length || force;
    // reply buttons
    if (useEncryptionInThisConvo) {
      let visibleReplyBtns = $('td.acX:visible');
      if (visibleReplyBtns.not('.replaced').length) { // last reply button in convo gets replaced
        let convoReplyBtnsToReplace = visibleReplyBtns.not('.replaced');
        let hasVisibleReplacements = visibleReplyBtns.filter('.replaced').length > 0;
        convoReplyBtnsToReplace.addClass('replaced').each((i, replyBtn) => {
          if (i + 1 < convoReplyBtnsToReplace.length || hasVisibleReplacements) {
            $(replyBtn).addClass('replaced').text(''); // hide all except last
          } else {
            $(replyBtn).html(this.factory.btnReply()); // replace last,  // xss-safe-factory
            $(replyBtn).click(Ui.event.prevent('double', Catch.try(this.setReplyBoxEditable)));
          }
        });
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
      } else {
        if (!convoUpperIcons.is('.appended')) {
          this.addfcConvoIcon(convoUpperIcons, this.factory.btnWithFc(), '.use_secure_reply', () => {
            this.replaceConvoBtns(true);
            this.replaceStandardReplyBox(true, true);
            this.scrollToBottomOfConvo();
          });
        }
      }
    }
  }

  private replaceFcTags = () => {
    let allContenteditableEls = $("div[contenteditable='true']").not('.evaluated').addClass('evaluated');
    for (let contenteditableEl of allContenteditableEls.get()) {
      let contenteditable = $(contenteditableEl);
      let foundFcLink = contenteditable.html().substr(0, 1000).match(/\[cryptup:link:([a-z_]+):([0-9a-fr\-]+)]/);
      if (foundFcLink !== null) {
        let button;
        let [fullLink, name, buttonHrefId] = foundFcLink;
        if (name === 'draft_compose') {
          button = `<a href="#" class="open_draft_${Xss.escape(buttonHrefId)}">Open draft</a>`;
        } else if (name === 'draft_reply') {
          button = `<a href="#inbox/${Xss.escape(buttonHrefId)}">Open draft</a>`;
        }
        if (button) {
          Xss.sanitizeReplace(contenteditable, button);
          $(`a.open_draft_${buttonHrefId}`).click(Ui.event.handle(() => {
            $('div.new_message').remove();
            $('body').append(this.factory.embeddedCompose(buttonHrefId)); // xss-safe-factory
          }));
        }
      }
    }
  }

  private replaceAtts = async () => {
    for (let attsContainerEl of $(this.sel.attsContainerInner).get()) {
      let attsContainer = $(attsContainerEl);
      let newPgpAtts = this.filterAtts(attsContainer.children().not('.evaluated'), Att.pgpNamePatterns()).addClass('evaluated');
      let newPgpAttsNames = Value.arr.fromDomNodeList(newPgpAtts.find('.aV3')).map(x => $.trim($(x).text()));
      if (newPgpAtts.length) {
        let msgId = this.determineMsgId(attsContainer);
        if (msgId) {
          if (this.canReadEmails) {
            Xss.sanitizePrepend(newPgpAtts, this.factory.embeddedAttaStatus('Getting file info..' + Ui.spinner('green')));
            try {
              let msg = await Api.gmail.msgGet(this.acctEmail, msgId, 'full');
              await this.processAtts(msgId, Api.gmail.findAtts(msg), attsContainer, false, newPgpAttsNames);
            } catch (e) {
              if (Api.err.isAuthPopupNeeded(e)) {
                this.notifications.showAuthPopupNeeded(this.acctEmail);
              }
              $(newPgpAtts).find('.attachment_loader').text('Failed to load');
            }
          } else {
            let statusMsg = 'Missing Gmail permission to decrypt attachments. <a href="#" class="auth_settings">Settings</a></div>';
            $(newPgpAtts).prepend(this.factory.embeddedAttaStatus(statusMsg)).children('a.auth_settings').click(Ui.event.handle(() => { // xss-safe-factory
              BrowserMsg.send(null, 'settings', { acctEmail: this.acctEmail, page: '/chrome/settings/modules/auth_denied.htm' });
            }));
          }
        } else {
          $(newPgpAtts).prepend(this.factory.embeddedAttaStatus('Unknown message id')); // xss-safe-factory
        }
      }
    }
  }

  private processAtts = async (msgId: string, attMetas: Att[], attsContainerInner: JQueryEl | HTMLElement, skipGoogleDrive: boolean, newPgpAttsNames: string[] = []) => {
    let msgEl = this.getMsgBodyEl(msgId);
    let senderEmail = this.getSenderEmail(msgEl);
    let isOutgoing = Value.is(senderEmail).in(this.addresses);
    attsContainerInner = $(attsContainerInner);
    attsContainerInner.parent().find('span.aVW').hide(); // original gmail header showing amount of attachments
    let nRenderedAtts = attMetas.length;
    for (let a of attMetas) {
      // todo - [same name + not processed].first() ... What if attachment metas are out of order compared to how gmail shows it? And have the same name?
      let treatAs = a.treatAs();
      let attSel = this.filterAtts(attsContainerInner.children().not('.attachment_processed'), [a.name]).first();
      if (treatAs !== 'standard') {
        this.hideAtt(attSel, attsContainerInner);
        nRenderedAtts--;
        if (treatAs === 'encrypted') { // actual encrypted attachment - show it
          attsContainerInner.prepend(this.factory.embeddedAtta(a)); // xss-safe-factory
          nRenderedAtts++;
        } else if (treatAs === 'message') {
          let isAmbiguousAscFile = a.name.substr(-4) === '.asc' && !Value.is(a.name).in(['msg.asc', 'message.asc', 'encrypted.asc', 'encrypted.eml.pgp']); // ambiguous .asc name
          let isAmbiguousNonameFile = !a.name || a.name === 'noname'; // may not even be OpenPGP related
          if (isAmbiguousAscFile || isAmbiguousNonameFile) { // Inspect a chunk
            let fileChunk = await Api.gmail.attGetChunk(this.acctEmail, msgId, a.id!); // .id is present when fetched from api
            let openpgpType = Pgp.msg.type(fileChunk);
            if (openpgpType && openpgpType.type === 'publicKey' && openpgpType.armored) { // if it looks like OpenPGP public key
              nRenderedAtts = await this.renderPublicKeyFromFile(a, attsContainerInner, msgEl, isOutgoing, attSel, nRenderedAtts);
            } else if (openpgpType && Value.is(openpgpType.type).in(['message', 'signedMsg'])) {
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
        } else if (treatAs === 'signature') {
          let signedContent = msgEl[0] ? Str.normalizeSpaces(msgEl[0].innerText).trim() : '';
          let embeddedSignedMsgXssSafe = this.factory.embeddedMsg(signedContent, msgId, false, senderEmail, false, true);
          let replace = !msgEl.is('.evaluated') && !Value.is(Pgp.armor.headers('null').begin).in(msgEl.text());
          msgEl = this.updateMsgBodyEl_DANGEROUSLY(msgEl, replace ? 'set' : 'append', embeddedSignedMsgXssSafe); // xss-safe-factory
        }
      } else if (treatAs === 'standard' && a.name.substr(-4) === '.asc') { // normal looking attachment ending with .asc
        let fileChunk = await Api.gmail.attGetChunk(this.acctEmail, msgId, a.id!); // .id is present when fetched from api
        let openpgpType = Pgp.msg.type(fileChunk);
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
    }
    if (nRenderedAtts === 0) {
      attsContainerInner.parents(this.sel.attsContainerOuter).first().hide();
    }
    let notProcessedAttsLoaders = attsContainerInner.find('.attachment_loader');
    if (!skipGoogleDrive && notProcessedAttsLoaders.length && msgEl.find('.gmail_drive_chip, a[href^="https://drive.google.com/file"]').length) {
      // replace google drive attachments - they do not get returned by Gmail API thus did not get replaced above
      let googleDriveAtts: Att[] = [];
      notProcessedAttsLoaders.each((i, loaderEl) => {
        let downloadUrl = $(loaderEl).parent().attr('download_url');
        if (downloadUrl) {
          let meta = downloadUrl.split(':');
          googleDriveAtts.push(new Att({ msgId, name: meta[1], type: meta[0], url: `${meta[2]}:${meta[3]}`, treatAs: 'encrypted' }));
        } else {
          console.info('Missing Google Drive attachments download_url');
        }
      });
      await this.processAtts(msgId, googleDriveAtts, attsContainerInner, true);
    }
  }

  private renderPublicKeyFromFile = async (attMeta: Att, attsContainerInner: JQueryEl, msgEl: JQueryEl, isOutgoing: boolean, attSel: JQueryEl, nRenderedAtts: number) => {
    let downloadedAtt;
    try {
      downloadedAtt = await Api.gmail.attGet(this.acctEmail, attMeta.msgId!, attMeta.id!); // .id is present when fetched from api
    } catch (e) {
      attsContainerInner.show().addClass('attachment_processed').find('.attachment_loader').text('Please reload page');
      nRenderedAtts++;
      return nRenderedAtts;
    }
    let openpgpType = Pgp.msg.type(downloadedAtt.data);
    if (openpgpType && openpgpType.type === 'publicKey') {
      msgEl = this.updateMsgBodyEl_DANGEROUSLY(msgEl, 'append', this.factory.embeddedPubkey(downloadedAtt.data, isOutgoing)); // xss-safe-factory
    } else {
      attSel.show().addClass('attachment_processed').children('.attachment_loader').text('Unknown Public Key Format');
      nRenderedAtts++;
    }
    return nRenderedAtts;
  }

  private filterAtts = (potentialMatches: JQueryEl | HTMLElement, patterns: string[]) => {
    return $(potentialMatches).filter('span.aZo:visible, span.a5r:visible').find('span.aV3').filter(function () {
      let name = this.innerText.trim();
      for (let pattern of patterns) {
        if (pattern.indexOf('*.') === 0) { // wildcard
          if (name.endsWith(pattern.substr(1))) {
            return true;
          }
        } else if (name === pattern) { // exact match
          return true;
        } else if ((name === 'noname' && pattern === '') || (name === '' && pattern === 'noname')) { // empty filename (sometimes represented as "noname" in Gmail)
          return true;
        }
      }
      return false;
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

  private determineMsgId = (innerMsgEl: HTMLElement | JQueryEl) => { // todo - test and use data-message-id with Gmail API once available
    return $(innerMsgEl).parents(this.sel.msgOuter).attr('data-legacy-message-id') || '';
  }

  private determineThreadId = (convoRootEl: HTMLElement | JQueryEl) => { // todo - test and use data-thread-id with Gmail API once available
    return $(convoRootEl).find(this.sel.subject).attr('data-legacy-thread-id') || '';
  }

  private getMsgBodyEl(msgId: string) {
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
  private updateMsgBodyEl_DANGEROUSLY = (el: HTMLElement | JQueryEl, method: 'set' | 'append', newHtmlContent_MUST_BE_XSS_SAFE: string) => {  // xss-dangerous-function
    // Messages in Gmail UI have to be replaced in a very particular way
    // The first time we update element, it should be completely replaced so that Gmail JS will lose reference to the original element and stop re-rendering it
    // Gmail message re-rendering causes the PGP message to flash back and forth, confusing the user and wasting cpu time
    // Subsequent times, it can be updated naturally
    let msgBody = $(el);
    let replace = !msgBody.is('.message_inner_body'); // not a previously replaced element, needs replacing
    if (method === 'set') {
      if (replace) {
        let parent = msgBody.parent();
        msgBody.replaceWith(this.wrapMsgBodyEl(newHtmlContent_MUST_BE_XSS_SAFE)); // xss-safe-value
        return parent.find('.message_inner_body'); // need to return new selector - old element was replaced
      } else {
        return msgBody.html(newHtmlContent_MUST_BE_XSS_SAFE); // xss-safe-value
      }
    } else if (method === 'append') {
      if (replace) {
        let parent = msgBody.parent();
        msgBody.replaceWith(this.wrapMsgBodyEl(msgBody.html() + newHtmlContent_MUST_BE_XSS_SAFE)); // xss-reinsert // xss-safe-value
        return parent.find('.message_inner_body'); // need to return new selector - old element was replaced
      } else {
        return msgBody.append(newHtmlContent_MUST_BE_XSS_SAFE); // xss-safe-value
      }
    } else {
      throw new Error('Unknown update_message_body_element method:' + method);
    }
  }

  private getSenderEmail = (msgEl: HTMLElement | JQueryEl) => {
    return ($(msgEl).closest('.gs').find('span.gD').attr('email') || '').toLowerCase();
  }

  private domGetMsgSender = (convoRootEl: JQueryEl) => {
    return (convoRootEl.find('h3.iw span[email]').last().attr('email') || '').trim().toLowerCase();
  }

  private domGetMsgRecipients = (convoRootEl: JQueryEl) => {
    return convoRootEl.find('span.hb').last().find('span.g2').toArray().map(el => ($(el).attr('email') || '').toLowerCase()); // add all recipients including me
  }

  private domGetMsgSubject = (convoRootEl: JQueryEl) => {
    return $(convoRootEl).find(this.sel.subject).text();
  }

  private getConvoParams = (convoRootEl: JQueryEl) => {
    let headers = Api.common.replyCorrespondents(this.acctEmail, this.addresses, this.domGetMsgSender(convoRootEl), this.domGetMsgRecipients(convoRootEl));
    return {
      subject: this.domGetMsgSubject(convoRootEl),
      replyTo: headers.to,
      addresses: this.addresses,
      myEmail: headers.from,
      threadId: this.determineThreadId(convoRootEl),
      threadMessageId: this.determineMsgId($(convoRootEl).find(this.sel.msgInner).last()),
    };
  }

  private getGonvoRootEl = (anyInnerElement: HTMLElement) => {
    return $(anyInnerElement).closest('div.if, td.Bu').first();
  }

  private replaceStandardReplyBox = (editable: boolean = false, force: boolean = false) => {
    let newReplyBoxes = $('div.nr.tMHS5d, td.amr > div.nr, div.gA td.I5').not('.reply_message_evaluated').filter(':visible').get();
    if (newReplyBoxes.length) {
      // cache for subseqent loop runs
      let convoRootEl = this.getGonvoRootEl(newReplyBoxes[0]);
      let doReplace = Boolean(convoRootEl.find('iframe.pgp_block').filter(':visible').length || (convoRootEl.is(':visible') && force));
      let alreadyHasEncryptedReplyBox = Boolean(convoRootEl.find('div.reply_message_iframe_container').filter(':visible').length);
      let midConvoDraft = false;
      if (doReplace) {
        for (let replyBoxEl of newReplyBoxes.reverse()) { // looping in reverse
          let replyBox = $(replyBoxEl);
          if (midConvoDraft || alreadyHasEncryptedReplyBox) { // either is a draft in the middle, or the convo already had (last) box replaced: should also be useless draft
            replyBox.attr('class', 'reply_message_evaluated');
            Xss.sanitizeAppend(replyBox, '<font>&nbsp;&nbsp;Draft skipped</font>');
            replyBox.children(':not(font)').hide();
          } else {
            let secureReplyBoxXssSafe = `<div class="remove_borders reply_message_iframe_container">${this.factory.embeddedReply(this.getConvoParams(convoRootEl!), editable)}</div>`;
            if (replyBox.hasClass('I5')) { // activated standard reply box: cannot remove because would cause issues / gmail freezing
              let origChildren = replyBox.children();
              replyBox.addClass('reply_message_evaluated').append(secureReplyBoxXssSafe); // xss-safe-factory
              if (this.gmailVariant === 'new') { // even hiding causes issues in new gmail (encrypted -> see original -> reply -> archive)
                origChildren.attr('style', this.cssHidden);
              } else { // in old gmail, we can safely hide it without causing freezes navigating away
                origChildren.hide();
              }
            } else { // non-activated reply box: replaced so that originally bound events would go with it (prevents inbox freezing)
              replyBox.replaceWith(secureReplyBoxXssSafe); // xss-safe-factory
            }
          }
          midConvoDraft = true; // last box was processed first (looping in reverse), and all the rest must be drafts
        }
      }
    }
  }

  private evaluateStandardComposeReceivers = async () => {
    if (!this.currentlyEvaluatingStandardComposeBoxRecipients) {
      this.currentlyEvaluatingStandardComposeBoxRecipients = true;
      for (let standardComposeWinEl of $(this.sel.standardComposeWin).get()) {
        let standardComposeWin = $(standardComposeWinEl);
        let recipients = standardComposeWin.find('div.az9 span[email]').get().map(e => $(e).attr('email')!).filter(e => !!e);
        if (!recipients.length) {
          standardComposeWin.find('.recipients_use_encryption').remove();
        } else {
          let everyoneUsesEncryption = true;
          for (let email of recipients) {
            if (email) {
              let cache = this.recipientHasPgpCache[email];
              if (!Str.isEmailValid(email)) {
                everyoneUsesEncryption = false;
                break;
              }
              if (typeof cache === 'undefined') {
                try {
                  let { results: [result] } = await Api.attester.lookupEmail([email]);
                  this.recipientHasPgpCache[email] = Boolean(result.pubkey); // true or false
                  if (!this.recipientHasPgpCache[email]) {
                    everyoneUsesEncryption = false;
                    break;
                  }
                } catch (e) {
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
              let prependable = standardComposeWin.find('div.az9 span[email]').first().parents('form').first();
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

}
