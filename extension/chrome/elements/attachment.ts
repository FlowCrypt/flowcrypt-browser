/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store } from '../../js/common/store.js';
import { Catch, Env, Value } from '../../js/common/common.js';
import { Xss, Ui } from '../../js/common/browser.js';
import { Api } from '../../js/common/api.js';
import { Pgp, DecryptErrTypes } from '../../js/common/pgp.js';
import { BrowserMsg } from '../../js/common/extension.js';
import { Att } from '../../js/common/att.js';

Catch.try(async () => {

  Ui.event.protect();

  let urlParams = Env.urlParams(['acctEmail', 'msgId', 'attId', 'name', 'type', 'size', 'url', 'parentTabId', 'content', 'decrypted', 'frameId']);
  let acctEmail = Env.urlParamRequire.string(urlParams, 'acctEmail');
  let parentTabId = Env.urlParamRequire.string(urlParams, 'parentTabId');
  urlParams.size = urlParams.size ? parseInt(urlParams.size as string) : undefined;
  let origNameBasedOnFilename = urlParams.name ? (urlParams.name as string).replace(/\.(pgp|gpg)$/ig, '') : 'noname';

  let decryptedAtt: Att|null = null;
  let encryptedAtt: Att|null = null;
  try {
    if(urlParams.decrypted) {
      decryptedAtt = new Att({name: origNameBasedOnFilename, type: urlParams.type as string|undefined, data: urlParams.decrypted as string});
    } else {
      encryptedAtt = new Att({
        name: origNameBasedOnFilename,
        type: urlParams.type as string|undefined,
        data: urlParams.content as string|undefined,
        msgId: urlParams.msgId as string|undefined,
        id: urlParams.attId as string|undefined,
        url: urlParams.url as string|undefined,
      });
    }
  } catch(e) {
    Catch.handleException(e);
    return $('body.attachment').text(`Error processing params: ${String(e)}. Contact human@flowcrypt.com`);
  }

  let origHtmlContent: string;
  let button = $('#download');
  let progressEl: JQuery<HTMLElement>;

  let passphraseInterval: number|undefined;
  let missingPasspraseLongids: string[] = [];

  $('#type').text(urlParams.type as string);
  $('#name').text(urlParams.name as string);

  $('img#file-format').attr('src', (() => {
    let icon = (name: string) => `/img/fileformat/${name}.png`;
    let nameSplit = origNameBasedOnFilename.split('.');
    let extension = nameSplit[nameSplit.length - 1].toLowerCase();
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

  let checkPassphraseEntered = async () => { // todo - more or less copy-pasted from pgp_block.js, should use a common one. Also similar one in compose.js
    if (missingPasspraseLongids) {
      let passphrases = await Promise.all(missingPasspraseLongids.map(longid => Store.passphraseGet(acctEmail, longid)));
      // todo - copy/pasted - unify
      // further - this approach is outdated and will not properly deal with WRONG passphrases that changed (as opposed to missing)
      // see pgp_block.js for proper common implmenetation
      if (passphrases.filter(passphrase => passphrase !== null).length) {
        missingPasspraseLongids = [];
        clearInterval(passphraseInterval);
        $('#download').click();
      }
    }
  };

  let getUrlFileSize = (origUrl: string): Promise<number|null> => new Promise((resolve, reject) => {
    console.info('trying to figure out file size');
    let url;
    if (Value.is('docs.googleusercontent.com/docs/securesc').in(urlParams.url as string)) {
      try {
        let googleDriveFileId = origUrl.split('/').pop()!.split('?').shift(); // we catch any errors below
        if (googleDriveFileId) {
          url = 'https://drive.google.com/uc?export=download&id=' + googleDriveFileId; // this one can actually give us headers properly
        } else {
          url =  origUrl;
        }
      } catch (e) {
        url =  origUrl;
      }
    } else {
      url = origUrl;
    }
    let xhr = new XMLHttpRequest();
    xhr.open("HEAD", url, true);
    xhr.onreadystatechange = function() {
      if (this.readyState === this.DONE) {
        let size = xhr.getResponseHeader("Content-Length");
        if (size !== null) {
          resolve(parseInt(size));
        } else {
          console.info('was not able to find out file size');
          resolve(null);
        }
      }
    };
    xhr.send();
  });

  let decryptAndSaveAttToDownloads = async (encryptedAtt: Att) => {
    let result = await Pgp.msg.decrypt(acctEmail, encryptedAtt.data(), null, true);
    Xss.sanitizeRender('#download', origHtmlContent).removeClass('visible');
    if (result.success) {
      let name = result.content.filename;
      if (!name || Value.is(name).in(['msg.txt', 'null'])) {
        name = encryptedAtt.name;
      }
      Att.methods.saveToDownloads(new Att({name, type: encryptedAtt.type, data: result.content.uint8!}), $('body')); // uint8!: requested uint8 above
    } else if (result.error.type === DecryptErrTypes.needPassphrase) {
      BrowserMsg.send(parentTabId, 'passphrase_dialog', {type: 'attachment', longids: result.longids.needPassphrase});
      clearInterval(passphraseInterval);
      passphraseInterval = Catch.setHandledInterval(checkPassphraseEntered, 1000);
    } else {
      delete result.message;
      console.info(result);
      $('body.attachment').text('Error opening file. Downloading original..');
      Att.methods.saveToDownloads(new Att({name: urlParams.name as string, type: urlParams.type as string, data: encryptedAtt.data()}));
    }
  };

  if (!urlParams.size && urlParams.url) { // download url of an unknown size
    getUrlFileSize(urlParams.url as string).then(size => {
      if(size !== null) {
        urlParams.size = size;
      }
    }).catch(Catch.rejection);
  }

  let renderProgress = (percent: number, received: number, size: number) => {
    size = size || urlParams.size as number;
    if (percent) {
      progressEl.text(percent + '%');
    } else if (size) {
      progressEl.text(Math.floor(((received * 0.75) / size) * 100) + '%');
    }
  };

  let saveToDownloads = async () => {
    try {
      origHtmlContent = button.html();
      button.addClass('visible');
      Xss.sanitizeRender(button, Ui.spinner('green', 'large_spinner') + '<span class="download_progress"></span>');
      await recoverMissingAttIdIfNeeded();
      progressEl = $('.download_progress');
      if (decryptedAtt) { // when content was downloaded and decrypted
        Att.methods.saveToDownloads(decryptedAtt, Env.browser().name === 'firefox' ? $('body') : null);
      } else if (encryptedAtt && encryptedAtt.hasData()) { // when encrypted content was already downloaded
        await decryptAndSaveAttToDownloads(encryptedAtt);
      } else if (encryptedAtt && encryptedAtt.id && encryptedAtt.msgId) { // gmail attId
        let att = await Api.gmail.attGet(acctEmail, encryptedAtt.msgId, encryptedAtt.id, renderProgress);
        encryptedAtt.setData(att.data);
        await decryptAndSaveAttToDownloads(encryptedAtt!);
      } else if (encryptedAtt && encryptedAtt.url) { // gneneral url to download attachment
        encryptedAtt.setData(await Att.methods.downloadAsUint8(encryptedAtt.url, renderProgress));
        await decryptAndSaveAttToDownloads(encryptedAtt);
      } else {
        throw Error('Missing both id and url');
      }
    } catch(e) {
      if(Api.err.isAuthPopupNeeded(e)) {
        BrowserMsg.send(parentTabId, 'notification_show_auth_popup_needed', {acctEmail});
        Xss.sanitizeRender('body.attachment', `Error downloading file: google auth needed. ${Ui.retryLink()}`);
      } else if(Api.err.isNetErr(e)) {
        Xss.sanitizeRender('body.attachment', `Error downloading file: no internet. ${Ui.retryLink()}`);
      } else {
        Catch.handleException(e);
        Xss.sanitizeRender('body.attachment', `Error downloading file: unknown error. ${Ui.retryLink()}`);
      }
    }
  };

  let recoverMissingAttIdIfNeeded = async () => {
    if (!urlParams.url && !urlParams.attId && urlParams.msgId) {
      try {
        let result = await Api.gmail.msgGet(acctEmail, urlParams.msgId as string, 'full');
        if (result && result.payload && result.payload.parts) {
          for (let attMeta of result.payload.parts) {
            if (attMeta.filename === urlParams.name && attMeta.body && attMeta.body.size === urlParams.size && attMeta.body.attachmentId) {
              urlParams.attId = attMeta.body.attachmentId;
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

  let processAsPublicKeyAndHideAttIfAppropriate = async () => {
    if (encryptedAtt && encryptedAtt.msgId && encryptedAtt.id && encryptedAtt.treatAs() === 'publicKey') {
      // this is encrypted public key - download && decrypt & parse & render
      let att = await Api.gmail.attGet(acctEmail, urlParams.msgId as string, urlParams.attId as string);
      let result = await Pgp.msg.decrypt(acctEmail, att.data);
      if (result.success && result.content.text) {
        let openpgpType = Pgp.msg.type(result.content.text);
        if(openpgpType && openpgpType.type === 'publicKey') {
          if(openpgpType.armored) { // could potentially process unarmored pubkey files, maybe later
            // render pubkey
            BrowserMsg.send(parentTabId, 'render_public_keys', {afterFrameId: urlParams.frameId, traverseUp: 2, publicKeys: [result.content.text]});
            // hide attachment
            BrowserMsg.send(parentTabId, 'set_css', {selector: `#${urlParams.frameId}`, traverseUp: 1, css: {display: 'none'}});
            $('body').text('');
            return true;
          }
        }
      }
    }
    return false;
  };

  try {
    if(!await processAsPublicKeyAndHideAttIfAppropriate()) {
      // normal attachment, let user download it by clicking
      $('#download').click(Ui.event.prevent('double', saveToDownloads));
    }
  } catch (e) {
    if(Api.err.isAuthPopupNeeded(e)) {
      BrowserMsg.send(parentTabId, 'notification_show_auth_popup_needed', {acctEmail});
      Xss.sanitizeRender('body.attachment', `Error downloading file - google auth needed. ${Ui.retryLink()}`);
    } else if(Api.err.isNetErr(e)) {
      Xss.sanitizeRender('body.attachment', `Error downloading file - no internet. ${Ui.retryLink()}`);
    } else {
      Catch.handleException(e);
      Xss.sanitizeRender('body.attachment', `Error downloading file - unknown error. ${Ui.retryLink()}`);
    }
  }

})();
