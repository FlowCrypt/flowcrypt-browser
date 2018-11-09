/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store } from '../../js/common/store.js';
import { Value, Str, Dict } from './../../js/common/common.js';
import { Att } from '../../js/common/att.js';
import { Xss, Ui, Env, Browser } from '../../js/common/browser.js';
import { BgExec, BrowserMsg } from '../../js/common/extension.js';
import { Lang } from './../../js/common/lang.js';

import { Api, GmailResponseFormat, R } from '../../js/common/api.js';
import { MsgVerifyResult, DecryptErrTypes, Pgp } from '../../js/common/pgp.js';
import { Mime } from '../../js/common/mime.js';
import { Catch } from '../../js/common/catch.js';

declare const anchorme: (input: string, opts: { emails?: boolean, attributes?: { name: string, value: string }[] }) => string;

Catch.try(async () => {

  Ui.event.protect();

  const urlParams = Env.urlParams(['acctEmail', 'frameId', 'message', 'parentTabId', 'msgId', 'isOutgoing', 'senderEmail', 'hasPassword', 'signature', 'short']);
  const acctEmail = Env.urlParamRequire.string(urlParams, 'acctEmail');
  const parentTabId = Env.urlParamRequire.string(urlParams, 'parentTabId');
  const frameId = Env.urlParamRequire.string(urlParams, 'frameId');
  const hasChallengePassword = urlParams.hasPassword === true;
  const isOutgoing = urlParams.isOutgoing === true;
  const short = urlParams.short;
  const senderEmail = urlParams.senderEmail;
  const msgId = urlParams.msgId;
  const heightHistory: number[] = [];
  let signature = urlParams.signature || null;
  let msg = urlParams.message;
  let missingOrWrongPassprases: Dict<string | null> = {};
  let msgFetchedFromApi: false | GmailResponseFormat = false;
  let includedAtts: Att[] = [];
  let passphraseInterval: number | undefined;
  let canReadEmails: undefined | boolean;
  let passwordMsgLinkRes: R.FcLinkMsg;
  let adminCodes: string[];
  let userEnteredMsgPassword: string | undefined;

  const doAnchor = (text: string) => {
    return anchorme(text.replace(/\n/g, '<br>'), { emails: false, attributes: [{ name: 'target', value: '_blank' }] });
  };

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

  const setTestState = (state: 'ready' | 'working') => {
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
        img.src = `data:${a.type};base64,${btoa(content.asText())}`;
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

  const armoredMsgAsHtml = (rawMsgSubstitute: string | null = null) => {
    const m = rawMsgSubstitute || msg;
    if (m && typeof m === 'string') {
      return `<div class="raw_pgp_block" style="display: none;">${Xss.escape(m).replace(/\n/g, '<br>')}</div><a href="#" class="action_show_raw_pgp_block">show original message</a>`;
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

  const renderErr = async (errBoxContent: string, rawMsgSubstitute: string | null = null) => {
    setFrameColor('red');
    await renderContent('<div class="error">' + errBoxContent.replace(/\n/g, '<br>') + '</div>' + armoredMsgAsHtml(rawMsgSubstitute), true);
    $('.button.settings_keyserver').click(Ui.event.handle(() => BrowserMsg.send.bg.settings({ acctEmail, page: '/chrome/settings/modules/keyserver.htm' })));
    $('.button.settings').click(Ui.event.handle(() => BrowserMsg.send.bg.settings({ acctEmail })));
    $('.button.settings_add_key').click(Ui.event.handle(() => BrowserMsg.send.bg.settings({ acctEmail, page: '/chrome/settings/modules/add_key.htm' })));
    $('.button.reply_pubkey_mismatch').click(Ui.event.handle(() => {
      BrowserMsg.send.replyPubkeyMismatch(parentTabId);
    }));
    setTestState('ready');
  };

  const handlePrivateKeyMismatch = async (acctEmail: string, message: string) => { // todo - make it work for multiple stored keys
    const msgDiagnosis = await BgExec.diagnoseMsgPubkeys(acctEmail, message);
    if (msgDiagnosis.found_match) {
      await renderErr(Lang.pgpBlock.cantOpen + Lang.pgpBlock.encryptedCorrectlyFileBug);
    } else if (msgDiagnosis.receivers === 1) {
      await renderErr(Lang.pgpBlock.cantOpen + Lang.pgpBlock.singleSender + Lang.pgpBlock.askResend + btnHtml('account settings', 'gray2 settings_keyserver'));
    } else {
      await renderErr(Lang.pgpBlock.yourKeyCantOpenImportIfHave + btnHtml('import missing key', 'gray2 settings_add_key') + '&nbsp; &nbsp;'
        + btnHtml('ask sender to update', 'gray2 short reply_pubkey_mismatch') + '&nbsp; &nbsp;' + btnHtml('settings', 'gray2 settings_keyserver'));
    }
  };

  const decryptPwd = async (suppliedPwd?: string | null): Promise<string | null> => {
    const pwd = suppliedPwd || userEnteredMsgPassword || null;
    if (pwd && hasChallengePassword) {
      return await BgExec.cryptoHashChallengeAnswer(pwd);
    }
    return pwd;
  };

  const decryptAndSaveAttToDownloads = async (encrypted: Att, renderIn: JQuery<HTMLElement>) => {
    const decrypted = await BgExec.cryptoMsgDecrypt(acctEmail, encrypted.data(), await decryptPwd(), true);
    if (decrypted.success) {
      const att = new Att({ name: encrypted.name.replace(/(\.pgp)|(\.gpg)$/, ''), type: encrypted.type, data: decrypted.content.uint8! });
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

  const renderProgress = (element: JQuery<HTMLElement>, percent: number | null, received: number | null, size: number) => {
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
      const att = includedAtts[Number($(target).attr('index') as string)];
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

  const renderPgpSignatureCheckResult = (signature: MsgVerifyResult | null) => {
    if (signature) {
      const signerEmail = signature.contact ? signature.contact.name || senderEmail : senderEmail;
      $('#pgp_signature > .cursive > span').text(String(signerEmail) || 'Unknown Signer');
      if (signature.signer && !signature.contact) {
        $('#pgp_signature').addClass('neutral');
        $('#pgp_signature > .result').text('cannot verify signature');
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
    if (short && storage.admin_codes && storage.admin_codes[short as string] && storage.admin_codes[short as string].codes) {
      adminCodes = storage.admin_codes[short as string].codes;
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
        BrowserMsg.send.subscribeDialog(parentTabId, { source: 'authErr' });
      } else {
        Catch.report('error when extending message expiration', e);
      }
      Xss.sanitizeRender($(self).parent(), 'Error updating expiration. <a href="#" class="retry_expiration_change">Click here to try again</a>').addClass('bad');
      const el = await Ui.event.clicked('.retry_expiration_change');
      await handleExtendMsgExpirationClicked(el);
    }
  };

  const decideDecryptedContentFormattingAndRender = async (decryptedContent: Uint8Array | string, isEncrypted: boolean, sigResult: MsgVerifyResult | null) => {
    setFrameColor(isEncrypted ? 'green' : 'gray');
    renderPgpSignatureCheckResult(sigResult);
    const publicKeys: string[] = [];
    if (decryptedContent instanceof Uint8Array) {
      decryptedContent = Str.fromUint8(decryptedContent); // functions below rely on this: resembles_message, extract_cryptup_attachments, strip_cryptup_reply_token, strip_public_keys
    }
    if (!Mime.resemblesMsg(decryptedContent)) {
      const fcAtts: Att[] = [];
      decryptedContent = Str.extractFcAtts(decryptedContent, fcAtts);
      decryptedContent = Str.stripFcTeplyToken(decryptedContent);
      decryptedContent = Str.stripPublicKeys(decryptedContent, publicKeys);
      if (publicKeys.length) {
        BrowserMsg.send.renderPublicKeys(parentTabId, { afterFrameId: frameId, publicKeys });
      }
      decryptedContent = Xss.escape(decryptedContent);
      await renderContent(doAnchor(decryptedContent.replace(/\n/g, '<br>')), false);
      if (fcAtts.length) {
        renderInnerAtts(fcAtts);
      }
      if (passwordMsgLinkRes && passwordMsgLinkRes.expire) {
        renderFutureExpiration(passwordMsgLinkRes.expire);
      }
    } else {
      renderText('Formatting...');
      const decoded = await Mime.decode(decryptedContent);
      if (typeof decoded.html !== 'undefined') {
        await renderContent(decoded.html, false);
      } else if (typeof decoded.text !== 'undefined') {
        await renderContent(doAnchor(decoded.text.replace(/\n/g, '<br>')), false);
      } else {
        await renderContent((decryptedContent || '').replace(/\n/g, '<br>'), false); // not sure about the replace, time will tell
      }
      const renderableAtts: Att[] = [];
      for (const att of decoded.atts) {
        if (att.treatAs() !== 'publicKey') {
          renderableAtts.push(att);
        } else {
          publicKeys.push(att.asText());
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

  const decryptAndRender = async (optionalPwd: string | null = null) => {
    if (typeof signature !== 'string') {
      const result = await BgExec.cryptoMsgDecrypt(acctEmail, msg as string | Uint8Array, await decryptPwd(optionalPwd));
      if (typeof result === 'undefined') {
        await renderErr(Lang.general.restartBrowserAndTryAgain);
      } else if (result.success) {
        if (hasChallengePassword && optionalPwd) {
          userEnteredMsgPassword = optionalPwd;
        }
        if (result.success && result.signature && result.signature.contact && !result.signature.match && canReadEmails && msgFetchedFromApi !== 'raw') {
          console.info(`re-fetching message ${msgId} from api because failed signature check: ${!msgFetchedFromApi ? 'full' : 'raw'}`);
          await initialize(true);
        } else {
          await decideDecryptedContentFormattingAndRender(result.content.text!, Boolean(result.isEncrypted), result.signature); // text!: did not request uint8
        }
      } else if (result.error.type === DecryptErrTypes.format) {
        if (canReadEmails && msgFetchedFromApi !== 'raw') {
          console.info(`re-fetching message ${msgId} from api because looks like bad formatting: ${!msgFetchedFromApi ? 'full' : 'raw'}`);
          await initialize(true);
        } else {
          await renderErr(Lang.pgpBlock.badFormat + '\n\n' + result.error.error);
        }
      } else if (result.longids.needPassphrase.length) {
        await renderPassphrasePrompt(result.longids.needPassphrase);
      } else {
        const [primaryKi] = await Store.keysGet(acctEmail, ['primary']);
        if (!result.longids.chosen && !primaryKi) {
          await renderErr(Lang.pgpBlock.notProperlySetUp + btnHtml('FlowCrypt settings', 'green settings'));
        } else if (result.error.type === DecryptErrTypes.keyMismatch) {
          if (hasChallengePassword && !optionalPwd) {
            await renderPasswordPrompt('first');
          } else {
            await handlePrivateKeyMismatch(acctEmail, msg as string);
          }
        } else if (result.error.type === DecryptErrTypes.wrongPwd) {
          await renderPasswordPrompt('retry');
        } else if (result.error.type === DecryptErrTypes.usePassword) {
          await renderPasswordPrompt('first');
        } else if (result.error.type === DecryptErrTypes.noMdc) {
          await renderErr('This message may not be safe to open: missing MDC. Please go to FlowCrypt Settings -> Additional Settings -> Exprimental -> Decrypt message without MDC');
        } else if (result.error) {
          await renderErr(`${Lang.pgpBlock.cantOpen}\n\n<em>${result.error.type}: ${result.error.error}</em>`);
        } else { // should generally not happen
          delete result.message;
          await renderErr(Lang.pgpBlock.cantOpen + Lang.pgpBlock.writeMe + '\n\nDiagnostic info: "' + JSON.stringify(result) + '"');
        }
      }
    } else {
      const signatureResult = await BgExec.cryptoMsgVerifyDetached(acctEmail, msg as string | Uint8Array, signature);
      await decideDecryptedContentFormattingAndRender(msg as string, false, signatureResult);
    }
  };

  const renderPassphrasePrompt = async (missingOrWrongPpKeyLongids: string[]) => {
    missingOrWrongPassprases = {};
    const passphrases = await Promise.all(missingOrWrongPpKeyLongids.map(longid => Store.passphraseGet(acctEmail, longid)));
    for (const i of missingOrWrongPpKeyLongids.keys()) {
      missingOrWrongPassprases[missingOrWrongPpKeyLongids[i]] = passphrases[i];
      await renderErr('<a href="#" class="enter_passphrase">' + Lang.pgpBlock.enterPassphrase + '</a> ' + Lang.pgpBlock.toOpenMsg, undefined);
      clearInterval(passphraseInterval);
      passphraseInterval = Catch.setHandledInterval(checkPassphraseChanged, 1000);
      $('.enter_passphrase').click(Ui.event.handle(() => {
        BrowserMsg.send.passphraseDialog(parentTabId, { type: 'message', longids: missingOrWrongPpKeyLongids });
        clearInterval(passphraseInterval);
        passphraseInterval = Catch.setHandledInterval(checkPassphraseChanged, 250);
      }));
    }
  };

  const renderPasswordPrompt = async (attempt: 'first' | 'retry') => {
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
    await decryptAndRender($('#answer').val() as string); // text input
  };

  const checkPassphraseChanged = async () => {
    const longids = Object.keys(missingOrWrongPassprases);
    const updatedPassphrases = await Promise.all(longids.map(longid => Store.passphraseGet(acctEmail, longid)));
    for (const longid of longids) {
      if ((missingOrWrongPassprases[longid] || null) !== updatedPassphrases[longids.indexOf(longid)]) {
        missingOrWrongPassprases = {};
        clearInterval(passphraseInterval);
        await decryptAndRender();
        return;
      }
    }
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
      await renderErr(expirationMsg, null);
      setFrameColor('gray');
      $('.action_security').click(Ui.event.handle(() => BrowserMsg.send.bg.settings({ page: '/chrome/settings/modules/security.htm', acctEmail })));
      $('.extend_expiration').click(Ui.event.handle(renderMsgExpirationRenewOptions));
    } else if (!linkRes.url) {
      await renderErr(Lang.pgpBlock.cannotLocate + Lang.pgpBlock.brokenLink);
    } else {
      await renderErr(Lang.pgpBlock.cannotLocate + Lang.general.writeMeToFixIt + ' Details:\n\n' + Xss.escape(JSON.stringify(linkRes)));
    }
  };

  const initialize = async (forcePullMsgFromApi = false) => {
    try {
      if (canReadEmails && msg && signature === true) {
        renderText('Loading signature...');
        const result = await Api.gmail.msgGet(acctEmail, msgId as string, 'raw');
        if (!result.raw) {
          await decryptAndRender();
        } else {
          msgFetchedFromApi = 'raw';
          const mimeMsg = Str.base64urlDecode(result.raw);
          const parsed = Mime.signed(mimeMsg);
          if (parsed) {
            signature = parsed.signature;
            msg = parsed.signed;
            await decryptAndRender();
          } else {
            const decoded = await Mime.decode(mimeMsg);
            signature = decoded.signature || null;
            console.info('%c[___START___ PROBLEM PARSING THIS MESSSAGE WITH DETACHED SIGNATURE]', 'color: red; font-weight: bold;');
            console.info(mimeMsg);
            console.info('%c[___END___ PROBLEM PARSING THIS MESSSAGE WITH DETACHED SIGNATURE]', 'color: red; font-weight: bold;');
            await decryptAndRender();
          }
        }
      } else if (msg && !forcePullMsgFromApi) { // ascii armored message supplied
        renderText(signature ? 'Verifying..' : 'Decrypting...');
        await decryptAndRender();
      } else if (!msg && hasChallengePassword && short) { // need to fetch the message from FlowCrypt API
        renderText('Loading message...');
        await recoverStoredAdminCodes();
        const msgLinkRes = await Api.fc.linkMessage(short as string);
        passwordMsgLinkRes = msgLinkRes;
        if (msgLinkRes.url) {
          const downloadUintResult = await Api.download(msgLinkRes.url, null);
          msg = Str.fromUint8(downloadUintResult);
          await decryptAndRender();
        } else {
          await renderPasswordEncryptedMsgLoadFail(passwordMsgLinkRes);
        }
      } else {  // need to fetch the inline signed + armored or encrypted +armored message block from gmail api
        if (canReadEmails) {
          renderText('Retrieving message...');
          const format: GmailResponseFormat = (!msgFetchedFromApi) ? 'full' : 'raw';
          msg = await Api.gmail.extractArmoredBlock(acctEmail, msgId as string, format);
          renderText('Decrypting...');
          msgFetchedFromApi = format;
          await decryptAndRender();
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
        await renderErr(`Could not load message due to network error. ${Ui.retryLink()}`);
      } else if (Api.err.isAuthPopupNeeded(e)) {
        BrowserMsg.send.notificationShowAuthPopupNeeded(parentTabId, { acctEmail });
        await renderErr(`Could not load message due to missing auth. ${Ui.retryLink()}`);
      } else if (Value.is(Pgp.armor.headers('publicKey').end as string).in(e.data)) { // public key .end is always string
        window.location.href = Env.urlCreate('pgp_pubkey.htm', { armoredPubkey: e.data, minimized: Boolean(isOutgoing), acctEmail, parentTabId, frameId });
      } else if (Api.err.isStandardErr(e, 'format')) {
        console.log(e.data);
        await renderErr(Lang.pgpBlock.cantOpen + Lang.pgpBlock.badFormat + Lang.pgpBlock.dontKnowHowOpen, e.data);
      } else {
        Catch.handleException(e);
        await renderErr(String(e));
      }
    }
  };

  const storage = await Store.getAcct(acctEmail, ['setup_done', 'google_token_scopes']);
  canReadEmails = Api.gmail.hasScope(storage.google_token_scopes || [], 'read');
  if (storage.setup_done) {
    await initialize();
  } else {
    await renderErr(Lang.pgpBlock.refreshWindow, msg as string || '');
  }

})();
