var attached_files = {};

var uploader = undefined;

function initialize_attach_dialog() {
  $('#qq-template').load('/chrome/gmail_elements/shared/attach.template.htm', function() {
    uploader = new qq.FineUploader({
      autoUpload: false,
      // debug: true,
      element: document.getElementById('fineuploader'),
      button: document.getElementById('fineuploader_button'),
      // dragAndDrop: {
      //   extraDropzones: [document.getElementById('body')]
      // },
      callbacks: {
        onSubmitted: process_new_attachment,
        onCancel: cancel_attachment,
      }
    });
  });
}

function has_attachment() {
  return Object.keys(attached_files).length > 0;
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
    $.each(attached_files, function(id, file) {
      var reader = new FileReader();
      reader.onload = function(data) {
        encrypt(armored_pubkeys, challenge, new Uint8Array(data.target.result), false, function(encrypted_file_content) {
          add({
            filename: file.name.replace(/[^a-zA-Z\-_.0-9]/g, '_').replace(/__+/g, '_') + '.pgp',
            type: file.type,
            content: encrypted_file_content.message.packets.write(),
            secure: true,
          });
        });
      };
      reader.readAsArrayBuffer(file);
    });
  }
}

function process_new_attachment(id, name) {
  var file = uploader.getFile(id);
  if(false) { //check size
    uploader.cancel(id);
    alert('Attachments up to 10MB are allowed');
    return;
  }
  attached_files[id] = file;
}

function cancel_attachment(id, name) {
  delete attached_files[id];
}
