/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

tool.ui.event.protect();

let url_params = tool.env.url_params(['account_email', 'message_id', 'attachment_id', 'name', 'type', 'size', 'url', 'parent_tab_id', 'content', 'decrypted']);
if(url_params.size) {
  url_params.size = parseInt(url_params.size as string);
}

let original_html_content: string;
let button = $('#download');

let passphrase_interval: number|undefined = undefined;
let missing_passprase_longids: string[] = [];

$('#type').text(url_params.type as string);
$('#name').text(url_params.name as string);

$('img#file-format').attr('src', (() => {
  let icon = (name: string) => `/img/fileformat/${name}.png`;
  let name_split = (url_params.name as string).replace(/\.(pgp|gpg)$/ig, '').split('.');
  let extension = name_split[name_split.length - 1].toLowerCase();
  switch(extension) {
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

function check_passphrase_entered() { // todo - more or less copy-pasted from pgp_block.js, should use a common one. Also similar one in compose.js
  if(missing_passprase_longids) {
    Promise.all(missing_passprase_longids.map(longid => (window as FlowCryptWindow).flowcrypt_storage.passphrase_get(url_params.account_email as string, longid))).then(passphrases => {
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

function get_url_file_size(original_url: string, callback: Callback) {
  console.log('trying to figure out file size');
  // will only call callback on success
  let url;
  if(tool.value('docs.googleusercontent.com/docs/securesc').in(url_params.url as string)) {
    try {
      let google_drive_file_id = original_url.split('/').pop()!.split('?').shift(); // we catch any errors below
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

function get_original_name(name: string) {
  return name.replace(/(\.pgp)|(\.gpg)$/, '');
}

function decrypt_and_save_attachment_to_downloads(success: boolean, encrypted_data: string|undefined) {
  if(success) {
    tool.crypto.message.decrypt(url_params.account_email as string, encrypted_data as string, null, function (result) {
      $('#download').html(original_html_content).removeClass('visible');
      if(result.success) {
        let filename = result.content.filename;
        if(!filename || tool.value(filename).in(['msg.txt', 'null'])) {
          filename = get_original_name(url_params.name as string);
        }
        tool.file.save_to_downloads(filename, url_params.type as string, result.content.data, $('body'));
      } else if((result.missing_passphrases || []).length) {
        missing_passprase_longids = result.missing_passphrases as string[];
        tool.browser.message.send(url_params.parent_tab_id as string, 'passphrase_dialog', {type: 'attachment', longids: result.missing_passphrases});
        clearInterval(passphrase_interval);
        passphrase_interval = window.setInterval(check_passphrase_entered, 1000);
      } else {
        delete result.message;
        console.log(result);
        $('body.attachment').html('Error opening file<br>Downloading original..');
        tool.file.save_to_downloads(url_params.name as string, url_params.type as string, encrypted_data as string);
      }
    });
  } else {
    //todo - show a retry button
  }
}

if(!url_params.size && url_params.url) { // download url of an unknown size
  get_url_file_size(url_params.url as string, function(size) {
    url_params.size = size;
  });
}

let progress_element: JQuery<HTMLElement>;

function render_progress(percent: number, received: number, size: number) {
  size = size || url_params.size as number;
  if(percent) {
    progress_element.text(percent + '%');
  } else if(size) {
    progress_element.text(Math.floor(((received * 0.75) / size) * 100) + '%');
  }
}

function download() {
  original_html_content = button.html();
  button.addClass('visible');
  button.html(tool.ui.spinner('green', 'large_spinner') + '<span class="download_progress"></span>');
  recover_missing_attachment_id_if_needed(() => {
    progress_element = $('.download_progress');
    if(url_params.decrypted) { // when content was downloaded and decrypted
      tool.file.save_to_downloads(get_original_name(url_params.name as string), url_params.type as string, tool.str.to_uint8(url_params.decrypted as string), tool.env.browser().name === 'firefox' ? $('body') : null);
    } else if(url_params.content) { // when encrypted content was already downloaded
      decrypt_and_save_attachment_to_downloads(true, url_params.content as string);
    } else if(url_params.attachment_id) { // gmail attachment_id
      tool.api.gmail.attachment_get(url_params.account_email as string, url_params.message_id as string, url_params.attachment_id as string, function (success, attachment: Attachment) {
        decrypt_and_save_attachment_to_downloads(success, success ? tool.str.base64url_decode(attachment.data as string) : undefined);
      }, render_progress);
    } else if(url_params.url) { // gneneral url to download attachment
      tool.file.download_as_uint8(url_params.url as string, render_progress, function (success, data) {
        if(success && data && data instanceof Uint8Array) {
          decrypt_and_save_attachment_to_downloads(true, tool.str.from_uint8(data)); //todo - have to convert to str because tool.crypto.message.decrypt() cannot deal with uint8 directly yet
        } else {
          decrypt_and_save_attachment_to_downloads(false, undefined);
        }
      });
    } else {
      throw Error('Missing both attachment_id and url');
    }
  });
}

function recover_missing_attachment_id_if_needed(cb: Callback) {
  if(!url_params.url && !url_params.attachment_id && url_params.message_id) {
    tool.api.gmail.message_get(url_params.account_email as string, url_params.message_id as string, 'full', (success: boolean, result: Dict<any>) => {
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
