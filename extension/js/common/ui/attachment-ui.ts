/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Attachment } from '../core/attachment.js';
import { Catch, UnreportableError } from '../platform/catch.js';
import { Dict } from '../core/common.js';
import { MsgUtil } from '../core/crypto/pgp/msg-util.js';
import { Ui } from '../browser/ui.js';
import { PubkeyResult } from '../core/crypto/key.js';

declare const qq: any;

export type AttachmentLimits = { count?: number, size?: number, sizeMb?: number, oversize?: (newFileSize: number) => Promise<void> };
type AttachmentUICallbacks = {
  attachmentAdded?: (r: Attachment) => Promise<void>,
  uiChanged?: () => void,
};

class CancelAttachmentSubmit extends Error { }

export class AttachmentUI {

  private templatePath = '/chrome/elements/shared/attach.template.htm';
  private getLimits: () => Promise<AttachmentLimits>;
  private attachedFiles: Dict<File> = {};
  private uploader: any = undefined;
  private callbacks: AttachmentUICallbacks = {};

  constructor(getLimits: () => Promise<AttachmentLimits>) {
    this.getLimits = getLimits;
  }

  public initAttachmentDialog = (elId: string, btnId: string, callbacks: AttachmentUICallbacks = {}) => {
    this.callbacks = callbacks;
    $('#qq-template').load(this.templatePath, () => {
      const config = {
        autoUpload: false,
        // debug: true,
        element: $('#' + elId).get(0),
        button: $('#' + btnId).get(0),
        dragAndDrop: {
          extraDropzones: $('#input_text'),
        },
        callbacks: {
          onSubmit: (uploadFileId: string) => this.processNewAttachment(uploadFileId),
          onCancel: (uploadFileId: string) => this.cancelAttachment(uploadFileId),
        },
      };
      this.uploader = new qq.FineUploader(config); // tslint:disable-line:no-unsafe-any
      this.setInputAttributes();
    });
  }

  public setInputAttributes = (): HTMLInputElement => {
    const input: HTMLInputElement = this.uploader._buttons[0].getInput(); // tslint:disable-line:no-unsafe-any
    input.setAttribute('title', 'Attach a file');
    input.setAttribute('tabindex', '8');
    input.setAttribute('data-test', 'action-attach-files');
    return input;
  }

  public hasAttachment = () => {
    return Object.keys(this.attachedFiles).length > 0;
  }

  public getAttachmentIds = () => {
    return Object.keys(this.attachedFiles);
  }

  public collectAttachment = async (uploadFileId: string) => {
    const fileData = await this.readAttachmentDataAsUint8(uploadFileId);
    return new Attachment({ name: this.attachedFiles[uploadFileId].name, type: this.attachedFiles[uploadFileId].type, data: fileData });
  }

  public collectAttachments = async () => {
    const attachments: Attachment[] = [];
    for (const uploadFileId of Object.keys(this.attachedFiles)) {
      attachments.push(await this.collectAttachment(uploadFileId));
    }
    return attachments;
  }

  public collectEncryptAttachments = async (pubs: PubkeyResult[]): Promise<Attachment[]> => {
    const attachments: Attachment[] = [];
    for (const uploadFileId of Object.keys(this.attachedFiles)) {
      const file = this.attachedFiles[uploadFileId];
      const data = await this.readAttachmentDataAsUint8(uploadFileId);
      const pubsForEncryption = pubs.map(entry => entry.pubkey);
      if (pubs.find(pub => pub.pubkey.type === 'x509')) {
        throw new UnreportableError('Attachments are not yet supported when sending to recipients using S/MIME x509 certificates.');
      }
      const encrypted = await MsgUtil.encryptMessage({ pubkeys: pubsForEncryption, data, filename: file.name, armor: false }) as OpenPGP.EncryptBinaryResult;
      attachments.push(new Attachment({ name: Attachment.sanitizeName(file.name) + '.pgp', type: file.type, data: encrypted.message.packets.write() }));
    }
    return attachments;
  }

  public clearAllAttachments = () => {
    this.attachedFiles = {};
  }

  public addFile = (file: File) => {
    this.uploader.addFiles([file]); // tslint:disable-line: no-unsafe-any
  }

  private cancelAttachment = (uploadFileId: string) => {
    delete this.attachedFiles[uploadFileId];
    if (this.callbacks.uiChanged) {
      // run at next event loop cycle - let DOM changes render first
      // this allows code that relies on this to evaluate the DOM after the file has been removed from it
      Catch.setHandledTimeout(this.callbacks.uiChanged, 0);
    }
  }

  private processNewAttachment = async (uploadFileId: string) => {
    const limits = await this.getLimits();
    if (limits.count && Object.keys(this.attachedFiles).length >= limits.count) {
      const msg = `Amount of attached files is limited to ${limits.count}`;
      await Ui.modal.warning(msg);
      throw new CancelAttachmentSubmit(msg);
    }
    const newFile: File = this.uploader.getFile(uploadFileId); // tslint:disable-line:no-unsafe-any
    if (limits.size && this.getFileSizeSum() + newFile.size > limits.size) {
      const msg = `Combined file size is limited to ${limits.sizeMb} MB`;
      if (typeof limits.oversize === 'function') {
        await limits.oversize(this.getFileSizeSum() + newFile.size);
      } else {
        await Ui.modal.warning(msg);
      }
      throw new CancelAttachmentSubmit(msg);
    }
    this.attachedFiles[uploadFileId] = newFile;
    if (typeof this.callbacks.attachmentAdded === 'function') {
      const a = await this.collectAttachment(uploadFileId);
      await this.callbacks.attachmentAdded(a);
      const input = this.setInputAttributes();
      input.focus();
    }
    if (this.callbacks.uiChanged) {
      // run at next event loop cycle - let DOM changes render first
      // this allows code that relies on this to evaluate the DOM after the file has been removed from it
      Catch.setHandledTimeout(this.callbacks.uiChanged, 0);
    }
    return true;
  }

  private getFileSizeSum = () => {
    let sum = 0;
    for (const file of Object.values(this.attachedFiles)) {
      sum += file.size;
    }
    return sum;
  }

  private readAttachmentDataAsUint8 = async (uploadFileId: string): Promise<Uint8Array> => {
    return await new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(new Uint8Array(reader.result as ArrayBuffer)); // that's what we're getting
      };
      reader.readAsArrayBuffer(this.attachedFiles[uploadFileId]);
    });
  }

}
