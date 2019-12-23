/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { PgpMsg } from '../core/pgp-msg.js';
import { Dict } from '../core/common.js';
import { Att } from '../core/att.js';
import { Catch } from '../platform/catch.js';
import { Ui } from '../browser/ui.js';

declare const qq: any;

export type AttLimits = { count?: number, size?: number, sizeMb?: number, oversize?: (newFileSize: number) => Promise<void> };
type AttUICallbacks = {
  attAdded?: (r: Att) => Promise<void>,
  uiChanged?: () => void,
};

export class AttUI {

  private templatePath = '/chrome/elements/shared/attach.template.htm';
  private getLimits: () => Promise<AttLimits>;
  private attachedFiles: Dict<File> = {};
  private uploader: any = undefined;
  private callbacks: AttUICallbacks = {};

  constructor(getLimits: () => Promise<AttLimits>) {
    this.getLimits = getLimits;
  }

  initAttDialog = (elId: string, btnId: string, callbacks: AttUICallbacks = {}) => {
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
          onSubmit: (uploadFileId: string) => this.processNewAtt(uploadFileId).catch(Catch.reportErr),
          onCancel: (uploadFileId: string) => this.cancelAtt(uploadFileId),
        },
      };
      this.uploader = new qq.FineUploader(config); // tslint:disable-line:no-unsafe-any
      this.setInputAttributes();
    });
  }

  setInputAttributes = (): HTMLInputElement => {
    const input: HTMLInputElement = this.uploader._buttons[0].getInput(); // tslint:disable-line:no-unsafe-any
    input.setAttribute('title', 'Attach a file');
    input.setAttribute('tabindex', '8');
    return input;
  }

  hasAtt = () => {
    return Object.keys(this.attachedFiles).length > 0;
  }

  getAttIds = () => {
    return Object.keys(this.attachedFiles);
  }

  collectAtt = async (uploadFileId: string) => {
    const fileData = await this.readAttDataAsUint8(uploadFileId);
    return new Att({ name: this.attachedFiles[uploadFileId].name, type: this.attachedFiles[uploadFileId].type, data: fileData });
  }

  collectAtts = async () => {
    const atts: Att[] = [];
    for (const uploadFileId of Object.keys(this.attachedFiles)) {
      atts.push(await this.collectAtt(uploadFileId));
    }
    return atts;
  }

  collectEncryptAtts = async (pubkeys: string[], pwd?: string): Promise<Att[]> => {
    const atts: Att[] = [];
    for (const uploadFileId of Object.keys(this.attachedFiles)) {
      const file = this.attachedFiles[uploadFileId];
      const data = await this.readAttDataAsUint8(uploadFileId);
      const encrypted = await PgpMsg.encrypt({ pubkeys, data, pwd, filename: file.name, armor: false }) as OpenPGP.EncryptBinaryResult;
      atts.push(new Att({ name: file.name.replace(/[^a-zA-Z\-_.0-9]/g, '_').replace(/__+/g, '_') + '.pgp', type: file.type, data: encrypted.message.packets.write() }));
    }
    return atts;
  }

  clearAllAtts = () => {
    this.attachedFiles = {};
  }

  public addFile = (file: File) => {
    console.log('addFile uploading file:', file);
    this.uploader.addFiles([file]); // tslint:disable-line: no-unsafe-any
  }

  private cancelAtt = (uploadFileId: string) => {
    delete this.attachedFiles[uploadFileId];
    if (this.callbacks.uiChanged) {
      // run at next event loop cycle - let DOM changes render first
      // this allows code that relies on this to evaluate the DOM after the file has been removed from it
      Catch.setHandledTimeout(this.callbacks.uiChanged, 0);
    }
  }

  private processNewAtt = async (uploadFileId: string) => {
    const limits = await this.getLimits();
    if (limits.count && Object.keys(this.attachedFiles).length >= limits.count) {
      await Ui.modal.warning(`Amount of attached files is limited to ${limits.count}`);
      return;
    }
    const newFile: File = this.uploader.getFile(uploadFileId); // tslint:disable-line:no-unsafe-any
    if (limits.size && this.getFileSizeSum() + newFile.size > limits.size) {
      if (typeof limits.oversize === 'function') {
        await limits.oversize(this.getFileSizeSum() + newFile.size);
      } else {
        await Ui.modal.warning(`Combined file size is limited to ${limits.sizeMb} MB`);
      }
      return;
    }
    this.attachedFiles[uploadFileId] = newFile;
    if (typeof this.callbacks.attAdded === 'function') {
      const a = await this.collectAtt(uploadFileId);
      await this.callbacks.attAdded(a);
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

  private readAttDataAsUint8 = async (uploadFileId: string): Promise<Uint8Array> => {
    return await new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(new Uint8Array(reader.result as ArrayBuffer)); // that's what we're getting
      };
      reader.readAsArrayBuffer(this.attachedFiles[uploadFileId]);
    });
  }

}
