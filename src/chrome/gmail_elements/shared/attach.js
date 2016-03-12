var attached_files = {};

var uploader = undefined;

function initialize_attach_dialog() {
  $('#qq-template').load('/chrome/gmail_elements/shared/attach.template.htm', function() {
    uploader = new qq.FineUploader({
      autoUpload: false,
      debug: true,
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

function encrypt_and_collect_attachments(armored_pubkeys, callback) {
  var attachments = [];

  function add(attachment) {
    attachments.push(attachment);
    if(attachments.length === Object.keys(attached_files).length) {
      callback(attachments);
    }
  }
  if(!Object.keys(attached_files).length) {
    callback(null, []);
  } else {
    $.each(attached_files, function(id, file) {
      var reader = new FileReader();
      reader.onload = function(data) {
        if(armored_pubkeys) {
          encrypt(armored_pubkeys, data.target.result, function(encrypted_file_content) {
            add({
              filename: file.name + '.pgp',
              type: file.type,
              content: encrypted_file_content.data,
              secure: true,
            });
          });
        } else {
          add({
            filename: file.name,
            type: file.type,
            content: data.target.result,
            secure: false,
          });
        }
      };
      reader.readAsBinaryString(file); //todo: readAsArrayBuffer might make more sense for performance
    });
  }
}

function process_new_attachment(id, name) {
  var file = uploader.getFile(id);
  if(file.type !== 'text/plain') {
    uploader.cancel(id);
    alert('For now, only text file attachments are possible. Images and other types of files will be available soon.');
    return;
  }
  attached_files[id] = file;
}

function cancel_attachment(id, name) {
  delete attached_files[id];
}
