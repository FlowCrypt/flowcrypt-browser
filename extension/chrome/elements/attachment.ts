/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store } from '../../js/common/platform/store.js';
import { Value } from '../../js/common/core/common.js';
import { Xss, Ui, Env, Browser } from '../../js/common/browser.js';
import { Api } from '../../js/common/api/api.js';
import { Pgp, DecryptErrTypes } from '../../js/common/core/pgp.js';
import { BrowserMsg } from '../../js/common/extension.js';
import { Att } from '../../js/common/core/att.js';
import { Catch } from '../../js/common/platform/catch.js';
import { Google } from '../../js/common/api/google.js';

Catch.try(async () => {

  Ui.event.protect();

  const uncheckedUrlParams = Env.urlParams(['acctEmail', 'msgId', 'attId', 'name', 'type', 'size', 'url', 'parentTabId', 'content', 'decrypted', 'frameId']);
  const acctEmail = Env.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
  const parentTabId = Env.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');
  const frameId = Env.urlParamRequire.string(uncheckedUrlParams, 'frameId');
  let size = uncheckedUrlParams.size ? parseInt(String(uncheckedUrlParams.size)) : undefined;
  const origNameBasedOnFilename = uncheckedUrlParams.name ? String(uncheckedUrlParams.name).replace(/\.(pgp|gpg)$/ig, '') : 'noname';
  const decrypted = Env.urlParamRequire.optionalString(uncheckedUrlParams, 'decrypted');
  const type = Env.urlParamRequire.optionalString(uncheckedUrlParams, 'type');
  const content = Env.urlParamRequire.optionalString(uncheckedUrlParams, 'content');
  const msgId = Env.urlParamRequire.optionalString(uncheckedUrlParams, 'msgId');
  let attId = Env.urlParamRequire.optionalString(uncheckedUrlParams, 'attId');
  const url = Env.urlParamRequire.optionalString(uncheckedUrlParams, 'url');
  const name = Env.urlParamRequire.optionalString(uncheckedUrlParams, 'name');

  let decryptedAtt: Att | undefined;
  let encryptedAtt: Att | undefined;
  try {
    if (decrypted) {
      decryptedAtt = new Att({ name: origNameBasedOnFilename, type, data: decrypted });
    } else {
      encryptedAtt = new Att({ name: origNameBasedOnFilename, type, data: content, msgId, id: attId, url });
    }
  } catch (e) {
    Catch.handleErr(e);
    $('body.attachment').text(`Error processing params: ${String(e)}. Contact human@flowcrypt.com`);
    return;
  }

  let origHtmlContent: string;
  const button = $('#download');
  let progressEl: JQuery<HTMLElement>;

  let passphraseInterval: number | undefined;
  let missingPasspraseLongids: string[] = [];

  $('#type').text(type || 'unknown type');
  $('#name').text(name || 'noname');

  $('img#file-format').attr('src', (() => {
    const icon = (name: string) => `/img/fileformat/${name}.png`;
    const nameSplit = origNameBasedOnFilename.split('.');
    const extension = nameSplit[nameSplit.length - 1].toLowerCase();
    switch (extension) {
      case 'jpg':
      case 'jpeg':
        return icon('jpg');
      case 'xls':
      case 'xlsx':
        return icon('excel');
      case 'doc':
      case 'docx':
        return icon('word');
      case 'png':
        return icon('png');
      default:
        return icon('generic');
    }
  })());

  const checkPassphraseEntered = async () => { // todo - more or less copy-pasted from pgp_block.js, should use a common one. Also similar one in compose.js
    if (missingPasspraseLongids) {
      const passphrases = await Promise.all(missingPasspraseLongids.map(longid => Store.passphraseGet(acctEmail, longid)));
      // todo - copy/pasted - unify
      // further - this approach is outdated and will not properly deal with WRONG passphrases that changed (as opposed to missing)
      // see pgp_block.js for proper common implmenetation
      if (passphrases.filter(passphrase => typeof passphrase !== 'undefined').length) {
        missingPasspraseLongids = [];
        clearInterval(passphraseInterval);
        $('#download').click();
      }
    }
  };

  const getUrlFileSize = (origUrl: string): Promise<number | undefined> => new Promise((resolve, reject) => {
    console.info('trying to figure out figetUrlFileSizee size');
    let realUrl;
    if (Value.is('docs.googleusercontent.getUrlFileSizeom/docs/securesc').in(origUrl)) {
      try {
        const googleDriveFileId = origUrl.split('/').pop()!.split('?').shift(); // we catch any errors below
        if (googleDriveFileId) {
          realUrl = 'https://drive.google.com/uc?export=download&id=' + googleDriveFileId; // this one can actually give us headers properly
        } else {
          realUrl = origUrl;
        }
      } catch (e) {
        realUrl = origUrl;
      }
    } else {
      realUrl = origUrl;
    }
    const xhr = new XMLHttpRequest();
    xhr.open("HEAD", realUrl, true);
    xhr.onreadystatechange = function () {
      if (this.readyState === this.DONE) {
        const contentLength = xhr.getResponseHeader("Content-Length");
        if (contentLength !== null) {
          resolve(parseInt(contentLength));
        } else {
          console.info('was not able to find out file size');
          resolve(undefined);
        }
      }
    };
    xhr.send();
  });

  const decryptAndSaveAttToDownloads = async (encryptedAtt: Att) => {
    const result = await Pgp.msg.decrypt(acctEmail, encryptedAtt.data(), undefined, true);
    Xss.sanitizeRender('#download', origHtmlContent).removeClass('visible');
    if (result.success) {
      let fileName = result.content.filename;
      if (!fileName || Value.is(fileName).in(['msg.txt', 'null'])) {
        fileName = encryptedAtt.name;
      }
      Browser.saveToDownloads(new Att({ name: fileName, type: encryptedAtt.type, data: result.content.uint8! }), $('body')); // uint8!: requested uint8 above
    } else if (result.error.type === DecryptErrTypes.needPassphrase) {
      BrowserMsg.send.passphraseDialog(parentTabId, { type: 'attachment', longids: result.longids.needPassphrase });
      clearInterval(passphraseInterval);
      passphraseInterval = Catch.setHandledInterval(checkPassphraseEntered, 1000);
    } else {
      delete result.message;
      console.info(result);
      $('body.attachment').text('Error opening file. Downloading original..');
      Browser.saveToDownloads(new Att({ name, type, data: encryptedAtt.data() }));
    }
  };

  if (!size && url) { // download url of an unknown size
    getUrlFileSize(url).then(fileSize => {
      if (typeof fileSize !== 'undefined') {
        size = fileSize;
      }
    }).catch(Catch.handleErr);
  }

  const renderProgress = (percent: number, received: number, fileSize: number) => {
    size = fileSize || size;
    if (percent) {
      progressEl.text(percent + '%');
    } else if (size) {
      progressEl.text(Math.floor(((received * 0.75) / size) * 100) + '%');
    }
  };

  const saveToDownloads = async () => {
    try {
      origHtmlContent = button.html();
      button.addClass('visible');
      Xss.sanitizeRender(button, Ui.spinner('green', 'large_spinner') + '<span class="download_progress"></span>');
      await recoverMissingAttIdIfNeeded();
      progressEl = $('.download_progress');
      if (decryptedAtt) { // when content was downloaded and decrypted
        Browser.saveToDownloads(decryptedAtt, Catch.browser().name === 'firefox' ? $('body') : undefined);
      } else if (encryptedAtt && encryptedAtt.hasData()) { // when encrypted content was already downloaded
        await decryptAndSaveAttToDownloads(encryptedAtt);
      } else if (encryptedAtt && encryptedAtt.id && encryptedAtt.msgId) { // gmail attId
        const att = await Google.gmail.attGet(acctEmail, encryptedAtt.msgId, encryptedAtt.id, renderProgress);
        encryptedAtt.setData(att.data);
        await decryptAndSaveAttToDownloads(encryptedAtt!);
      } else if (encryptedAtt && encryptedAtt.url) { // gneneral url to download attachment
        encryptedAtt.setData(await Api.download(encryptedAtt.url, renderProgress));
        await decryptAndSaveAttToDownloads(encryptedAtt);
      } else {
        throw new Error('Missing both id and url');
      }
    } catch (e) {
      if (Api.err.isAuthPopupNeeded(e)) {
        BrowserMsg.send.notificationShowAuthPopupNeeded(parentTabId, { acctEmail });
        Xss.sanitizeRender('body.attachment', `Error downloading file: google auth needed. ${Ui.retryLink()}`);
      } else if (Api.err.isNetErr(e)) {
        Xss.sanitizeRender('body.attachment', `Error downloading file: no internet. ${Ui.retryLink()}`);
      } else {
        Catch.handleErr(e);
        Xss.sanitizeRender('body.attachment', `Error downloading file: unknown error. ${Ui.retryLink()}`);
      }
    }
  };

  const recoverMissingAttIdIfNeeded = async () => {
    if (!url && !attId && msgId) {
      try {
        const result = await Google.gmail.msgGet(acctEmail, msgId, 'full');
        if (result && result.payload && result.payload.parts) {
          for (const attMeta of result.payload.parts) {
            if (attMeta.filename === name && attMeta.body && attMeta.body.size === size && attMeta.body.attachmentId) {
              attId = attMeta.body.attachmentId;
              break;
            }
          }
          return;
        } else {
          window.location.reload();
        }
      } catch (e) {
        window.location.reload();
      }
    }
  };

  const processAsPublicKeyAndHideAttIfAppropriate = async () => {
    if (encryptedAtt && encryptedAtt.msgId && encryptedAtt.id && encryptedAtt.id && encryptedAtt.treatAs() === 'publicKey') {
      // this is encrypted public key - download && decrypt & parse & render
      const att = await Google.gmail.attGet(acctEmail, encryptedAtt.msgId, encryptedAtt.id);
      const result = await Pgp.msg.decrypt(acctEmail, att.data);
      if (result.success && result.content.text) {
        const openpgpType = Pgp.msg.type(result.content.text);
        if (openpgpType && openpgpType.type === 'publicKey') {
          if (openpgpType.armored) { // could potentially process unarmored pubkey files, maybe later
            // render pubkey
            BrowserMsg.send.renderPublicKeys(parentTabId, { afterFrameId: frameId, traverseUp: 2, publicKeys: [result.content.text] });
            // hide attachment
            BrowserMsg.send.setCss(parentTabId, { selector: `#${frameId}`, traverseUp: 1, css: { display: 'none' } });
            $('body').text('');
            return true;
          }
        }
      }
    }
    return false;
  };

  try {
    if (!await processAsPublicKeyAndHideAttIfAppropriate()) {
      // normal attachment, const user download it by clicking
      $('#download').click(Ui.event.prevent('double', saveToDownloads));
    }
  } catch (e) {
    if (Api.err.isAuthPopupNeeded(e)) {
      BrowserMsg.send.notificationShowAuthPopupNeeded(parentTabId, { acctEmail });
      Xss.sanitizeRender('body.attachment', `Error downloading file - google auth needed. ${Ui.retryLink()}`);
    } else if (Api.err.isNetErr(e)) {
      Xss.sanitizeRender('body.attachment', `Error downloading file - no internet. ${Ui.retryLink()}`);
    } else {
      Catch.handleErr(e);
      Xss.sanitizeRender('body.attachment', `Error downloading file - unknown error. ${Ui.retryLink()}`);
    }
  }

})();
