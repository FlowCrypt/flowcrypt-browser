/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Bm } from './browser/browser-msg.js';
import { Dict } from './core/common.js';
import { BindInterface, RelayManagerInterface } from './relay-manager-interface.js';
import { RenderInterface } from './render-interface.js';
import { RenderMessage } from './render-message.js';
import { RenderRelay } from './render-relay.js';

export class RelayManager implements RelayManagerInterface, BindInterface {
  private frames: Dict<{ frameWindow?: Window; readyToReceive?: true; queue: RenderMessage[]; progressText?: string }> = {};

  public static getPercentage = (percent: number | undefined, loaded: number, total: number, expectedTransferSize: number) => {
    if (typeof percent === 'undefined') {
      if (total || expectedTransferSize) {
        percent = Math.round((loaded / (total || expectedTransferSize)) * 100);
      }
    }
    return percent;
  };

  public relay = (frameId: string, message: RenderMessage) => {
    const { frameWindow, readyToReceive, queue } = this.frames[frameId];
    queue.push(message);
    if (readyToReceive && frameWindow) {
      this.flush({ frameWindow, queue });
    }
  };

  public createRelay = (frameId: string): RenderInterface => {
    this.frames[frameId] = { queue: [] }; // can readyToReceive message come earlier? Probably not.
    return new RenderRelay(this, frameId);
  };

  public readyToReceive = (frameId: string) => {
    const frameData = this.frames[frameId];
    frameData.readyToReceive = true;
    if (frameData.frameWindow) {
      this.flush({ frameWindow: frameData.frameWindow, queue: frameData.queue });
    }
  };

  public renderProgressText = (frameId: string, text: string) => {
    const frameData = this.frames[frameId];
    frameData.progressText = text;
    this.relay(frameId, { renderText: text });
  };

  public renderProgress = ({ frameId, percent, loaded, total, expectedTransferSize }: Bm.AjaxProgress) => {
    const perc = RelayManager.getPercentage(percent, loaded, total, expectedTransferSize);
    if (typeof perc !== 'undefined') {
      const { readyToReceive, progressText } = this.frames[frameId];
      if (readyToReceive && typeof progressText !== 'undefined') {
        this.relay(frameId, { renderText: `${progressText} ${perc}%` });
      }
    }
  };

  public bind = (frameId: string, frameWindow: Window) => {
    const frameData = this.frames[frameId];
    frameData.frameWindow = frameWindow;
    if (frameData.readyToReceive) {
      this.flush({ frameWindow, queue: frameData.queue });
    }
  };

  private flush = ({ frameWindow, queue }: { frameWindow: Window; queue: RenderMessage[] }) => {
    while (true) {
      const message = queue.shift();
      if (message) {
        frameWindow.postMessage(message, '*'); // todo: targetOrigin
        // todo: if ready status, release resources -- callback function?
      } else break;
    }
  };
}
