'use strict';

var url_params = get_url_params(['account_email', 'message_id', 'attachment_id', 'name', 'type', 'size', 'parent_tab_id']);

db_open(function(db) {

  if(db === db_denied) {
    notify_about_storage_access_error(url_params.account_email, url_params.parent_tab_id);
    $('body.attachment').html('Need to update chrome settings to download attachments');
    return;
  }

  var passphrase_interval = undefined;
  var missing_passprase_longids = [];

  $('#type').text(url_params.type);
  $('#name').text(url_params.name);

  $('img#file-format').attr('src', (function() {
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

  function check_passphrase_entered() { // more or less copy-pasted from pgp_block.js, should use a common one
    $.each(missing_passprase_longids, function(i, longid) {
      if(missing_passprase_longids && get_passphrase(url_params.account_email, longid) !== null) {
        missing_passprase_longids = [];
        clearInterval(passphrase_interval);
        $('#download').click();
        return false;
      }
    });
  }

  $('#download').click(prevent(doubleclick(), function(self) {
    increment_metric('download');
    var original_content = $(self).html();
    $(self).html(get_spinner());
    gmail_api_message_attachment_get(url_params.account_email, url_params.message_id, url_params.attachment_id, function(success, attachment) {
      $(self).html(original_content);
      if(success) {
        var encrypted_data = base64url_decode(attachment.data);
        decrypt(db, url_params.account_email, encrypted_data, undefined, function(result) {
          if(result.success) {
            download_file(url_params.name.replace(/(\.pgp)|(\.gpg)$/, ''), url_params.type, result.content.data);
          } else if((result.missing_passphrases || []).length) {
            missing_passprase_longids = result.missing_passphrases;
            chrome_message_send(url_params.parent_tab_id, 'passphrase_dialog', {
              type: 'attachment',
              longids: result.missing_passphrases,
            });
            clearInterval(passphrase_interval);
            passphrase_interval = setInterval(check_passphrase_entered, 1000);
          } else {
            delete result.message;
            console.log(result);
            $('body.attachment').html('Error opening file<br>Downloading original..');
            download_file(url_params.name, url_params.type, encrypted_data);
          }
        });
      }
    });
  }));

});
