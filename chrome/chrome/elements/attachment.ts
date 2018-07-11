/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

tool.catch.try(async () => {

  tool.ui.event.protect();

  let url_params = tool.env.url_params(['account_email', 'message_id', 'attachment_id', 'name', 'type', 'size', 'url', 'parent_tab_id', 'content', 'decrypted', 'frame_id']);
  let account_email = tool.env.url_param_require.string(url_params, 'account_email');
  let parent_tab_id = tool.env.url_param_require.string(url_params, 'parent_tab_id');
  url_params.size = url_params.size ? parseInt(url_params.size as string) : undefined;
  let original_name = url_params.name ? (url_params.name as string).replace(/\.(pgp|gpg)$/ig, '') : 'noname';
  
  let original_html_content: string;
  let button = $('#download');
  
  let passphrase_interval: number|undefined = undefined;
  let missing_passprase_longids: string[] = [];
  
  $('#type').text(url_params.type as string);
  $('#name').text(url_params.name as string);

  $('img#file-format').attr('src', (() => {
    let icon = (name: string) => `/img/fileformat/${name}.png`;
    let name_split = original_name.split('.');
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
      Promise.all(missing_passprase_longids.map(longid => Store.passphrase_get(account_email, longid))).then(passphrases => {
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
    console.info('trying to figure out file size');
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
          console.info('was not able to find out file size');
        }
      }
    };
    xhr.send();
  }
  
  function get_original_name(name: string) {
    return name.replace(/(\.pgp)|(\.gpg)$/, '');
  }
  
  async function decrypt_and_save_attachment_to_downloads(encrypted_data: string) {
    tool.crypto.message.decrypt(account_email, encrypted_data as string, null, function (result) { // todo - should use promise
      $('#download').html(original_html_content).removeClass('visible');
      if(result.success) {
        let filename = result.content.filename;
        if(!filename || tool.value(filename).in(['msg.txt', 'null'])) {
          filename = get_original_name(url_params.name as string);
        }
        tool.file.save_to_downloads(filename, url_params.type as string, result.content.data, $('body'));
      } else if((result.missing_passphrases || []).length) {
        missing_passprase_longids = result.missing_passphrases as string[];
        tool.browser.message.send(parent_tab_id, 'passphrase_dialog', {type: 'attachment', longids: result.missing_passphrases});
        clearInterval(passphrase_interval);
        passphrase_interval = window.setInterval(check_passphrase_entered, 1000);
      } else {
        delete result.message;
        console.info(result);
        $('body.attachment').html('Error opening file<br>Downloading original..');
        tool.file.save_to_downloads(url_params.name as string, url_params.type as string, encrypted_data as string);
      }
    });
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
  
  async function save_to_downloads() {
    original_html_content = button.html();
    button.addClass('visible');
    button.html(tool.ui.spinner('green', 'large_spinner') + '<span class="download_progress"></span>');
    await recover_missing_attachment_id_if_needed();
    progress_element = $('.download_progress');
    if(url_params.decrypted) { // when content was downloaded and decrypted
      tool.file.save_to_downloads(get_original_name(url_params.name as string), url_params.type as string, tool.str.to_uint8(url_params.decrypted as string), tool.env.browser().name === 'firefox' ? $('body') : null);
    } else if(url_params.content) { // when encrypted content was already downloaded
      await decrypt_and_save_attachment_to_downloads(url_params.content as string);
    } else if(url_params.attachment_id) { // gmail attachment_id
      let attachment = await tool.api.gmail.attachment_get(account_email, url_params.message_id as string, url_params.attachment_id as string, render_progress);
      await decrypt_and_save_attachment_to_downloads(tool.str.base64url_decode(attachment.data as string));
    } else if(url_params.url) { // gneneral url to download attachment
      let data = await tool.file.download_as_uint8(url_params.url as string, render_progress);
      await decrypt_and_save_attachment_to_downloads(tool.str.from_uint8(data)); //todo - have to convert to str because tool.crypto.message.decrypt() cannot deal with uint8 directly yet
    } else {
      throw Error('Missing both attachment_id and url');
    }
  }
  
  async function recover_missing_attachment_id_if_needed() {
    if(!url_params.url && !url_params.attachment_id && url_params.message_id) {
      try {
        let result = await tool.api.gmail.message_get(account_email, url_params.message_id as string, 'full');
        if(result && result.payload && result.payload.parts) {
          for(let attachment_meta of result.payload.parts) {
            if(attachment_meta.filename === url_params.name && attachment_meta.body && attachment_meta.body.size === url_params.size && attachment_meta.body.attachmentId) {
              url_params.attachment_id = attachment_meta.body.attachmentId;
              break;
            }
          }
          return;
        } else {
          window.location.reload();
        }
      } catch(e) {
        window.location.reload();
      }
    }
  }
  
  try {
    if(url_params.message_id && url_params.attachment_id && tool.file.treat_as(tool.file.attachment(original_name, url_params.type as string, url_params.content as string)) === 'public_key') {
      // this is encrypted public key - download && decrypt & parse & render
      let attachment = await tool.api.gmail.attachment_get(account_email, url_params.message_id as string, url_params.attachment_id as string);
      let encrypted_data = tool.str.base64url_decode(attachment.data as string);
      tool.crypto.message.decrypt(account_email, encrypted_data, null, result => {
        if(result.success && result.content.data && tool.crypto.message.is_openpgp(result.content.data)) { // todo - specifically check that it's a pubkey within tool.crypto.message.resembles_beginning
          // render pubkey
          tool.browser.message.send(parent_tab_id, 'render_public_keys', {after_frame_id: url_params.frame_id, traverse_up: 2, public_keys: [result.content.data]});
          // hide attachment
          tool.browser.message.send(parent_tab_id, 'set_css', {selector: `#${url_params.frame_id}`, traverse_up: 1, css: {display: 'none'}});
          $('body').text('');
        } else {
          // could not process as a pubkey - let user download it as they see fit
          $('#download').click(tool.ui.event.prevent(tool.ui.event.double(), save_to_downloads));
        }
      }, 'utf8');
    } else {
      // standard encrypted attachment - let user download it as they see fit
      $('#download').click(tool.ui.event.prevent(tool.ui.event.double(), save_to_downloads));
    }  
  } catch(e) {
    tool.api.error.notify_parent_if_auth_popup_needed(account_email, parent_tab_id, e);
  }

})();