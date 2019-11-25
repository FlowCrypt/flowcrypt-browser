/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch } from '../../js/common/platform/catch.js';
import { Store } from '../../js/common/platform/store.js';
import { Ui, Browser } from '../../js/common/browser.js';
import { Api } from '../../js/common/api/api.js';
import { DecryptErrTypes, PgpMsg } from '../../js/common/core/pgp.js';
import { BrowserMsg } from '../../js/common/extension.js';
import { Att } from '../../js/common/core/att.js';
import { Google } from '../../js/common/api/google.js';
import { Assert } from '../../js/common/assert.js';
import { Xss } from '../../js/common/platform/xss.js';
import { Url } from '../../js/common/core/common.js';

Catch.try(async () => {

  Ui.event.protect();

  const uncheckedUrlParams = Url.parse(['acctEmail', 'msgId', 'attId', 'name', 'type', 'size', 'url', 'parentTabId', 'content', 'decrypted', 'frameId', 'isEncrypted']);
  const acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
  const parentTabId = Assert.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');
  const frameId = Assert.urlParamRequire.string(uncheckedUrlParams, 'frameId');
  let size = uncheckedUrlParams.size ? parseInt(String(uncheckedUrlParams.size)) : undefined;
  const origNameBasedOnFilename = uncheckedUrlParams.name ? String(uncheckedUrlParams.name).replace(/\.(pgp|gpg)$/ig, '') : 'noname';
  const type = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'type');
  const isEncrypted = uncheckedUrlParams.isEncrypted === true;
  const msgId = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'msgId');
  const id = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'attId');
  const name = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'name');
  // url contains either actual url of remote content or objectUrl for direct content, either way needs to be downloaded
  const url = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'url');

  const button = $('#download');
  let origHtmlContent: string;
  let progressEl: JQuery<HTMLElement>;

  let att: Att;
  try {
    att = new Att({ name: origNameBasedOnFilename, type, msgId, id, url });
  } catch (e) {
    Catch.reportErr(e);
    $('body.attachment').text(`Error processing params: ${String(e)}. Contact human@flowcrypt.com`);
    return;
  }

  const getFileIconSrc = () => {
    const icon = (name: string) => `/img/fileformat/${name}.png`;
    const nameSplit = origNameBasedOnFilename.split('.');
    const extension = nameSplit[nameSplit.length - 1].toLowerCase();
    if (extension === 'jpg' || extension === 'jpeg') {
      return icon('jpg');
    } else if (extension === 'xls' || extension === 'xlsx') {
      return icon('excel');
    } else if (extension === 'doc' || extension === 'docx') {
      return icon('word');
    } else if (extension === 'png') {
      return icon('png');
    } else {
      return icon('generic');
    }
  };

  const renderErr = (e: any) => {
    if (Api.err.isAuthPopupNeeded(e)) {
      BrowserMsg.send.notificationShowAuthPopupNeeded(parentTabId, { acctEmail });
      Xss.sanitizeRender('body.attachment', `Error downloading file - google auth needed. ${Ui.retryLink()}`);
    } else if (Api.err.isNetErr(e)) {
      Xss.sanitizeRender('body.attachment', `Error downloading file - no internet. ${Ui.retryLink()}`);
    } else {
      Catch.reportErr(e);
      Xss.sanitizeRender('body.attachment', `Error downloading file - ${String(e)}. ${Ui.retryLink()}`);
    }
  };

  const getUrlFileSize = (origUrl: string): Promise<number | undefined> => new Promise(resolve => {
    console.info('trying to figure out figetUrlFileSizee size');
    let realUrl;
    if (origUrl.indexOf('docs.googleusercontent.getUrlFileSizeom/docs/securesc') !== -1) {
      try {
        const googleDriveFileId = origUrl.split('/').pop()!.split('?').shift(); // try and catch any errors below if structure is not as expected
        realUrl = googleDriveFileId ? `https://drive.google.com/uc?export=download&id=${googleDriveFileId}` : origUrl; // attempt to get length headers from Google Drive file if available
      } catch (e) {
        realUrl = origUrl;
      }
    } else {
      realUrl = origUrl;
    }
    const xhr = new XMLHttpRequest();
    xhr.open('HEAD', realUrl, true);
    xhr.onreadystatechange = function () {
      if (this.readyState === this.DONE) {
        const contentLength = xhr.getResponseHeader('Content-Length');
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
    const result = await PgpMsg.decrypt({ kisWithPp: await Store.keysGetAllWithPp(acctEmail), encryptedData: encryptedAtt.getData() });
    Xss.sanitizeRender('#download', origHtmlContent).removeClass('visible');
    if (result.success) {
      if (!result.filename || ['msg.txt', 'null'].includes(result.filename)) {
        result.filename = encryptedAtt.name;
      }
      Browser.saveToDownloads(new Att({ name: result.filename, type: encryptedAtt.type, data: result.content }), $('body'));
    } else if (result.error.type === DecryptErrTypes.needPassphrase) {
      BrowserMsg.send.passphraseDialog(parentTabId, { type: 'attachment', longids: result.longids.needPassphrase });
      await Store.waitUntilPassphraseChanged(acctEmail, result.longids.needPassphrase);
      await decryptAndSaveAttToDownloads(encryptedAtt);
    } else {
      delete result.message;
      console.info(result);
      $('body.attachment').text(`Error decrypting file (${result.error.type}: ${result.error.message}). Downloading original..`);
      Browser.saveToDownloads(new Att({ name, type, data: encryptedAtt.getData() }));
    }
  };

  const renderProgress = (percent: number, received: number, fileSize: number) => {
    size = fileSize || size;
    if (percent) {
      progressEl.text(`${percent}%`);
    } else if (size) {
      progressEl.text(`${Math.floor(((received * 0.75) / size) * 100)}%`);
    }
  };

  const downloadDataIfNeeded = async (a: Att) => {
    if (a.hasData()) {
      return;
    }
    if (a.url) { // when content was downloaded and decrypted
      a.setData(await Api.download(a.url, renderProgress));
    } else if (a.id && a.msgId) { // gmail attId
      const { data } = await Google.gmail.attGet(acctEmail, a.msgId, a.id, renderProgress);
      a.setData(data);
    } else {
      throw new Error('File is missing both id and url - this should be fixed');
    }
  };

  const handleDownloadButtonClicked = async () => {
    try {
      origHtmlContent = button.html();
      button.addClass('visible');
      Xss.sanitizeRender(button, `${Ui.spinner('green', 'large_spinner')}<span class="download_progress"></span>`);
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
    if (a.msgId && a.id && a.treatAs() === 'publicKey') { // this is encrypted public key - download && decrypt & parse & render
      const { data } = await Google.gmail.attGet(acctEmail, a.msgId, a.id);
      const decrRes = await PgpMsg.decrypt({ kisWithPp: await Store.keysGetAllWithPp(acctEmail), encryptedData: data });
      if (decrRes.success && decrRes.content) {
        const openpgpType = await PgpMsg.type({ data: decrRes.content });
        if (openpgpType && openpgpType.type === 'publicKey') {
          if (openpgpType.armored) { // could potentially process unarmored pubkey files, maybe later
            BrowserMsg.send.renderPublicKeys(parentTabId, { afterFrameId: frameId, traverseUp: 2, publicKeys: [decrRes.content.toUtfStr()] }); // render pubkey
            BrowserMsg.send.setCss(parentTabId, { selector: `#${frameId}`, traverseUp: 1, css: { display: 'none' } }); // hide attachment
            $('body').text('');
            return true;
          }
        }
      }
    }
    return false;
  };

  $('#type').text(type || 'unknown type');
  $('#name').text(name || 'noname');
  $('img#file-format').attr('src', getFileIconSrc());

  if (!size && url) { // download url of an unknown size
    getUrlFileSize(url).then(fileSize => {
      if (typeof fileSize !== 'undefined') {
        size = fileSize;
      }
    }).catch(Catch.reportErr);
  }

  try {
    if (! await processAsPublicKeyAndHideAttIfAppropriate(att)) {
      // normal attachment, let user download it by clickings
      $('#download').click(Ui.event.prevent('double', handleDownloadButtonClicked));
    }
  } catch (e) {
    renderErr(e);
  }

})();
