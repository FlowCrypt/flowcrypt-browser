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

  let urlParams = Env.urlParams(['account_email', 'message_id', 'attachment_id', 'name', 'type', 'size', 'url', 'parent_tab_id', 'content', 'decrypted', 'frame_id']);
  let account_email = Env.urlParamRequire.string(urlParams, 'account_email');
  let parent_tab_id = Env.urlParamRequire.string(urlParams, 'parent_tab_id');
  urlParams.size = urlParams.size ? parseInt(urlParams.size as string) : undefined;
  let original_name_based_on_filename = urlParams.name ? (urlParams.name as string).replace(/\.(pgp|gpg)$/ig, '') : 'noname';

  let decrypted_a: Att|null = null;
  let encrypted_a: Att|null = null;
  try {
    if(urlParams.decrypted) {
      decrypted_a = new Att({name: original_name_based_on_filename, type: urlParams.type as string|undefined, data: urlParams.decrypted as string});
    } else {
      encrypted_a = new Att({
        name: original_name_based_on_filename,
        type: urlParams.type as string|undefined,
        data: urlParams.content as string|undefined,
        msgId: urlParams.message_id as string|undefined,
        id: urlParams.attachment_id as string|undefined,
        url: urlParams.url as string|undefined,
      });
    }
  } catch(e) {
    Catch.handle_exception(e);
    return $('body.attachment').text(`Error processing params: ${String(e)}. Contact human@flowcrypt.com`);
  }

  let original_html_content: string;
  let button = $('#download');
  let progress_element: JQuery<HTMLElement>;

  let passphrase_interval: number|undefined;
  let missing_passprase_longids: string[] = [];

  $('#type').text(urlParams.type as string);
  $('#name').text(urlParams.name as string);

  $('img#file-format').attr('src', (() => {
    let icon = (name: string) => `/img/fileformat/${name}.png`;
    let name_split = original_name_based_on_filename.split('.');
    let extension = name_split[name_split.length - 1].toLowerCase();
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

  let check_passphrase_entered = async () => { // todo - more or less copy-pasted from pgp_block.js, should use a common one. Also similar one in compose.js
    if (missing_passprase_longids) {
      let passphrases = await Promise.all(missing_passprase_longids.map(longid => Store.passphrase_get(account_email, longid)));
      // todo - copy/pasted - unify
      // further - this approach is outdated and will not properly deal with WRONG passphrases that changed (as opposed to missing)
      // see pgp_block.js for proper common implmenetation
      if (passphrases.filter(passphrase => passphrase !== null).length) {
        missing_passprase_longids = [];
        clearInterval(passphrase_interval);
        $('#download').click();
      }
    }
  };

  let get_url_file_size = (original_url: string): Promise<number|null> => new Promise((resolve, reject) => {
    console.info('trying to figure out file size');
    let url;
    if (Value.is('docs.googleusercontent.com/docs/securesc').in(urlParams.url as string)) {
      try {
        let google_drive_file_id = original_url.split('/').pop()!.split('?').shift(); // we catch any errors below
        if (google_drive_file_id) {
          url = 'https://drive.google.com/uc?export=download&id=' + google_drive_file_id; // this one can actually give us headers properly
        } else {
          url =  original_url;
        }
      } catch (e) {
        url =  original_url;
      }
    } else {
      url = original_url;
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

  let decrypt_and_save_att_to_downloads = async (enc_a: Att) => {
    let result = await Pgp.msg.decrypt(account_email, enc_a.data(), null, true);
    Xss.sanitizeRender('#download', original_html_content).removeClass('visible');
    if (result.success) {
      let name = result.content.filename;
      if (!name || Value.is(name).in(['msg.txt', 'null'])) {
        name = enc_a.name;
      }
      Att.methods.saveToDownloads(new Att({name, type: enc_a.type, data: result.content.uint8!}), $('body')); // uint8!: requested uint8 above
    } else if (result.error.type === DecryptErrTypes.need_passphrase) {
      BrowserMsg.send(parent_tab_id, 'passphrase_dialog', {type: 'attachment', longids: result.longids.need_passphrase});
      clearInterval(passphrase_interval);
      passphrase_interval = Catch.setHandledInterval(check_passphrase_entered, 1000);
    } else {
      delete result.message;
      console.info(result);
      $('body.attachment').text('Error opening file. Downloading original..');
      Att.methods.saveToDownloads(new Att({name: urlParams.name as string, type: urlParams.type as string, data: enc_a.data()}));
    }
  };

  if (!urlParams.size && urlParams.url) { // download url of an unknown size
    get_url_file_size(urlParams.url as string).then(size => {
      if(size !== null) {
        urlParams.size = size;
      }
    }).catch(Catch.rejection);
  }

  let render_progress = (percent: number, received: number, size: number) => {
    size = size || urlParams.size as number;
    if (percent) {
      progress_element.text(percent + '%');
    } else if (size) {
      progress_element.text(Math.floor(((received * 0.75) / size) * 100) + '%');
    }
  };

  let save_to_downloads = async () => {
    try {
      original_html_content = button.html();
      button.addClass('visible');
      Xss.sanitizeRender(button, Ui.spinner('green', 'large_spinner') + '<span class="download_progress"></span>');
      await recover_missing_att_id_if_needed();
      progress_element = $('.download_progress');
      if (decrypted_a) { // when content was downloaded and decrypted
        Att.methods.saveToDownloads(decrypted_a, Env.browser().name === 'firefox' ? $('body') : null);
      } else if (encrypted_a && encrypted_a.hasData()) { // when encrypted content was already downloaded
        await decrypt_and_save_att_to_downloads(encrypted_a);
      } else if (encrypted_a && encrypted_a.id && encrypted_a.msgId) { // gmail attachment_id
        let att = await Api.gmail.attGet(account_email, encrypted_a.msgId, encrypted_a.id, render_progress);
        encrypted_a.setData(att.data);
        await decrypt_and_save_att_to_downloads(encrypted_a!);
      } else if (encrypted_a && encrypted_a.url) { // gneneral url to download attachment
        encrypted_a.setData(await Att.methods.downloadAsUint8(encrypted_a.url, render_progress));
        await decrypt_and_save_att_to_downloads(encrypted_a);
      } else {
        throw Error('Missing both id and url');
      }
    } catch(e) {
      if(Api.err.isAuthPopupNeeded(e)) {
        BrowserMsg.send(parent_tab_id, 'notification_show_auth_popup_needed', {account_email});
        Xss.sanitizeRender('body.attachment', `Error downloading file: google auth needed. ${Ui.retry_link()}`);
      } else if(Api.err.isNetErr(e)) {
        Xss.sanitizeRender('body.attachment', `Error downloading file: no internet. ${Ui.retry_link()}`);
      } else {
        Catch.handle_exception(e);
        Xss.sanitizeRender('body.attachment', `Error downloading file: unknown error. ${Ui.retry_link()}`);
      }
    }
  };

  let recover_missing_att_id_if_needed = async () => {
    if (!urlParams.url && !urlParams.attachment_id && urlParams.message_id) {
      try {
        let result = await Api.gmail.msgGet(account_email, urlParams.message_id as string, 'full');
        if (result && result.payload && result.payload.parts) {
          for (let att_meta of result.payload.parts) {
            if (att_meta.filename === urlParams.name && att_meta.body && att_meta.body.size === urlParams.size && att_meta.body.attachmentId) {
              urlParams.attachment_id = att_meta.body.attachmentId;
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

  let process_as_a_public_key_and_hide_att_if_appropriate = async () => {
    if (encrypted_a && encrypted_a.msgId && encrypted_a.id && encrypted_a.treatAs() === 'public_key') {
      // this is encrypted public key - download && decrypt & parse & render
      let att = await Api.gmail.attGet(account_email, urlParams.message_id as string, urlParams.attachment_id as string);
      let result = await Pgp.msg.decrypt(account_email, att.data);
      if (result.success && result.content.text) {
        let openpgp_type = Pgp.msg.type(result.content.text);
        if(openpgp_type && openpgp_type.type === 'public_key') {
          if(openpgp_type.armored) { // could potentially process unarmored pubkey files, maybe later
            // render pubkey
            BrowserMsg.send(parent_tab_id, 'render_public_keys', {after_frame_id: urlParams.frame_id, traverse_up: 2, public_keys: [result.content.text]});
            // hide attachment
            BrowserMsg.send(parent_tab_id, 'set_css', {selector: `#${urlParams.frame_id}`, traverse_up: 1, css: {display: 'none'}});
            $('body').text('');
            return true;
          }
        }
      }
    }
    return false;
  };

  try {
    if(!await process_as_a_public_key_and_hide_att_if_appropriate()) {
      // normal attachment, let user download it by clicking
      $('#download').click(Ui.event.prevent('double', save_to_downloads));
    }
  } catch (e) {
    if(Api.err.isAuthPopupNeeded(e)) {
      BrowserMsg.send(parent_tab_id, 'notification_show_auth_popup_needed', {account_email});
      Xss.sanitizeRender('body.attachment', `Error downloading file - google auth needed. ${Ui.retry_link()}`);
    } else if(Api.err.isNetErr(e)) {
      Xss.sanitizeRender('body.attachment', `Error downloading file - no internet. ${Ui.retry_link()}`);
    } else {
      Catch.handle_exception(e);
      Xss.sanitizeRender('body.attachment', `Error downloading file - unknown error. ${Ui.retry_link()}`);
    }
  }

})();
