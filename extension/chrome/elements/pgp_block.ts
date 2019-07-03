/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch } from '../../js/common/platform/catch.js';
import { Store } from '../../js/common/platform/store.js';
import { Str } from '../../js/common/core/common.js';
import { Att } from '../../js/common/core/att.js';
import { Xss, Ui, Env, Browser } from '../../js/common/browser.js';
import { BrowserMsg } from '../../js/common/extension.js';
import { Lang } from '../../js/common/lang.js';
import { Api } from '../../js/common/api/api.js';
import { MsgVerifyResult, DecryptErrTypes, FormatError, PgpMsg } from '../../js/common/core/pgp.js';
import { Mime, MsgBlock } from '../../js/common/core/mime.js';
import { Google, GmailResponseFormat, GoogleAuth } from '../../js/common/api/google.js';
import { Buf } from '../../js/common/core/buf.js';
import { BackendRes, Backend } from '../../js/common/api/backend.js';
import { Assert } from '../../js/common/assert.js';
import { Attester } from '../../js/common/api/attester.js';

Catch.try(async () => {

  Ui.event.protect();

  const uncheckedUrlParams = Env.urlParams(['acctEmail', 'frameId', 'message', 'parentTabId', 'msgId', 'isOutgoing', 'senderEmail', 'hasPassword', 'signature', 'short']);
  const acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
  const parentTabId = Assert.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');
  const frameId = Assert.urlParamRequire.string(uncheckedUrlParams, 'frameId');
  const hasChallengePassword = uncheckedUrlParams.hasPassword === true;
  const isOutgoing = uncheckedUrlParams.isOutgoing === true;
  const short = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'short');
  const senderEmail = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'senderEmail');
  const msgId = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'msgId');
  const heightHistory: number[] = [];
  const encryptedMsgUrlParam = uncheckedUrlParams.message ? Buf.fromUtfStr(Assert.urlParamRequire.string(uncheckedUrlParams, 'message')) : undefined;
  let signature = uncheckedUrlParams.signature === true ? true : (uncheckedUrlParams.signature ? String(uncheckedUrlParams.signature) : undefined);
  let msgFetchedFromApi: false | GmailResponseFormat = false;
  let includedAtts: Att[] = [];
  let canReadEmails: undefined | boolean;
  let passwordMsgLinkRes: BackendRes.FcLinkMsg;
  let adminCodes: string[];
  let userEnteredMsgPassword: string | undefined;

  const renderText = (text: string) => {
    document.getElementById('pgp_block')!.innerText = text;
  };

  const sendResizeBrowserMsg = () => {
    let height = Math.max($('#pgp_block').height()!, 20) + 40;
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

  const displayImageSrcLinkAsImg = (a: HTMLAnchorElement, event: JQuery.Event<HTMLAnchorElement, null>) => {
    const img = document.createElement('img');
    img.setAttribute('style', a.getAttribute('style') || '');
    img.style.background = 'none';
    img.style.border = 'none';
    img.addEventListener('load', () => sendResizeBrowserMsg());
    if (a.href.indexOf('cid:') === 0) { // image included in the email
      const contentId = a.href.replace(/^cid:/g, '');
      const content = includedAtts.filter(a => a.type.indexOf('image/') === 0 && a.cid === `<${contentId}>`)[0];
      if (content) {
        img.src = `data:${a.type};base64,${content.getData().toBase64Str()}`;
        a.outerHTML = img.outerHTML; // xss-safe-value - img.outerHTML was built using dom node api
      } else {
        a.outerHTML = Xss.escape(`[broken link: ${a.href}]`); // xss-escaped
      }
    } else if (a.href.indexOf('https://') === 0 || a.href.indexOf('http://') === 0) { // image referenced as url
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
    if (isErr) {
      $('.action_show_raw_pgp_block').click(Ui.event.handle(target => {
        $('.raw_pgp_block').css('display', 'block');
        $(target).css('display', 'none');
        sendResizeBrowserMsg();
      }));
    }
    sendResizeBrowserMsg(); // resize window now
    Catch.setHandledTimeout(() => $(window).resize(Ui.event.prevent('spree', sendResizeBrowserMsg)), 1000); // start auto-resizing the window after 1s
  };

  const btnHtml = (text: string, addClasses: string) => {
    return `<div class="button long ${addClasses}" style="margin:30px 0;" target="cryptup">${text}</div>`;
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

  const renderErr = async (errBoxContent: string, renderRawMsg: string | undefined) => {
    setFrameColor('red');
    const showRawMsgPrompt = renderRawMsg ? '<a href="#" class="action_show_raw_pgp_block">show original message</a>' : '';
    await renderContent(`<div class="error">${errBoxContent.replace(/\n/g, '<br>')}</div>${showRawMsgPrompt}`, true);
    $('.action_show_raw_pgp_block').click(Ui.event.handle(async () => { // this may contain content missing MDC
      Xss.sanitizeAppend('#pgp_block', `<div class="raw_pgp_block">${Xss.escape(renderRawMsg!)}</div>`); // therefore the .escape is crucial
    }));
    $('.button.settings_keyserver').click(Ui.event.handle(() => BrowserMsg.send.bg.settings({ acctEmail, page: '/chrome/settings/modules/keyserver.htm' })));
    $('.button.settings').click(Ui.event.handle(() => BrowserMsg.send.bg.settings({ acctEmail })));
    $('.button.settings_add_key').click(Ui.event.handle(() => BrowserMsg.send.bg.settings({ acctEmail, page: '/chrome/settings/modules/add_key.htm' })));
    $('.button.reply_pubkey_mismatch').click(Ui.event.handle(() => BrowserMsg.send.replyPubkeyMismatch(parentTabId)));
    Ui.setTestState('ready');
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
    const pwd = suppliedPwd || userEnteredMsgPassword;
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
      sendResizeBrowserMsg();
    } else {
      delete decrypted.message;
      console.info(decrypted);
      await Ui.modal.error(`There was a problem decrypting this file (${decrypted.error.type}: ${decrypted.error.message}). Downloading encrypted original.`);
      Browser.saveToDownloads(encrypted, renderIn);
      sendResizeBrowserMsg();
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
    sendResizeBrowserMsg();
    $('div.attachment').click(Ui.event.prevent('double', async target => {
      const att = includedAtts[Number($(target).attr('index'))];
      if (att.hasData()) {
        Browser.saveToDownloads(att, $(target));
        sendResizeBrowserMsg();
      } else {
        Xss.sanitizePrepend($(target).find('.progress'), Ui.spinner('green'));
        att.setData(await Api.download(att.url!, (perc, load, total) => renderProgress($(target).find('.progress .percent'), perc, load, total || att.length)));
        await Ui.delay(100); // give browser time to render
        $(target).find('.progress').text('');
        await decryptAndSaveAttToDownloads(att, $(target));
      }
    }));
  };

  const renderPgpSignatureCheckMissingPubkeyOptions = async (signerLongid: string, senderEmail: string | undefined): Promise<void> => { // don't have appropriate pubkey by longid in contacts
    const render = (note: string, action: () => void) => $('#pgp_signature').addClass('neutral').find('.result').text(note).click(Ui.event.handle(action));
    try {
      if (senderEmail) { // we know who sent it
        const [senderContactByEmail] = await Store.dbContactGet(undefined, [senderEmail]);
        if (senderContactByEmail) {
          render(`Found the right pubkey ${signerLongid} on keyserver, but will not use it because you have conflicting pubkey ${senderContactByEmail.longid} loaded.`, () => undefined);
          return;
        } // ---> and user doesn't have pubkey for that email addr
        const { pubkey, pgpClient } = await Attester.lookupEmail(senderEmail);
        if (!pubkey) {
          render(`Missing pubkey ${signerLongid}`, () => undefined);
          return;
        } // ---> and pubkey found on keyserver by sender email
        const { keys: [keyDetails] } = await BrowserMsg.send.bg.await.pgpKeyDetails({ pubkey });
        if (!keyDetails || !keyDetails.ids.map(ids => ids.longid).includes(signerLongid)) {
          render(`Fetched signing pubkey ${signerLongid}, but cannot confirm it\'s the right one. Click to load pubkey and verify anyway.`, async () => {
            await Store.dbContactSave(undefined, await Store.dbContactObj({ email: senderEmail, pubkey, client: pgpClient })); // TOFU manual import option
            window.location.reload();
          });
        } // ---> and longid it matches signature
        await Store.dbContactSave(undefined, await Store.dbContactObj({ email: senderEmail, pubkey, client: pgpClient })); // <= TOFU auto-import
        render('Fetched pubkey, click to verify', () => window.location.reload());
      } else { // don't know who sent it
        const { pubkey, pgpClient } = await Attester.lookupEmail(signerLongid);
        if (!pubkey) { // but can find matching pubkey by longid on keyserver
          render(`Could not find sender's pubkey anywhere: ${signerLongid}`, () => undefined);
          return;
        }
        const { keys: [keyDetails] } = await BrowserMsg.send.bg.await.pgpKeyDetails({ pubkey });
        const pubkeyEmail = Str.parseEmail(keyDetails.users[0] || '').email!;
        if (!pubkeyEmail) {
          render(`Fetched matching pubkey ${signerLongid} but no valid email address is listed in it.`, () => undefined);
          return;
        }
        const [conflictingContact] = await Store.dbContactGet(undefined, [pubkeyEmail]);
        if (conflictingContact) {
          render(`Fetched matching pubkey ${signerLongid} but conflicting key is in local contacts ${conflictingContact.longid} for email ${pubkeyEmail}, cannot verify.`, () => undefined);
          return;
        }
        render(`Fetched matching pubkey ${signerLongid}. Click to load and use it.`, async () => {
          await Store.dbContactSave(undefined, await Store.dbContactObj({ email: pubkeyEmail, pubkey, client: pgpClient })); // TOFU manual import
          window.location.reload();
        });
      }
    } catch (e) {
      if (Api.err.isSignificant(e)) {
        Catch.reportErr(e);
        render(`Could not load sender pubkey ${signerLongid} due to an error.`, () => undefined);
      } else {
        render(`Could not look up sender's pubkey due to network error, click to retry.`, () => window.location.reload());
      }
    }
  };

  const renderPgpSignatureCheckResult = (signature: MsgVerifyResult | undefined) => {
    if (signature) {
      const signerEmail = signature.contact ? signature.contact.name || senderEmail : senderEmail;
      $('#pgp_signature > .cursive > span').text(String(signerEmail) || 'Unknown Signer');
      if (signature.signer && !signature.contact) {
        renderPgpSignatureCheckMissingPubkeyOptions(signature.signer, senderEmail).catch(Catch.reportErr); // async so that it doesn't slow down rendering
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
        await Ui.modal.warning('Your trial has ended. Please renew your subscription to proceed.');
      } else {
        await Ui.modal.info('FlowCrypt Advanced users can choose expiration of password encrypted messages. Try it free.');
      }
      BrowserMsg.send.subscribeDialog(parentTabId, {});
    }
  };

  const handleExtendMsgExpirationClicked = async (self: HTMLElement) => {
    const nDays = Number($(self).attr('href')!.replace('#', ''));
    Xss.sanitizeRender($(self).parent(), `Updating..${Ui.spinner('green')}`);
    try {
      const r = await Backend.messageExpiration(adminCodes, nDays);
      if (r.updated) { // todo - make backend return http error code when not updated, and skip this if/else
        window.location.reload();
      } else {
        throw r;
      }
    } catch (e) {
      if (Api.err.isAuthErr(e)) {
        await Ui.modal.warning('Your FlowCrypt account information is outdated, please review your account settings.');
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
    let renderableAtts: Att[] = [];
    let decryptedContent = decryptedBytes.toUtfStr();
    let isHtml: boolean = false;
    // todo - replace with PgpMsg.fmtDecrypted
    if (!Mime.resemblesMsg(decryptedBytes)) {
      const fcAttBlocks: MsgBlock[] = [];
      decryptedContent = PgpMsg.extractFcAtts(decryptedContent, fcAttBlocks);
      decryptedContent = PgpMsg.stripFcTeplyToken(decryptedContent);
      decryptedContent = PgpMsg.stripPublicKeys(decryptedContent, publicKeys);
      if (fcAttBlocks.length) {
        renderableAtts = fcAttBlocks.map(attBlock => new Att(attBlock.attMeta!));
      }
    } else {
      renderText('Formatting...');
      const decoded = await Mime.decode(decryptedBytes);
      if (typeof decoded.html !== 'undefined') {
        decryptedContent = decoded.html;
        isHtml = true;
      } else if (typeof decoded.text !== 'undefined') {
        decryptedContent = decoded.text;
      }
      for (const att of decoded.atts) {
        if (att.treatAs() !== 'publicKey') {
          renderableAtts.push(att);
        } else {
          publicKeys.push(att.getData().toUtfStr());
        }
      }
    }
    await separateQuotedContentAndRenderText(decryptedContent, isHtml);
    if (publicKeys.length) {
      BrowserMsg.send.renderPublicKeys(parentTabId, { afterFrameId: frameId, publicKeys });
    }
    if (renderableAtts.length) {
      renderInnerAtts(renderableAtts);
    }
    if (passwordMsgLinkRes && passwordMsgLinkRes.expire) {
      renderFutureExpiration(passwordMsgLinkRes.expire);
    }
    sendResizeBrowserMsg();
    Ui.setTestState('ready');
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
          await renderErr(Lang.pgpBlock.badFormat + '\n\n' + result.error.message, encryptedData.toUtfStr());
        }
      } else if (result.longids.needPassphrase.length) {
        await renderErr(`<a href="#" class="enter_passphrase" data-test="action-show-passphrase-dialog">${Lang.pgpBlock.enterPassphrase}</a> ${Lang.pgpBlock.toOpenMsg}`, undefined);
        $('.enter_passphrase').click(Ui.event.handle(() => {
          Ui.setTestState('waiting');
          BrowserMsg.send.passphraseDialog(parentTabId, { type: 'message', longids: result.longids.needPassphrase });
        }));
        await Store.waitUntilPassphraseChanged(acctEmail, result.longids.needPassphrase);
        renderText('Decrypting...');
        await decryptAndRender(encryptedData, optionalPwd);
      } else {
        const [primaryKi] = await Store.keysGet(acctEmail, ['primary']);
        if (!result.longids.chosen && !primaryKi) {
          await renderErr(Lang.pgpBlock.notProperlySetUp + btnHtml('FlowCrypt settings', 'green settings'), undefined);
        } else if (result.error.type === DecryptErrTypes.keyMismatch) {
          if (hasChallengePassword && !optionalPwd) {
            const pwd = await renderPasswordPromptAndAwaitEntry('first');
            await decryptAndRender(encryptedData, pwd);
          } else {
            await handlePrivateKeyMismatch(acctEmail, encryptedData);
          }
        } else if (result.error.type === DecryptErrTypes.wrongPwd) {
          const pwd = await renderPasswordPromptAndAwaitEntry('retry');
          await decryptAndRender(encryptedData, pwd);
        } else if (result.error.type === DecryptErrTypes.usePassword) {
          const pwd = await renderPasswordPromptAndAwaitEntry('first');
          await decryptAndRender(encryptedData, pwd);
        } else if (result.error.type === DecryptErrTypes.noMdc) {
          await renderErr(result.error.message, result.content!.toUtfStr()); // missing mdc - only render the result after user confirmation
        } else if (result.error) {
          await renderErr(`${Lang.pgpBlock.cantOpen}\n\n<em>${result.error.type}: ${result.error.message}</em>`, encryptedData.toUtfStr());
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

  const renderPasswordPromptAndAwaitEntry = async (attempt: 'first' | 'retry'): Promise<string> => {
    let prompt = `<p>${attempt === 'first' ? '' : `<span style="color: red; font-weight: bold;">${Lang.pgpBlock.wrongPassword}</span>`}${Lang.pgpBlock.decryptPasswordPrompt}</p>`;
    const btn = `<div class="button green long decrypt" data-test="action-decrypt-with-password">decrypt message</div>`;
    prompt += `<p><input id="answer" placeholder="Password" data-test="input-message-password"></p><p>${btn}</p>`;
    await renderContent(prompt, true);
    Ui.setTestState('ready');
    await Ui.event.clicked('.button.decrypt');
    Ui.setTestState('working'); // so that test suite can wait until ready again
    $(self).text('Opening');
    await Ui.delay(50); // give browser time to render
    return String($('#answer').val());
  };

  const renderPasswordEncryptedMsgLoadFail = async (linkRes: BackendRes.FcLinkMsg) => {
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

  const separateQuotedContentAndRenderText = async (decryptedContent: string, isHtml: boolean) => {
    if (isHtml) {
      const message = $('<div>').html(Xss.htmlSanitize(decryptedContent)); // xss-sanitized
      let htmlBlockQuoteExists: boolean = false;
      const shouldBeQuoted: Array<Element> = [];
      for (let i = message[0].children.length - 1; i >= 0; i--) {
        if (['BLOCKQUOTE', 'BR', 'PRE'].includes(message[0].children[i].nodeName)) {
          shouldBeQuoted.push(message[0].children[i]);
          if (message[0].children[i].nodeName === 'BLOCKQUOTE') {
            htmlBlockQuoteExists = true;
            break;
          }
          continue;
        } else {
          break;
        }
      }
      if (htmlBlockQuoteExists) {
        let quotedHtml = '';
        for (let i = shouldBeQuoted.length - 1; i >= 0; i--) {
          message[0].removeChild(shouldBeQuoted[i]);
          quotedHtml += shouldBeQuoted[i].outerHTML;
        }
        await renderContent(message.html(), false);
        appendCollapsedQuotedContentButton(quotedHtml, true);
      } else {
        await renderContent(decryptedContent, false);
      }
    } else {
      const lines = decryptedContent.trim().split(/\r?\n/);
      const linesQuotedPart: string[] = [];
      while (lines.length) {
        const lastLine = lines.pop()!; // lines.length above ensures there is a line
        if (lastLine[0] === '>' || !lastLine.length) { // look for lines starting with '>' or empty lines, from last line up (sometimes quoted content may have empty lines in it)
          linesQuotedPart.unshift(lastLine);
        } else { // found first non-quoted part from the bottom, push it back & finish
          lines.push(lastLine);
          break;
        }
      }
      if (linesQuotedPart.length && !lines.length) { // only got quoted part, no real text -> show everything as real text, without quoting
        lines.push(...linesQuotedPart.splice(0, linesQuotedPart.length));
      }
      await renderContent(Xss.escapeTextAsRenderableHtml(lines.join('\n')), false);
      if (linesQuotedPart.length) {
        appendCollapsedQuotedContentButton(linesQuotedPart.join('\n'));
      }
    }
  };

  const appendCollapsedQuotedContentButton = (message: string, isHtml: boolean = false) => {
    const pgpBlk = $("#pgp_block");
    pgpBlk.append('<div id="action_show_quoted_content" data-test="action-show-quoted-content" class="three_dots"><img src="/img/svgs/three-dots.svg" /></div>'); // xss-direct
    pgpBlk.append(`<div class="quoted_content">${Xss.htmlSanitizeKeepBasicTags(isHtml ? message : Xss.escapeTextAsRenderableHtml(message))}</div>`); // xss-sanitized
    pgpBlk.find('#action_show_quoted_content').click(Ui.event.handle(async target => {
      $(".quoted_content").css('display', $(".quoted_content").css('display') === 'none' ? 'block' : 'none');
      sendResizeBrowserMsg();
    }));
  };

  const initialize = async (forcePullMsgFromApi = false) => {
    try {
      if (canReadEmails && signature === true && msgId) {
        renderText('Loading signed message...');
        const { raw } = await Google.gmail.msgGet(acctEmail, msgId, 'raw');
        msgFetchedFromApi = 'raw';
        const mimeMsg = Buf.fromBase64UrlStr(raw!); // used 'raw' above
        const parsed = await Mime.decode(mimeMsg);
        if (parsed && typeof parsed.rawSignedContent === 'string' && parsed.signature) {
          signature = parsed.signature;
          await decryptAndRender(Buf.fromUtfStr(parsed.rawSignedContent));
        } else {
          await renderErr('Error: could not properly parse signed message', parsed.rawSignedContent || parsed.text || parsed.html || mimeMsg.toUtfStr());
        }
      } else if (encryptedMsgUrlParam && !forcePullMsgFromApi) { // ascii armored message supplied
        renderText(signature ? 'Verifying..' : 'Decrypting...');
        await decryptAndRender(encryptedMsgUrlParam);
      } else if (!encryptedMsgUrlParam && hasChallengePassword && short) { // need to fetch the message from FlowCrypt API
        renderText('Loading message...');
        await recoverStoredAdminCodes();
        const msgLinkRes = await Backend.linkMessage(short);
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
          sendResizeBrowserMsg();
        } else if (canReadEmails) {
          renderText('Retrieving message...');
          const format: GmailResponseFormat = (!msgFetchedFromApi) ? 'full' : 'raw';
          const extracted = await Google.gmail.extractArmoredBlock(acctEmail, msgId, format, (progress) => {
            renderText(`Retrieving message... ${progress}%`);
          });
          renderText('Decrypting...');
          msgFetchedFromApi = format;
          await decryptAndRender(Buf.fromUtfStr(extracted));
        } else { // gmail message read auth not allowed
          // tslint:disable-next-line:max-line-length
          const readAccess = `Your browser needs to access gmail it in order to decrypt and display the message.<br/><br/><div class="button green auth_settings">Add missing permission</div>`;
          Xss.sanitizeRender('#pgp_block', `This encrypted message is very large (possibly containing an attachment). ${readAccess}`);
          sendResizeBrowserMsg();
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
        await renderErr(Lang.pgpBlock.cantOpen + Lang.pgpBlock.badFormat + Lang.pgpBlock.dontKnowHowOpen, e.data);
      } else if (Api.err.isInPrivateMode(e)) {
        await renderErr(`Error: FlowCrypt extension cannot communicate with its background script to decrypt this message.
  On Firefox, this is commonly caused by the Private Browsing Mode or the use of Firefox Containers.`, undefined);
      } else {
        Catch.reportErr(e);
        await renderErr(String(e), encryptedMsgUrlParam ? encryptedMsgUrlParam.toUtfStr() : undefined);
      }
    }
  };

  const storage = await Store.getAcct(acctEmail, ['setup_done', 'google_token_scopes']);
  canReadEmails = GoogleAuth.hasReadScope(storage.google_token_scopes || []);
  if (storage.setup_done) {
    await initialize();
  } else {
    await renderErr(Lang.pgpBlock.refreshWindow, encryptedMsgUrlParam ? encryptedMsgUrlParam.toUtfStr() : undefined);
  }

})();
