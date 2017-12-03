/* Business Source License 1.0 © 2016-2017 FlowCrypt Limited. Use limitations apply. Contact human@flowcrypt.com */

'use strict';

tool.ui.event.protect();

let url_params = tool.env.url_params(['account_email', 'message_id', 'attachment_id', 'name', 'type', 'size', 'url', 'parent_tab_id', 'content', 'decrypted']);
if(url_params.size) {
  url_params.size = parseInt(url_params.size);
}

let original_content;
let button = $('#download');

window.flowcrypt_storage.db_open(function (db) {

  if(db === window.flowcrypt_storage.db_denied) {
    window.flowcrypt_storage.notify_error(url_params.account_email, url_params.parent_tab_id);
    $('body.attachment').html('Need to update chrome settings to download attachments');
    return;
  }

  let passphrase_interval = undefined;
  let missing_passprase_longids = [];

  $('#type').text(url_params.type);
  $('#name').text(url_params.name);

  $('img#file-format').attr('src', (function () {
    // url_params.type
    function p(name) {
      return '/img/fileformat/' + name + '.png';
    }
    let name_split = url_params.name.replace(/\.(pgp|gpg)$/ig, '').split('.');
    let extension = name_split[name_split.length - 1].toLowerCase();
    switch(extension) {
      case 'jpg':
      case 'jpeg':
        return p('jpg');
      case 'xls':
      case 'xlsx':
        return p('excel');
      case 'doc':
      case 'docx':
        return p('word');
      case 'png':
        return p('png');
      default:
        return p('generic');
    }
  })());

  function check_passphrase_entered() { // todo - more or less copy-pasted from pgp_block.js, should use a common one. Also similar one in compose.js
    if(missing_passprase_longids) {
      Promise.all(missing_passprase_longids.map(longid => window.flowcrypt_storage.passphrase_get(url_params.account_email, longid))).then(passphrases => {
        // todo - copy/pasted - unify
        // further - this approach is outdated and will not properly deal with WRONG passphrases that changed (as opposed to missing)
        // see pgp_block.js for proper common implmenetation
        if(passphrases.filter(passphrase => passphrase !== null).length) {
          missing_passprase_longids = [];
          clearInterval(passphrase_interval);
          $('#download').click();
        }
      });
    }
  }

  function get_url_file_size(original_url, callback) {
    console.log('trying to figure out file size');
    // will only call callback on success
    let url;
    if(tool.value('docs.googleusercontent.com/docs/securesc').in(url_params.url)) {
      try {
        let google_drive_file_id = original_url.split('/').pop().split('?').shift();
        if(google_drive_file_id) {
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
      if(this.readyState === this.DONE) {
        let size = xhr.getResponseHeader("Content-Length");
        if(size !== null) {
          callback(parseInt(size));
        } else {
          console.log('was not able to find out file size');
        }
      }
    };
    xhr.send();
  }

  function get_original_name(name) {
    return name.replace(/(\.pgp)|(\.gpg)$/, '');
  }

  function decrypt_and_save_attachment_to_downloads(success, encrypted_data) {
    if(success) {
      tool.crypto.message.decrypt(db, url_params.account_email, encrypted_data, undefined, function (result) {
        $('#download').html(original_content).removeClass('visible');
        if(result.success) {
          let filename = result.content.filename;
          if(!filename || tool.value(filename).in(['msg.txt', 'null'])) {
            filename = get_original_name(url_params.name);
          }
          tool.file.save_to_downloads(filename, url_params.type, result.content.data, tool.env.browser().name === 'firefox' ? $('body') : null);
        } else if((result.missing_passphrases || []).length) {
          missing_passprase_longids = result.missing_passphrases;
          tool.browser.message.send(url_params.parent_tab_id, 'passphrase_dialog', {type: 'attachment', longids: result.missing_passphrases});
          clearInterval(passphrase_interval);
          passphrase_interval = setInterval(check_passphrase_entered, 1000);
        } else {
          delete result.message;
          console.log(result);
          $('body.attachment').html('Error opening file<br>Downloading original..');
          tool.file.save_to_downloads(url_params.name, url_params.type, encrypted_data);
        }
      });
    } else {
      //todo - show a retry button
    }
  }

  if(!url_params.size && url_params.url) { // download url of an unknown size
    get_url_file_size(url_params.url, function(size) {
      url_params.size = size;
    });
  }

  let progress_element;

  function render_progress(percent, received, size) {
    size = size || url_params.size;
    if(percent) {
      progress_element.text(percent + '%');
    } else if(size) {
      progress_element.text(Math.floor(((received * 0.75) / size) * 100) + '%');
    }
  }

  function download() {
    tool.env.increment('download');
    original_content = button.html();
    button.addClass('visible');
    button.html(tool.ui.spinner('green', 'large_spinner') + '<span class="download_progress"></span>');
    recover_missing_attachment_id_if_needed(() => {
      progress_element = $('.download_progress');
      if(url_params.decrypted) { // when content was downloaded and decrypted
        tool.file.save_to_downloads(get_original_name(url_params.name), url_params.type, tool.str.to_uint8(url_params.decrypted), tool.env.browser().name === 'firefox' ? $('body') : null);
      } else if(url_params.content) { // when encrypted content was already downloaded
        decrypt_and_save_attachment_to_downloads(true, url_params.content);
      } else if(url_params.attachment_id) { // gmail attachment_id
        tool.api.gmail.attachment_get(url_params.account_email, url_params.message_id, url_params.attachment_id, function (success, attachment) {
          decrypt_and_save_attachment_to_downloads(success, success ? tool.str.base64url_decode(attachment.data) : undefined);
        }, render_progress);
      } else if(url_params.url) { // gneneral url to download attachment
        tool.file.download_as_uint8(url_params.url, render_progress, function (success, data) {
          decrypt_and_save_attachment_to_downloads(success, tool.str.from_uint8(data)); //toto - have to convert to str because tool.crypto.message.decrypt() cannot deal with uint8 directly yet
        });
      } else {
        throw Error('Missing both attachment_id and url');
      }
    });
  }

  function recover_missing_attachment_id_if_needed(cb) {
    if(!url_params.url && !url_params.attachment_id && url_params.message_id) {
      tool.api.gmail.message_get(url_params.account_email, url_params.message_id, 'full', (success, result) => {
        if(success && result && result.payload && result.payload.parts) {
          tool.each(result.payload.parts, (i, attachment_meta) => {
            if(attachment_meta.filename === url_params.name && attachment_meta.body && attachment_meta.body.size === url_params.size && attachment_meta.body.attachmentId) {
              url_params.attachment_id = attachment_meta.body.attachmentId;
              return false;
            }
          });
          cb();
        } else {
          window.location.reload();
        }
      });
    } else {
      cb();
    }
  }

  $('#download').click(tool.ui.event.prevent(tool.ui.event.double(), download));

});
