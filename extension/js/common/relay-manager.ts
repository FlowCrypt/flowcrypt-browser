/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Dict } from './core/common.js';
import { RelayManagerInterface } from './relay-manager-interface.js';
import { RenderInterface } from './render-interface.js';
import { RenderMessage } from './render-message.js';
import { RenderRelay } from './render-relay.js';

export class RelayManager implements RelayManagerInterface {
  private frames: Dict<{ frameWindow: Window; readyToReceive?: true; queue: RenderMessage[] }> = {};

  public relay = (frameId: string, message: RenderMessage) => {
    const frameData = this.frames[frameId];
    frameData.queue.push(message);
    if (frameData.readyToReceive) {
      this.flush(frameData);
    }
  };

  public createRelay = (frameId: string, frameWindow: Window): RenderInterface => {
    this.frames[frameId] = { frameWindow, queue: [] }; // can readyToReceive message come earlier? Probably not.
    return new RenderRelay(this, frameId);
  };

  public readyToReceive = (frameId: string) => {
    const frameData = this.frames[frameId];
    frameData.readyToReceive = true;
    this.flush(frameData);
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
