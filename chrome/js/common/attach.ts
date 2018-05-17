/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

declare let qq: any;

(function() {

  function init_attach(get_limits: () => AttachLimits) {

    // let $, jQuery, qq, template_path;
    // if(typeof exports !== 'object') { // browser extension
    let template_path = '/chrome/elements/shared/attach.template.htm';
    // } else { // electron
    //   require('module').globalPaths.push(process.cwd());
    //   tool = require('js/tool').tool;
    //   catcher = require('js/tool').catcher;
    //   $ = jQuery = require('jquery');
    //   qq = require('fine-uploader');
    //   template_path = '../attach.template.htm';
    // }

    let attached_files: Dict<File> = {};
    let uploader: any = undefined;
    let attachment_added_callback: Callback;

    function initialize_attach_dialog(element_id: string, button_id: string) {
      $('#qq-template').load(template_path, function () {
        let config = {
          autoUpload: false,
          // debug: true,
          element: $('#' + element_id).get(0),
          button: $('#' + button_id).get(0),
          dragAndDrop: {
            extraDropzones: $('#input_text'),
          },
          callbacks: {
            onSubmitted: function(id: string, name: string) {
              catcher.try(() => {
                process_new_attachment(id, name);
              })();
            },
            onCancel: function(id: string) {
              catcher.try(() => {
                cancel_attachment(id);
              })();
            },
          },
        };
        uploader = new qq.FineUploader(config);
      });
    }

    function set_attachment_added_callback(cb: Callback) {
      attachment_added_callback = cb;
    }

    function get_attachment_ids() {
      return Object.keys(attached_files);
    }

    function has_attachment() {
      return Object.keys(attached_files).length > 0;
    }

    function read_attachment_data_as_uint8(id: string, callback: (r: Uint8Array) => void) {
      let reader = new FileReader();
      reader.onload = function () {
        callback(new Uint8Array(reader.result));
      };
      reader.readAsArrayBuffer(attached_files[id]);
    }

    function collect_attachment(id: string, callback: Callback) {
      read_attachment_data_as_uint8(id, (file_data) => {
        callback(tool.file.attachment(attached_files[id].name, attached_files[id].type, file_data));
      });
    }

    function collect_attachments(callback: (attachments: Attachment[]) => void) {
      let attachments: Attachment[] = [];
      function add(attachment: Attachment) {
        attachments.push(attachment);
        if(attachments.length === Object.keys(attached_files).length) {
          callback(attachments);
        }
      }
      if(!Object.keys(attached_files).length) {
        callback(attachments);
      } else {
        for(let id of Object.keys(attached_files)) {
          collect_attachment(id, add);
        }
      }
    }

    function collect_and_encrypt_attachments(armored_pubkeys: string[], challenge: Challenge|null, callback: (attachments: Attachment[]) => void) {
      let attachments: Attachment[] = [];
      function add(attachment: Attachment) {
        attachments.push(attachment);
        if(attachments.length === Object.keys(attached_files).length) {
          callback(attachments);
        }
      }
      if(!Object.keys(attached_files).length) {
        callback(attachments);
      } else {
        for(let id of Object.keys(attached_files)) {
          let file = attached_files[id];
          read_attachment_data_as_uint8(id, function (file_data) {
            tool.crypto.message.encrypt(armored_pubkeys, null, challenge, file_data, file.name, false, function (encrypted_file_content) {
              add(tool.file.attachment(file.name.replace(/[^a-zA-Z\-_.0-9]/g, '_').replace(/__+/g, '_') + '.pgp', file.type, encrypted_file_content.message.packets.write()));
            });
          });
        }
      }
    }

    function get_file_size_sum() {
      let sum = 0;
      for(let file of Object.values(attached_files)) {
        sum += file.size;
      }
      return sum;
    }

    function process_new_attachment(id: string, name: string) {
      let limits: AttachLimits = typeof get_limits === 'function' ? get_limits() : {};
      if(limits.count && Object.keys(attached_files).length >= limits.count) {
        alert('Amount of attached files is limited to ' + limits.count);
        uploader.cancel(id);
      } else {
        let new_file = uploader.getFile(id);
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
        if(typeof attachment_added_callback === 'function') {
          collect_attachment(id, attachment_added_callback);
        }
      }
    }

    function cancel_attachment(id: string) {
      delete attached_files[id];
    }

    return {
      initialize_attach_dialog: initialize_attach_dialog,
      has_attachment: has_attachment,
      collect_and_encrypt_attachments: collect_and_encrypt_attachments,
      collect_attachments: collect_attachments,
      get_attachment_ids: get_attachment_ids,
      collect_attachment: collect_attachment,
      set_attachment_added_callback: set_attachment_added_callback,
    };
  }

  if(typeof exports === 'object') {
    exports.init = init_attach;
  } else {
    (window as FcWindow).flowcrypt_attach = {init: init_attach};
  }

})();