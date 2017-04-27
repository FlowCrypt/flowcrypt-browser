/* Business Source License 1.0 © 2016 Tom James Holub (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/tomholub/cryptup-chrome/tree/master/src/LICENCE */

'use strict';

tool.ui.event.protect();

var url_params = tool.env.url_params(['account_email', 'message_id', 'attachment_id', 'name', 'type', 'size', 'url', 'parent_tab_id', 'download']);
if(url_params.size) {
  url_params.size = parseInt(url_params.size);
}

var original_content;
var button = $('#download');

db_open(function (db) {

  if(db === db_denied) {
    notify_about_storage_access_error(url_params.account_email, url_params.parent_tab_id);
    $('body.attachment').html('Need to update chrome settings to download attachments');
    return;
  }

  var passphrase_interval = undefined;
  var missing_passprase_longids = [];

  $('#type').text(url_params.type);
  $('#name').text(url_params.name);

  $('img#file-format').attr('src', (function () {
    // url_params.type
    function p(name) {
      return '/img/fileformat/' + name + '.png';
    }
    var name_split = url_params.name.replace(/\.(pgp|gpg)$/ig, '').split('.');
    var extension = name_split[name_split.length - 1].toLowerCase();
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
    $.each(missing_passprase_longids, function (i, longid) {
      if(missing_passprase_longids && get_passphrase(url_params.account_email, longid) !== null) {
        missing_passprase_longids = [];
        clearInterval(passphrase_interval);
        $('#download').click();
        return false;
      }
    });
  }

  function get_url_file_size(original_url, callback) {
    console.log('trying to figure out file size');
    // will only call callback on success
    if(tool.value('docs.googleusercontent.com/docs/securesc').in(url_params.url)) {
      try {
        var google_drive_file_id = original_url.split('/').pop().split('?').shift();
        if(google_drive_file_id) {
          var url = 'https://drive.google.com/uc?export=download&id=' + google_drive_file_id; // this one can actually give us headers properly
        } else {
          var url =  original_url;
        }
      } catch (e) {
        var url =  original_url;
      }
    } else {
      var url = original_url;
    }
    var xhr = new XMLHttpRequest();
    xhr.open("HEAD", url, true);
    xhr.onreadystatechange = function() {
      if(this.readyState == this.DONE) {
        var size = xhr.getResponseHeader("Content-Length");
        if(size !== null) {
          callback(parseInt(size));
        } else {
          console.log('was not able to find out file size');
        }
      }
    };
    xhr.send();
  }

  function decrypt_and_save_attachment_to_downloads(success, encrypted_data) {
    if(success) {
      tool.crypto.message.decrypt(db, url_params.account_email, encrypted_data, undefined, function (result) {
        $('#download').html(original_content).removeClass('visible');
        if(result.success) {
          tool.file.save_to_downloads(url_params.name.replace(/(\.pgp)|(\.gpg)$/, ''), url_params.type, result.content.data);
          if(url_params.download) { // it was downloaded automatically in a new window: close the window
            setTimeout(function() { window.close(); }, 1000);
          }
        } else if((result.missing_passphrases || []).length) {
          missing_passprase_longids = result.missing_passphrases;
          tool.browser.message.send(url_params.parent_tab_id, 'passphrase_dialog', {type: 'attachment', longids: result.missing_passphrases});
          clearInterval(passphrase_interval);
          passphrase_interval = setInterval(check_passphrase_entered, 1000);
        } else {
          delete result.message;
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

  var progress_element;

  function render_progress(percent, received, size) {
    var size = size || url_params.size;
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
    progress_element = $('.download_progress');
    if(url_params.attachment_id) {
      tool.api.gmail.attachment_get(url_params.account_email, url_params.message_id, url_params.attachment_id, function (success, attachment) {
        decrypt_and_save_attachment_to_downloads(success, success ? tool.str.base64url_decode(attachment.data) : undefined);
      }, render_progress);
    } else if(url_params.url) {
      tool.file.download_as_uint8(url_params.url, render_progress, function (success, data) {
        decrypt_and_save_attachment_to_downloads(success, tool.str.from_uint8(data)); //toto - have to convert to str because tool.crypto.message.decrypt() cannot deal with uint8 directly yet
      });
    } else {
      throw Error('Missing both attachment_id and url');
    }
  }

  if(url_params.download) {
    download();
  } else {
    $('#download').click(tool.ui.event.prevent(tool.ui.event.double(), function() {
      if(tool.env.browser().name !== 'firefox') { // download from within iframe in all browsers except firefox
        download();
      } else { // download in a new tab in firefox
        window.open(window.location.href + tool.env.url_create('', {download: true}).replace('?', '&'), '_blank');
      }
    }));
  }

});
