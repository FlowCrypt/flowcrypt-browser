/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store } from '../../js/common/platform/store.js';
import { Value } from '../../js/common/core/common.js';
import { Xss, Ui, Env, Browser } from '../../js/common/browser.js';
import { Api } from '../../js/common/api/api.js';
import { DecryptErrTypes, PgpMsg } from '../../js/common/core/pgp.js';
import { BrowserMsg } from '../../js/common/extension.js';
import { Att } from '../../js/common/core/att.js';
import { Catch } from '../../js/common/platform/catch.js';
import { Google } from '../../js/common/api/google.js';

Catch.try(async () => {

  Ui.event.protect();

  const uncheckedUrlParams = Env.urlParams(['acctEmail', 'msgId', 'attId', 'name', 'type', 'size', 'url', 'parentTabId', 'content', 'decrypted', 'frameId', 'isEncrypted']);
  const acctEmail = Env.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
  const parentTabId = Env.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');
  const frameId = Env.urlParamRequire.string(uncheckedUrlParams, 'frameId');
  let size = uncheckedUrlParams.size ? parseInt(String(uncheckedUrlParams.size)) : undefined;
  const origNameBasedOnFilename = uncheckedUrlParams.name ? String(uncheckedUrlParams.name).replace(/\.(pgp|gpg)$/ig, '') : 'noname';
  const type = Env.urlParamRequire.optionalString(uncheckedUrlParams, 'type');
  const isEncrypted = uncheckedUrlParams.isEncrypted === true;
  const msgId = Env.urlParamRequire.optionalString(uncheckedUrlParams, 'msgId');
  const id = Env.urlParamRequire.optionalString(uncheckedUrlParams, 'attId');
  const name = Env.urlParamRequire.optionalString(uncheckedUrlParams, 'name');
  // either actual url of remote content or objectUrl for direct content, either way needs to be downloaded
  const url = Env.urlParamRequire.optionalString(uncheckedUrlParams, 'url');

  const keyInfosWithPassphrases = await Store.keysGetAllWithPassphrases(acctEmail);

  let att: Att;
  try {
    att = new Att({ name: origNameBasedOnFilename, type, msgId, id, url });
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

  const renderErr = (e: any) => {
    if (Api.err.isAuthPopupNeeded(e)) {
      BrowserMsg.send.notificationShowAuthPopupNeeded(parentTabId, { acctEmail });
      Xss.sanitizeRender('body.attachment', `Error downloading file - google auth needed. ${Ui.retryLink()}`);
    } else if (Api.err.isNetErr(e)) {
      Xss.sanitizeRender('body.attachment', `Error downloading file - no internet. ${Ui.retryLink()}`);
    } else {
      Catch.handleErr(e);
      Xss.sanitizeRender('body.attachment', `Error downloading file - ${String(e)}. ${Ui.retryLink()}`);
    }
  };

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
    const result = await PgpMsg.decrypt(keyInfosWithPassphrases, encryptedAtt.getData(), undefined);
    Xss.sanitizeRender('#download', origHtmlContent).removeClass('visible');
    if (result.success) {
      let fileName = result.content.filename;
      if (!fileName || Value.is(fileName).in(['msg.txt', 'null'])) {
        fileName = encryptedAtt.name;
      }
      Browser.saveToDownloads(new Att({ name: fileName, type: encryptedAtt.type, data: result.content.uint8 }), $('body')); // uint8!: requested uint8 above
    } else if (result.error.type === DecryptErrTypes.needPassphrase) {
      BrowserMsg.send.passphraseDialog(parentTabId, { type: 'attachment', longids: result.longids.needPassphrase });
      clearInterval(passphraseInterval);
      passphraseInterval = Catch.setHandledInterval(checkPassphraseEntered, 1000);
    } else {
      delete result.message;
      console.info(result);
      $('body.attachment').text(`Error decrypting file (${result.error.type}: ${result.error.error}). Downloading original..`);
      Browser.saveToDownloads(new Att({ name, type, data: encryptedAtt.getData() }));
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

  const downloadDataIfNeeded = async (a: Att) => {
    if (a.hasData()) {
      return;
    }
    if (a.url!) { // when content was downloaded and decrypted
      a.setData(await Api.download(a.url!, renderProgress));
    } else if (a.id && a.msgId) { // gmail attId
      const { data } = await Google.gmail.attGet(acctEmail, a.msgId, a.id, renderProgress);
      a.setData(data);
    } else {
      throw new Error('Missing both id and url');
    }
  };

  const handleDownloadButtonClicked = async () => {
    try {
      origHtmlContent = button.html();
      button.addClass('visible');
      Xss.sanitizeRender(button, Ui.spinner('green', 'large_spinner') + '<span class="download_progress"></span>');
      progressEl = $('.download_progress');
      await recoverMissingAttIdIfNeeded(att);
      await downloadDataIfNeeded(att);
      if (!isEncrypted) {
        Browser.saveToDownloads(att, Catch.browser().name === 'firefox' ? $('body') : undefined);
      } else {
        await decryptAndSaveAttToDownloads(att);
      }
    } catch (e) {
      renderErr(e);
    }
  };

  const recoverMissingAttIdIfNeeded = async (a: Att) => {
    if (!a.url && !a.id && a.msgId) {
      const result = await Google.gmail.msgGet(acctEmail, a.msgId, 'full');
      if (result && result.payload && result.payload.parts) {
        for (const attMeta of result.payload.parts) {
          if (attMeta.filename === name && attMeta.body && attMeta.body.size === size && attMeta.body.attachmentId) {
            a.id = attMeta.body.attachmentId;
            return;
          }
        }
      } else {
        throw new Error('Could not recover missing attachmentId');
      }
    }
  };

  const processAsPublicKeyAndHideAttIfAppropriate = async (a: Att) => {
    if (a.msgId && a.id && a.treatAs() === 'publicKey') {
      // this is encrypted public key - download && decrypt & parse & render
      const { data } = await Google.gmail.attGet(acctEmail, a.msgId, a.id);
      const decrRes = await PgpMsg.decrypt(keyInfosWithPassphrases, data);
      if (decrRes.success && decrRes.content.uint8) {
        const openpgpType = await PgpMsg.type(decrRes.content.uint8);
        if (openpgpType && openpgpType.type === 'publicKey') {
          if (openpgpType.armored) { // could potentially process unarmored pubkey files, maybe later
            // render pubkey
            BrowserMsg.send.renderPublicKeys(parentTabId, { afterFrameId: frameId, traverseUp: 2, publicKeys: [decrRes.content.uint8.toUtfStr()] });
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
    if (! await processAsPublicKeyAndHideAttIfAppropriate(att)) {
      // normal attachment, const user download it by clickings
      $('#download').click(Ui.event.prevent('double', handleDownloadButtonClicked));
    }
  } catch (e) {
    renderErr(e);
  }

})();
