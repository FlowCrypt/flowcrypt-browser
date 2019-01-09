/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch } from '../../js/common/platform/catch.js';
import { Store } from '../../js/common/platform/store.js';
import { Str, Dict } from '../../js/common/core/common.js';
import { Att } from '../../js/common/core/att.js';
import { Xss, Ui, Env, Browser } from '../../js/common/browser.js';
import { BrowserMsg } from '../../js/common/extension.js';
import { Lang } from '../../js/common/lang.js';
import { Api, R } from '../../js/common/api/api.js';
import { MsgVerifyResult, DecryptErrTypes, FormatError, PgpMsg } from '../../js/common/core/pgp.js';
import { Mime, MsgBlock } from '../../js/common/core/mime.js';
import { Google, GmailResponseFormat, GoogleAuth } from '../../js/common/api/google.js';
import { Buf } from '../../js/common/core/buf.js';

Catch.try(async () => {

  Ui.event.protect();

  const uncheckedUrlParams = Env.urlParams(['acctEmail', 'frameId', 'message', 'parentTabId', 'msgId', 'isOutgoing', 'senderEmail', 'hasPassword', 'signature', 'short']);
  const acctEmail = Env.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
  const parentTabId = Env.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');
  const frameId = Env.urlParamRequire.string(uncheckedUrlParams, 'frameId');
  const hasChallengePassword = uncheckedUrlParams.hasPassword === true;
  const isOutgoing = uncheckedUrlParams.isOutgoing === true;
  const short = Env.urlParamRequire.optionalString(uncheckedUrlParams, 'short');
  const senderEmail = Env.urlParamRequire.optionalString(uncheckedUrlParams, 'senderEmail');
  const msgId = Env.urlParamRequire.optionalString(uncheckedUrlParams, 'msgId');
  const heightHistory: number[] = [];
  let signature = uncheckedUrlParams.signature === true ? true : (uncheckedUrlParams.signature ? String(uncheckedUrlParams.signature) : undefined);
  let encStr = Env.urlParamRequire.optionalString(uncheckedUrlParams, 'message');
  const encryptedMsgUrlParam: Buf | undefined = encStr ? Buf.fromUtfStr(encStr) : undefined; // todo - could be changed to msg
  encStr = undefined;
  let msgFetchedFromApi: false | GmailResponseFormat = false;
  let includedAtts: Att[] = [];
  let canReadEmails: undefined | boolean;
  let passwordMsgLinkRes: R.FcLinkMsg;
  let adminCodes: string[];
  let userEnteredMsgPassword: string | undefined;

  const renderText = (text: string) => {
    document.getElementById('pgp_block')!.innerText = text; // pgp_block.htm
  };

  const sendResizeMsg = () => {
    let height = $('#pgp_block').height()! + 40; // pgp_block.htm
    const isInfiniteResizeLoop = () => {
      heightHistory.push(height);
      const len = heightHistory.length;
      if (len < 4) {
        return false;
      }
      if (heightHistory[len - 1] === heightHistory[len - 3] && heightHistory[len - 2] === heightHistory[len - 4] && heightHistory[len - 1] !== heightHistory[len - 2]) {
        console.info('pgp_block.js: repetitive resize loop prevented'); // got repetitive, eg [70, 80, 200, 250, 200, 250]
        height = Math.max(heightHistory[len - 1], heightHistory[len - 2]);
      }
      return;
    };
    if (!isInfiniteResizeLoop()) {
      BrowserMsg.send.setCss(parentTabId, { selector: `iframe#${frameId}`, css: { height: `${height}px` } });
    }
  };

  const setTestState = (state: 'ready' | 'working' | 'waiting') => {
    $('body').attr('data-test-state', state); // for automated tests
  };

  const displayImageSrcLinkAsImg = (a: HTMLAnchorElement, event: JQuery.Event<HTMLAnchorElement, null>) => {
    const img = document.createElement('img');
    img.setAttribute('style', a.getAttribute('style') || '');
    img.style.background = 'none';
    img.style.border = 'none';
    img.addEventListener('load', () => sendResizeMsg());
    if (a.href.indexOf('cid:') === 0) { // image included in the email
      const contentId = a.href.replace(/^cid:/g, '');
      const content = includedAtts.filter(a => a.type.indexOf('image/') === 0 && a.cid === `<${contentId}>`)[0];
      if (content) {
        img.src = `data:${a.type};base64,${content.getData().toBase64Str()}`;
        a.outerHTML = img.outerHTML; // xss-safe-value - img.outerHTML was built using dom node api
      } else {
        a.outerHTML = Xss.escape(`[broken link: ${a.href}]`); // xss-escaped
      }
    } else if (a.href.indexOf('https://') === 0 || a.href.indexOf('http://') === 0) {
      img.src = a.href;
      a.outerHTML = img.outerHTML; // xss-safe-value - img.outerHTML was built using dom node api
    } else {
      a.outerHTML = Xss.escape(`[broken link: ${a.href}]`); // xss-escaped
    }
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  };

  const renderContent = async (htmlContent: string, isErr: boolean) => {
    if (!isErr && !isOutgoing) { // successfully opened incoming message
      await Store.setAcct(acctEmail, { successfully_received_at_leat_one_message: true });
    }
    if (!isErr) { // rendering message content
      const pgpBlock = $('#pgp_block').html(Xss.htmlSanitizeKeepBasicTags(htmlContent)); // xss-sanitized
      pgpBlock.find('a.image_src_link').one('click', Ui.event.handle(displayImageSrcLinkAsImg));
    } else { // rendering our own ui
      Xss.sanitizeRender('#pgp_block', htmlContent);
    }
    // if (unsecure_mdc_ignored && !is_error) {
    //   set_frame_color('red');
    //   Xss.sanitize_prepend('#pgp_block', '<div style="border: 4px solid #d14836;color:#d14836;padding: 5px;">' + Lang.pgp_block.mdc_warning.replace(/\n/g, '<br>') + '</div><br>');
    // }
    if (isErr) {
      $('.action_show_raw_pgp_block').click(Ui.event.handle(target => {
        $('.raw_pgp_block').css('display', 'block');
        $(target).css('display', 'none');
        sendResizeMsg();
      }));
    }
    // resize window now
    sendResizeMsg();
    // start auto-resizing the window after 1s
    Catch.setHandledTimeout(() => $(window).resize(Ui.event.prevent('spree', sendResizeMsg)), 1000);
  };

  const btnHtml = (text: string, addClasses: string) => {
    return `<div class="button long ${addClasses}" style="margin:30px 0;" target="cryptup">${text}</div>`;
  };

  const armoredMsgAsHtml = (encrypted?: string) => {
    if (encrypted && encrypted.length) {
      return `<div class="raw_pgp_block" style="display: none;">${Xss.escape(encrypted).replace(/\n/g, '<br>')}</div><a href="#" class="action_show_raw_pgp_block">show original message</a>`;
    }
    return '';
  };

  const setFrameColor = (color: 'red' | 'green' | 'gray') => {
    if (color === 'red') {
      $('#pgp_background').removeClass('pgp_secure').removeClass('pgp_neutral').addClass('pgp_insecure');
    } else if (color === 'green') {
      $('#pgp_background').removeClass('pgp_neutral').removeClass('pgp_insecure').addClass('pgp_secure');
    } else {
      $('#pgp_background').removeClass('pgp_secure').removeClass('pgp_insecure').addClass('pgp_neutral');
    }
  };

  const renderErr = async (errBoxContent: string, renderRawEncrypted: string | undefined) => {
    setFrameColor('red');
    await renderContent('<div class="error">' + errBoxContent.replace(/\n/g, '<br>') + '</div>' + armoredMsgAsHtml(renderRawEncrypted), true);
    $('.button.settings_keyserver').click(Ui.event.handle(() => BrowserMsg.send.bg.settings({ acctEmail, page: '/chrome/settings/modules/keyserver.htm' })));
    $('.button.settings').click(Ui.event.handle(() => BrowserMsg.send.bg.settings({ acctEmail })));
    $('.button.settings_add_key').click(Ui.event.handle(() => BrowserMsg.send.bg.settings({ acctEmail, page: '/chrome/settings/modules/add_key.htm' })));
    $('.button.reply_pubkey_mismatch').click(Ui.event.handle(() => {
      BrowserMsg.send.replyPubkeyMismatch(parentTabId);
    }));
    setTestState('ready');
  };

  const handlePrivateKeyMismatch = async (acctEmail: string, message: Uint8Array) => { // todo - make it work for multiple stored keys
    const msgDiagnosis = await BrowserMsg.send.bg.await.pgpMsgDiagnosePubkeys({ privateKis: await Store.keysGet(acctEmail), message });
    if (msgDiagnosis.found_match) {
      await renderErr(Lang.pgpBlock.cantOpen + Lang.pgpBlock.encryptedCorrectlyFileBug, undefined);
    } else if (msgDiagnosis.receivers === 1) {
      await renderErr(Lang.pgpBlock.cantOpen + Lang.pgpBlock.singleSender + Lang.pgpBlock.askResend + btnHtml('account settings', 'gray2 settings_keyserver'), undefined);
    } else {
      await renderErr(Lang.pgpBlock.yourKeyCantOpenImportIfHave + btnHtml('import missing key', 'gray2 settings_add_key') + '&nbsp; &nbsp;'
        + btnHtml('ask sender to update', 'gray2 short reply_pubkey_mismatch') + '&nbsp; &nbsp;' + btnHtml('settings', 'gray2 settings_keyserver'), undefined);
    }
  };

  const getDecryptPwd = async (suppliedPwd?: string | undefined): Promise<string | undefined> => {
    const pwd = suppliedPwd || userEnteredMsgPassword || undefined;
    if (pwd && hasChallengePassword) {
      const { hashed } = await BrowserMsg.send.bg.await.pgpHashChallengeAnswer({ answer: pwd });
      return hashed;
    }
    return pwd;
  };

  const decryptAndSaveAttToDownloads = async (encrypted: Att, renderIn: JQuery<HTMLElement>) => {
    const kisWithPp = await Store.keysGetAllWithPassphrases(acctEmail);
    const decrypted = await BrowserMsg.send.bg.await.pgpMsgDecrypt({ kisWithPp, encryptedData: encrypted.getData(), msgPwd: await getDecryptPwd() });
    if (decrypted.success) {
      const att = new Att({ name: encrypted.name.replace(/(\.pgp)|(\.gpg)$/, ''), type: encrypted.type, data: decrypted.content });
      Browser.saveToDownloads(att, renderIn);
      sendResizeMsg();
    } else {
      delete decrypted.message;
      console.info(decrypted);
      alert('There was a problem decrypting this file. Downloading encrypted original. Email human@flowcrypt.com if this happens repeatedly.');
      Browser.saveToDownloads(encrypted, renderIn);
      sendResizeMsg();
    }
  };

  const renderProgress = (element: JQuery<HTMLElement>, percent: number | undefined, received: number | undefined, size: number) => {
    if (percent) {
      element.text(percent + '%');
    } else if (size && received) {
      element.text(Math.floor(((received * 0.75) / size) * 100) + '%');
    }
  };

  const renderInnerAtts = (atts: Att[]) => {
    Xss.sanitizeAppend('#pgp_block', '<div id="attachments"></div>');
    includedAtts = atts;
    for (const i of atts.keys()) {
      const name = (atts[i].name ? Xss.escape(atts[i].name) : 'noname').replace(/(\.pgp)|(\.gpg)$/, '');
      const size = Str.numberFormat(Math.ceil(atts[i].length / 1024)) + 'KB';
      const htmlContent = `<b>${Xss.escape(name)}</b>&nbsp;&nbsp;&nbsp;${size}<span class="progress"><span class="percent"></span></span>`;
      Xss.sanitizeAppend('#attachments', `<div class="attachment" index="${Number(i)}">${htmlContent}</div>`);
    }
    sendResizeMsg();
    $('div.attachment').click(Ui.event.prevent('double', async target => {
      const att = includedAtts[Number($(target).attr('index'))];
      if (att.hasData()) {
        Browser.saveToDownloads(att, $(target));
        sendResizeMsg();
      } else {
        Xss.sanitizePrepend($(target).find('.progress'), Ui.spinner('green'));
        att.setData(await Api.download(att.url!, (perc, load, total) => renderProgress($(target).find('.progress .percent'), perc, load, total || att.length)));
        await Ui.delay(100); // give browser time to render
        $(target).find('.progress').text('');
        await decryptAndSaveAttToDownloads(att, $(target));
      }
    }));
  };

  const renderPgpSignatureCheckResult = (signature: MsgVerifyResult | undefined) => {
    if (signature) {
      const signerEmail = signature.contact ? signature.contact.name || senderEmail : senderEmail;
      $('#pgp_signature > .cursive > span').text(String(signerEmail) || 'Unknown Signer');
      if (signature.signer && !signature.contact) {
        $('#pgp_signature').addClass('neutral');
        $('#pgp_signature > .result').text(`missing pubkey ${signature.signer}`);
      } else if (signature.match && signature.signer && signature.contact) {
        $('#pgp_signature').addClass('good');
        $('#pgp_signature > .result').text('matching signature');
      } else {
        $('#pgp_signature').addClass('bad');
        $('#pgp_signature > .result').text('signature does not match');
        setFrameColor('red');
      }
      $('#pgp_signature').css('block');
    }
  };

  const renderFutureExpiration = (date: string) => {
    let btns = '';
    if (adminCodes && adminCodes.length) {
      btns += ' <a href="#" class="extend_expiration">extend</a>';
    }
    if (isOutgoing) {
      btns += ' <a href="#" class="expire_settings">settings</a>';
    }
    Xss.sanitizeAppend('#pgp_block', Ui.e('div', { class: 'future_expiration', html: `This message will expire on ${Str.datetimeToDate(date)}. ${btns}` }));
    $('.expire_settings').click(Ui.event.handle(() => BrowserMsg.send.bg.settings({ acctEmail, page: '/chrome/settings/modules/security.htm' })));
    $('.extend_expiration').click(Ui.event.handle(target => renderMsgExpirationRenewOptions(target)));
  };

  const recoverStoredAdminCodes = async () => {
    const storage = await Store.getGlobal(['admin_codes']);
    if (short && storage.admin_codes && storage.admin_codes[short] && storage.admin_codes[short].codes) {
      adminCodes = storage.admin_codes[short].codes;
    }
  };

  const renderMsgExpirationRenewOptions = async (target: HTMLElement) => {
    const parent = $(target).parent();
    const subscription = await Store.subscription();
    if (subscription.level && subscription.active) {
      const btns = `<a href="#7" class="do_extend">+7 days</a> <a href="#30" class="do_extend">+1 month</a> <a href="#365" class="do_extend">+1 year</a>`;
      Xss.sanitizeRender(parent, `<div style="font-family: monospace;">Extend message expiration: ${btns}</div>`);
      const element = await Ui.event.clicked('.do_extend');
      await handleExtendMsgExpirationClicked(element);
    } else {
      if (subscription.level && !subscription.active && subscription.method === 'trial') {
        alert('Your trial has ended. Please renew your subscription to proceed.');
      } else {
        alert('FlowCrypt Advanced users can choose expiration of password encrypted messages. Try it free.');
      }
      BrowserMsg.send.subscribeDialog(parentTabId, {});
    }
  };

  const handleExtendMsgExpirationClicked = async (self: HTMLElement) => {
    const nDays = Number($(self).attr('href')!.replace('#', ''));
    Xss.sanitizeRender($(self).parent(), 'Updating..' + Ui.spinner('green'));
    try {
      const r = await Api.fc.messageExpiration(adminCodes, nDays);
      if (r.updated) {
        window.location.reload();
      } else {
        throw r;
      }
    } catch (e) {
      if (Api.err.isAuthErr(e)) {
        alert('Your FlowCrypt account information is outdated, please review your account settings.');
        BrowserMsg.send.subscribeDialog(parentTabId, { isAuthErr: true });
      } else {
        Catch.report('error when extending message expiration', e);
      }
      Xss.sanitizeRender($(self).parent(), 'Error updating expiration. <a href="#" class="retry_expiration_change">Click here to try again</a>').addClass('bad');
      const el = await Ui.event.clicked('.retry_expiration_change');
      await handleExtendMsgExpirationClicked(el);
    }
  };

  const decideDecryptedContentFormattingAndRender = async (decryptedBytes: Buf, isEncrypted: boolean, sigResult: MsgVerifyResult | undefined) => {
    setFrameColor(isEncrypted ? 'green' : 'gray');
    renderPgpSignatureCheckResult(sigResult);
    const publicKeys: string[] = [];
    let decryptedContent = decryptedBytes.toUtfStr();
    // todo - replace with PgpMsg.fmtDecrypted
    if (!Mime.resemblesMsg(decryptedBytes)) {
      const fcAttBlocks: MsgBlock[] = [];
      decryptedContent = PgpMsg.extractFcAtts(decryptedContent, fcAttBlocks);
      decryptedContent = PgpMsg.stripFcTeplyToken(decryptedContent);
      decryptedContent = PgpMsg.stripPublicKeys(decryptedContent, publicKeys);
      if (publicKeys.length) {
        BrowserMsg.send.renderPublicKeys(parentTabId, { afterFrameId: frameId, publicKeys });
      }
      await renderContent(Xss.escape(decryptedContent).replace(/\n/g, '<br>'), false);
      if (fcAttBlocks.length) {
        renderInnerAtts(fcAttBlocks.map(attBlock => new Att(attBlock.attMeta!)));
      }
      if (passwordMsgLinkRes && passwordMsgLinkRes.expire) {
        renderFutureExpiration(passwordMsgLinkRes.expire);
      }
    } else {
      renderText('Formatting...');
      const decoded = await Mime.decode(decryptedBytes);
      if (typeof decoded.html !== 'undefined') {
        await renderContent(decoded.html, false);
      } else if (typeof decoded.text !== 'undefined') {
        await renderContent(Xss.escape(decoded.text).replace(/\n/g, '<br>'), false);
      } else {
        await renderContent((decryptedContent || '').replace(/\n/g, '<br>'), false); // not sure about the replace, time will tell
      }
      const renderableAtts: Att[] = [];
      for (const att of decoded.atts) {
        if (att.treatAs() !== 'publicKey') {
          renderableAtts.push(att);
        } else {
          publicKeys.push(att.getData().toUtfStr());
        }
      }
      if (renderableAtts.length) {
        renderInnerAtts(decoded.atts);
      }
      if (publicKeys.length) {
        BrowserMsg.send.renderPublicKeys(parentTabId, { afterFrameId: frameId, publicKeys });
      }
    }
    setTestState('ready');
  };

  const decryptAndRender = async (encryptedData: Buf, optionalPwd?: string) => {
    if (typeof signature !== 'string') {
      const kisWithPp = await Store.keysGetAllWithPassphrases(acctEmail);
      const result = await BrowserMsg.send.bg.await.pgpMsgDecrypt({ kisWithPp, encryptedData, msgPwd: await getDecryptPwd(optionalPwd) });
      if (typeof result === 'undefined') {
        await renderErr(Lang.general.restartBrowserAndTryAgain, undefined);
      } else if (result.success) {
        if (hasChallengePassword && optionalPwd) {
          userEnteredMsgPassword = optionalPwd;
        }
        if (result.success && result.signature && result.signature.contact && !result.signature.match && canReadEmails && msgFetchedFromApi !== 'raw') {
          console.info(`re-fetching message ${msgId} from api because failed signature check: ${!msgFetchedFromApi ? 'full' : 'raw'}`);
          await initialize(true);
        } else {
          await decideDecryptedContentFormattingAndRender(result.content, Boolean(result.isEncrypted), result.signature); // text!: did not request uint8
        }
      } else if (result.error.type === DecryptErrTypes.format) {
        if (canReadEmails && msgFetchedFromApi !== 'raw') {
          console.info(`re-fetching message ${msgId} from api because looks like bad formatting: ${!msgFetchedFromApi ? 'full' : 'raw'}`);
          await initialize(true);
        } else {
          await renderErr(Lang.pgpBlock.badFormat + '\n\n' + result.error.error, encryptedData.toUtfStr());
        }
      } else if (result.longids.needPassphrase.length) {
        await renderPassphrasePromptAndAwaitChange(result.longids.needPassphrase);
        await decryptAndRender(encryptedData, optionalPwd);
      } else {
        const [primaryKi] = await Store.keysGet(acctEmail, ['primary']);
        if (!result.longids.chosen && !primaryKi) {
          await renderErr(Lang.pgpBlock.notProperlySetUp + btnHtml('FlowCrypt settings', 'green settings'), undefined);
        } else if (result.error.type === DecryptErrTypes.keyMismatch) {
          if (hasChallengePassword && !optionalPwd) {
            const pwd = await renderPasswordPromptAndWaitForEntry('first');
            await decryptAndRender(encryptedData, pwd);
          } else {
            await handlePrivateKeyMismatch(acctEmail, encryptedData);
          }
        } else if (result.error.type === DecryptErrTypes.wrongPwd) {
          const pwd = await renderPasswordPromptAndWaitForEntry('retry');
          await decryptAndRender(encryptedData, pwd);
        } else if (result.error.type === DecryptErrTypes.usePassword) {
          const pwd = await renderPasswordPromptAndWaitForEntry('first');
          await decryptAndRender(encryptedData, pwd);
        } else if (result.error.type === DecryptErrTypes.noMdc) {
          const errMsg = `This message may not be safe to open: missing MDC. Please go to FlowCrypt Settings -> Additional Settings -> Exprimental -> Decrypt message without MDC`;
          await renderErr(errMsg, encryptedData.toUtfStr());
        } else if (result.error) {
          await renderErr(`${Lang.pgpBlock.cantOpen}\n\n<em>${result.error.type}: ${result.error.error}</em>`, encryptedData.toUtfStr());
        } else { // should generally not happen
          delete result.message;
          await renderErr(Lang.pgpBlock.cantOpen + Lang.pgpBlock.writeMe + '\n\nDiagnostic info: "' + JSON.stringify(result) + '"', encryptedData.toUtfStr());
        }
      }
    } else {
      const signatureResult = await BrowserMsg.send.bg.await.pgpMsgVerifyDetached({ plaintext: encryptedData, sigText: Buf.fromUtfStr(signature) });
      await decideDecryptedContentFormattingAndRender(encryptedData, false, signatureResult);
    }
  };

  const renderPassphrasePromptAndAwaitChange = async (missingOrWrongPpKeyLongids: string[]) => {
    const missingOrWrongPassprases: Dict<string | undefined> = {};
    const passphrases = await Promise.all(missingOrWrongPpKeyLongids.map(longid => Store.passphraseGet(acctEmail, longid)));
    for (const i of missingOrWrongPpKeyLongids.keys()) {
      missingOrWrongPassprases[missingOrWrongPpKeyLongids[i]] = passphrases[i];
    }
    await renderErr(`<a href="#" class="enter_passphrase" data-test="action-show-passphrase-dialog">${Lang.pgpBlock.enterPassphrase}</a> ${Lang.pgpBlock.toOpenMsg}`, undefined);
    let wasClicked = false;
    $('.enter_passphrase').click(Ui.event.handle(() => {
      setTestState('waiting');
      BrowserMsg.send.passphraseDialog(parentTabId, { type: 'message', longids: missingOrWrongPpKeyLongids });
      wasClicked = true;
    }));
    while (true) {
      await Ui.time.sleep(wasClicked ? 400 : 2000);
      if (await werePassphrasesUpdated(missingOrWrongPassprases)) {
        return;
      }
    }
  };

  const renderPasswordPromptAndWaitForEntry = async (attempt: 'first' | 'retry'): Promise<string> => {
    let prompt = `<p>${attempt === 'first' ? '' : Lang.pgpBlock.wrongPassword}${Lang.pgpBlock.decryptPasswordPrompt}</p>`;
    const btn = `<div class="button green long decrypt" data-test="action-decrypt-with-password">decrypt message</div>`;
    prompt += `<p><input id="answer" placeholder="Password" data-test="input-message-password"></p><p>${btn}</p>`;
    prompt += armoredMsgAsHtml();
    await renderContent(prompt, true);
    setTestState('ready');
    await Ui.event.clicked('.button.decrypt');
    setTestState('working'); // so that test suite can wait until ready again
    $(self).text('Opening');
    await Ui.delay(50); // give browser time to render
    return String($('#answer').val());
  };

  const werePassphrasesUpdated = async (missingOrWrongPassprases: Dict<string | undefined>): Promise<boolean> => {
    const longidsMissingPp = Object.keys(missingOrWrongPassprases);
    const updatedPpArr = await Promise.all(longidsMissingPp.map(longid => Store.passphraseGet(acctEmail, longid)));
    for (let i = 0; i < longidsMissingPp.length; i++) {
      const missingOrWrongPp = missingOrWrongPassprases[longidsMissingPp[i]];
      const updatedPp = updatedPpArr[i];
      if (updatedPp !== missingOrWrongPp) {
        return true;
      }
    }
    return false;
  };

  const renderPasswordEncryptedMsgLoadFail = async (linkRes: R.FcLinkMsg) => {
    if (linkRes.expired) {
      let expirationMsg = Lang.pgpBlock.msgExpiredOn + Str.datetimeToDate(linkRes.expire) + '. ' + Lang.pgpBlock.msgsDontExpire + '\n\n';
      if (linkRes.deleted) {
        expirationMsg += Lang.pgpBlock.msgDestroyed;
      } else if (isOutgoing && adminCodes) {
        expirationMsg += '<div class="button gray2 extend_expiration">renew message</div>';
      } else if (!isOutgoing) {
        expirationMsg += Lang.pgpBlock.askSenderRenew;
      }
      expirationMsg += '\n\n<div class="button gray2 action_security">security settings</div>';
      await renderErr(expirationMsg, undefined);
      setFrameColor('gray');
      $('.action_security').click(Ui.event.handle(() => BrowserMsg.send.bg.settings({ page: '/chrome/settings/modules/security.htm', acctEmail })));
      $('.extend_expiration').click(Ui.event.handle(renderMsgExpirationRenewOptions));
    } else if (!linkRes.url) {
      await renderErr(Lang.pgpBlock.cannotLocate + Lang.pgpBlock.brokenLink, undefined);
    } else {
      await renderErr(Lang.pgpBlock.cannotLocate + Lang.general.writeMeToFixIt + ' Details:\n\n' + Xss.escape(JSON.stringify(linkRes)), undefined);
    }
  };

  const initialize = async (forcePullMsgFromApi = false) => {
    try {
      if (canReadEmails && encryptedMsgUrlParam && signature === true && msgId) {
        renderText('Loading signature...');
        const result = await Google.gmail.msgGet(acctEmail, msgId, 'raw');
        if (!result.rawBytes || !result.rawBytes.length) {
          await decryptAndRender(encryptedMsgUrlParam);
        } else {
          msgFetchedFromApi = 'raw';
          const parsed = Mime.signed(result.rawBytes);
          if (parsed && typeof parsed.signed === 'string') {
            signature = parsed.signature || undefined;
            await decryptAndRender(encryptedMsgUrlParam);
          } else {
            const decoded = await Mime.decode(result.rawBytes);
            signature = decoded.signature || undefined;
            console.info('%c[___START___ PROBLEM PARSING THIS MESSSAGE WITH DETACHED SIGNATURE]', 'color: red; font-weight: bold;');
            console.info(result.rawBytes.toUtfStr());
            console.info('%c[___END___ PROBLEM PARSING THIS MESSSAGE WITH DETACHED SIGNATURE]', 'color: red; font-weight: bold;');
            await decryptAndRender(encryptedMsgUrlParam);
          }
        }
      } else if (encryptedMsgUrlParam && !forcePullMsgFromApi) { // ascii armored message supplied
        renderText(signature ? 'Verifying..' : 'Decrypting...');
        await decryptAndRender(encryptedMsgUrlParam);
      } else if (!encryptedMsgUrlParam && hasChallengePassword && short) { // need to fetch the message from FlowCrypt API
        renderText('Loading message...');
        await recoverStoredAdminCodes();
        const msgLinkRes = await Api.fc.linkMessage(short);
        passwordMsgLinkRes = msgLinkRes;
        if (msgLinkRes.url) {
          const downloaded = await Api.download(msgLinkRes.url);
          await decryptAndRender(downloaded);
        } else {
          await renderPasswordEncryptedMsgLoadFail(passwordMsgLinkRes);
        }
      } else {  // need to fetch the inline signed + armored or encrypted +armored message block from gmail api
        if (!msgId) {
          Xss.sanitizeRender('#pgp_block', `Missing msgId to fetch message in pgp_block. If this happens repeatedly, please report the issue to human@flowcrypt.com`);
          sendResizeMsg();
        } else if (canReadEmails) {
          renderText('Retrieving message...');
          const format: GmailResponseFormat = (!msgFetchedFromApi) ? 'full' : 'raw';
          const extracted = await Google.gmail.extractArmoredBlock(acctEmail, msgId, format);
          renderText('Decrypting...');
          msgFetchedFromApi = format;
          await decryptAndRender(Buf.fromUtfStr(extracted));
        } else { // gmail message read auth not allowed
          // tslint:disable-next-line:max-line-length
          const readAccess = `Your browser needs to access gmail it in order to decrypt and display the message.<br/><br/><div class="button green auth_settings">Add missing permission</div>`;
          Xss.sanitizeRender('#pgp_block', `This encrypted message is very large (possibly containing an attachment). ${readAccess}`);
          sendResizeMsg();
          $('.auth_settings').click(Ui.event.handle(() => BrowserMsg.send.bg.settings({ acctEmail, page: '/chrome/settings/modules/auth_denied.htm' })));
        }
      }
    } catch (e) {
      if (Api.err.isNetErr(e)) {
        await renderErr(`Could not load message due to network error. ${Ui.retryLink()}`, undefined);
      } else if (Api.err.isAuthPopupNeeded(e)) {
        BrowserMsg.send.notificationShowAuthPopupNeeded(parentTabId, { acctEmail });
        await renderErr(`Could not load message due to missing auth. ${Ui.retryLink()}`, undefined);
      } else if (e instanceof FormatError) {
        console.log(e.data);
        await renderErr(Lang.pgpBlock.cantOpen + Lang.pgpBlock.badFormat + Lang.pgpBlock.dontKnowHowOpen, e.data);
      } else {
        Catch.handleErr(e);
        await renderErr(String(e), encryptedMsgUrlParam ? encryptedMsgUrlParam.toUtfStr() : undefined);
      }
    }
  };

  const storage = await Store.getAcct(acctEmail, ['setup_done', 'google_token_scopes']);
  canReadEmails = GoogleAuth.hasScope(storage.google_token_scopes || [], 'read');
  if (storage.setup_done) {
    await initialize();
  } else {
    await renderErr(Lang.pgpBlock.refreshWindow, encryptedMsgUrlParam ? encryptedMsgUrlParam.toUtfStr() : undefined);
  }

})();
