/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

declare let qq: any;

class Attach {

  private template_path = '/chrome/elements/shared/attach.template.htm';
  private get_limits: () => AttachLimits;
  private attached_files: Dict<File> = {};
  private uploader: any = undefined;
  private attachment_added_callback: Callback;

  constructor(get_limits: () => AttachLimits) {
    this.get_limits = get_limits;
  }

  initialize_attach_dialog = (element_id: string, button_id: string) => {
    $('#qq-template').load(this.template_path, () => {
      let config = {
        autoUpload: false,
        // debug: true,
        element: $('#' + element_id).get(0),
        button: $('#' + button_id).get(0),
        dragAndDrop: {
          extraDropzones: $('#input_text'),
        },
        callbacks: {
          onSubmitted: (id: string, name: string) => tool.catch.try(() => this.process_new_attachment(id, name))(),
          onCancel: (id: string) => tool.catch.try(() => this.cancel_attachment(id))(),
        },
      };
      this.uploader = new qq.FineUploader(config);
    });
  }

  set_attachment_added_callback = (cb: Callback) => {
    this.attachment_added_callback = cb;
  }

  has_attachment = () => {
    return Object.keys(this.attached_files).length > 0;
  }

  get_attachment_ids = () => {
    return Object.keys(this.attached_files);
  }

  collect_attachment = async (id: string) => {
    let file_data = await this.read_attachment_data_as_uint8(id);
    return new Attachment({name: this.attached_files[id].name, type: this.attached_files[id].type, data: file_data});
  }

  collect_attachments = async () => {
    let attachments: Attachment[] = [];
    for (let id of Object.keys(this.attached_files)) {
      attachments.push(await this.collect_attachment(id));
    }
    return attachments;
  }

  collect_and_encrypt_attachments = async (armored_pubkeys: string[], challenge: Challenge|null): Promise<Attachment[]> => {
    let attachments: Attachment[] = [];
    for (let id of Object.keys(this.attached_files)) {
      let file = this.attached_files[id];
      let file_data = await this.read_attachment_data_as_uint8(id);
      let encrypted = await tool.crypto.message.encrypt(armored_pubkeys, null, challenge, file_data, file.name, false) as OpenPGP.EncryptBinaryResult;
      attachments.push(new Attachment({name: file.name.replace(/[^a-zA-Z\-_.0-9]/g, '_').replace(/__+/g, '_') + '.pgp', type: file.type, data: encrypted.message.packets.write()}));
    }
    return attachments;
  }

  private cancel_attachment = (id: string) => {
    delete this.attached_files[id];
  }

  private process_new_attachment = (id: string, name: string) => {
    let limits = this.get_limits();
    if (limits.count && Object.keys(this.attached_files).length >= limits.count) {
      alert('Amount of attached files is limited to ' + limits.count);
      this.uploader.cancel(id);
    } else {
      let new_file = this.uploader.getFile(id);
      if (limits.size && this.get_file_size_sum() + new_file.size > limits.size) {
        this.uploader.cancel(id);
        if (typeof limits.oversize === 'function') {
          limits.oversize(this.get_file_size_sum() + new_file.size);
        } else {
          alert('Combined file size is limited to ' + limits.size_mb + 'MB');
        }
        return;
      }
      this.attached_files[id] = new_file;
      if (typeof this.attachment_added_callback === 'function') {
        this.collect_attachment(id).then((a) => this.attachment_added_callback(a)).catch(tool.catch.rejection);
      }
    }
  }

  private get_file_size_sum = () => {
    let sum = 0;
    for (let file of Object.values(this.attached_files)) {
      sum += file.size;
    }
    return sum;
  }

  private read_attachment_data_as_uint8 = (id: string): Promise<Uint8Array> => {
    return new Promise(resolve => {
      let reader = new FileReader();
      reader.onload = () => resolve(new Uint8Array(reader.result));
      reader.readAsArrayBuffer(this.attached_files[id]);
    });
  }

}
