/* Business Source License 1.0 © 2016 Tom James Holub (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/tomholub/cryptup-chrome/tree/master/src/LICENCE */

'use strict';

function init_shared_attach_js(get_limits) {

  var attached_files = {};
  var uploader = undefined;

  function initialize_attach_dialog(element_id, button_id) {
    $('#qq-template').load('/chrome/elements/shared/attach.template.htm', function () {
      var config = {
        autoUpload: false,
        // debug: true,
        element: $('#' + element_id).get(0),
        button: $('#' + button_id).get(0),
        // dragAndDrop: {
        //   extraDropzones: [$('#body').get(0)]
        // },
        callbacks: {
          onSubmitted: function(id, name) {
            catcher.try(function() {
              process_new_attachment(id, name);
            })();
          },
          onCancel: function(id) {
            catcher.try(function() {
              cancel_attachment(id);
            })();
          },
        },
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
    reader.onload = function () {
      callback(new Uint8Array(reader.result));
    };
    reader.readAsArrayBuffer(attached_files[id]);
  }

  function collect_attachment(id, callback) {
    read_attachment_data_as_uint8(id, function (file_data) {
      callback(tool.file.attachment(attached_files[id].name, attached_files[id].type, file_data));
    });
  }

  function collect_attachments(callback) {
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
      $.each(attached_files, function (id) {
        collect_attachment(id, add);
      });
    }
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
          tool.crypto.message.encrypt(armored_pubkeys, null, challenge, file_data, false, function (encrypted_file_content) {
            add(tool.file.attachment(file.name.replace(/[^a-zA-Z\-_.0-9]/g, '_').replace(/__+/g, '_') + '.pgp', file.type, encrypted_file_content.message.packets.write()));
          });
        });
      });
    }
  }

  function get_file_size_sum() {
    var sum = 0;
    $.each(attached_files, function(id, file) {
      sum += file.size;
    });
    return sum;
  }

  function process_new_attachment(id, name) {
    tool.env.increment('attach');
    var limits = typeof get_limits === 'function' ? get_limits() : {};
    if(limits.count && Object.keys(attached_files).length >= limits.count) {
      alert('Amount of attached files is limited to ' + limits.count);
      uploader.cancel(id);
    } else {
      var new_file = uploader.getFile(id);
      if(limits.size && get_file_size_sum() + new_file.size > limits.size) {
        uploader.cancel(id);
        if(typeof limits.oversize === 'function') {
          limits.oversize(get_file_size_sum() + new_file.size);
        } else {
          alert('Combined file size is limited to ' + limits.size_mb + 'MB');
        }
        return;
      }
      attached_files[id] = new_file;
    }
  }

  function cancel_attachment(id, name) {
    delete attached_files[id];
  }

  return {
    initialize_attach_dialog: initialize_attach_dialog,
    has_attachment: has_attachment,
    collect_and_encrypt_attachments: collect_and_encrypt_attachments,
    collect_attachments: collect_attachments,
    get_attachment_ids: get_attachment_ids,
    collect_attachment: collect_attachment,
  };
}
