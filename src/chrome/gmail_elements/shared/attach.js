/* Business Source License 1.0 © 2016 Tom James Holub (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/tomholub/cryptup-chrome/tree/master/src/LICENCE */

'use strict';

function init_shared_attach_js(file_count_limit) {

  var attached_files = {};
  var uploader = undefined;

  function initialize_attach_dialog(element_id, button_id) {
    $('#qq-template').load('/chrome/gmail_elements/shared/attach.template.htm', function () {
      var config = {
        autoUpload: false,
        // debug: true,
        element: $('#' + element_id).get(0),
        button: $('#' + button_id).get(0),
        // dragAndDrop: {
        //   extraDropzones: [$('#body').get(0)]
        // },
        callbacks: { onSubmitted: process_new_attachment, onCancel: cancel_attachment, },
      };
      uploader = new qq.FineUploader(config);
    });
  }

  function get_attachment_ids() {
    return Object.keys(attached_files);
  }

  function has_attachment() {
    return Object.keys(attached_files).length > 0;
  }

  function read_attachment_data_as_uint8(id, callback) {
    var reader = new FileReader();
    reader.onload = function (data) {
      callback(new Uint8Array(data.target.result));
    };
    reader.readAsArrayBuffer(attached_files[id]);
  }

  function collect_attachment(id, callback) {
    read_attachment_data_as_uint8(id, function (file_data) {
      callback({ name: attached_files[id].name, type: attached_files[id].type, data: file_data, });
    });
  }

  function collect_and_encrypt_attachments(armored_pubkeys, challenge, callback) {
    var attachments = [];

    function add(attachment) {
      attachments.push(attachment);
      if(attachments.length === Object.keys(attached_files).length) {
        callback(attachments);
      }
    }
    if(!Object.keys(attached_files).length) {
      callback(attachments);
    } else {
      $.each(attached_files, function (id, file) {
        read_attachment_data_as_uint8(id, function (file_data) {
          encrypt(armored_pubkeys, null, challenge, file_data, false, function (encrypted_file_content) {
            add(attachment(file.name.replace(/[^a-zA-Z\-_.0-9]/g, '_').replace(/__+/g, '_') + '.pgp', file.type, encrypted_file_content.message.packets.write(), null, true));
          });
        });
      });
    }
  }

  function process_new_attachment(id, name) {
    increment_metric('attach');
    if(file_count_limit && Object.keys(attached_files).length >= file_count_limit) {
      alert('Amount of attached files is limited to ' + file_count_limit);
      uploader.cancel(id);
    } else {
      var file = uploader.getFile(id);
      if(false) { //todo - check size
        uploader.cancel(id);
        alert('Attachments up to 10MB are allowed');
        return;
      }
      attached_files[id] = file;
    }
  }

  function cancel_attachment(id, name) {
    delete attached_files[id];
  }

  return {
    initialize_attach_dialog: initialize_attach_dialog,
    has_attachment: has_attachment,
    collect_and_encrypt_attachments: collect_and_encrypt_attachments,
    get_attachment_ids: get_attachment_ids,
    collect_attachment: collect_attachment,
  };
}
