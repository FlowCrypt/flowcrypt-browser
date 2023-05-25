/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Bm } from './browser/browser-msg.js';
import { BindInterface, RelayManagerInterface } from './relay-manager-interface.js';
import { RenderInterface } from './render-interface.js';
import { RenderMessage } from './render-message.js';
import { RenderRelay } from './render-relay.js';

type FrameEntry = { frameWindow?: Window; readyToReceive?: true; queue: RenderMessage[]; progressText?: string };

export class RelayManager implements RelayManagerInterface, BindInterface {
  private readonly frames = new Map<string, FrameEntry>();

  public static getPercentage = (percent: number | undefined, loaded: number, total: number, expectedTransferSize: number) => {
    if (typeof percent === 'undefined') {
      if (total || expectedTransferSize) {
        percent = Math.round((loaded / (total || expectedTransferSize)) * 100);
      }
    }
    return percent;
  };

  public relay = (frameId: string, message: RenderMessage) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const { frameWindow, readyToReceive, queue } = this.frames.get(frameId)!;
    queue.push(message);
    if (readyToReceive && frameWindow) {
      this.flush({ frameWindow, queue });
    }
  };

  public createRelay = (frameId: string): RenderInterface => {
    this.getOrCreate(frameId);
    return new RenderRelay(this, frameId);
  };

  public readyToReceive = (frameId: string) => {
    const frameData = this.getOrCreate(frameId);
    frameData.readyToReceive = true;
    if (frameData.frameWindow) {
      this.flush({ frameWindow: frameData.frameWindow, queue: frameData.queue });
    }
  };

  public renderProgressText = (frameId: string, text: string) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const frameData = this.frames.get(frameId)!;
    frameData.progressText = text;
    this.relay(frameId, { renderText: text });
  };

  public renderProgress = ({ frameId, percent, loaded, total, expectedTransferSize }: Bm.AjaxProgress) => {
    const perc = RelayManager.getPercentage(percent, loaded, total, expectedTransferSize);
    if (typeof perc !== 'undefined') {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const { readyToReceive, progressText } = this.frames.get(frameId)!;
      if (readyToReceive && typeof progressText !== 'undefined') {
        this.relay(frameId, { renderText: `${progressText} ${perc}%` });
      }
    }
  };

  public bind = (frameId: string, frameWindow: Window) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const frameData = this.frames.get(frameId)!;
    frameData.frameWindow = frameWindow;
    if (frameData.readyToReceive) {
      this.flush({ frameWindow, queue: frameData.queue });
    }
  };

  private getOrCreate = (frameId: string): FrameEntry => {
    const frameEntry = this.frames.get(frameId);
    if (frameEntry) return frameEntry;
    const newFrameEntry = { queue: [] };
    this.frames.set(frameId, newFrameEntry);
    return newFrameEntry;
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
