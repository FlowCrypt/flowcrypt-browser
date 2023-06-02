/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Bm, BrowserMsg } from './browser/browser-msg.js';
import { PromiseCancellation } from './core/common.js';
import { RelayManagerInterface } from './relay-manager-interface.js';
import { RenderInterface } from './render-interface.js';
import { RenderMessage, RenderMessageWithFrameId } from './render-message.js';
import { RenderRelay } from './render-relay.js';

type FrameEntry = {
  readyToReceive?: true;
  queue: RenderMessage[];
  cancellation: PromiseCancellation;
  progressText?: string;
};

export class RelayManager implements RelayManagerInterface {
  private static readonly completionMessage: RenderMessage = { done: true };
  private readonly frames = new Map<string, FrameEntry>();

  public constructor(private debug: boolean = false) {
    const framesObserver = new MutationObserver(async mutationsList => {
      for (const mutation of mutationsList) {
        if (mutation.type === 'childList') {
          for (const removedNode of mutation.removedNodes) {
            this.dropRemovedNodes(removedNode);
          }
        }
      }
    });
    framesObserver.observe(window.document, { subtree: true, childList: true });
  }

  public static getPercentage = (percent: number | undefined, loaded: number, total: number, expectedTransferSize: number) => {
    if (typeof percent === 'undefined') {
      if (total || expectedTransferSize) {
        percent = Math.round((loaded / (total || expectedTransferSize)) * 100);
      }
    }
    return percent;
  };

  public relay = (frameId: string, message: RenderMessage) => {
    const frameData = this.frames.get(frameId);
    if (frameData) {
      frameData.queue.push(message);
      if (frameData.readyToReceive) {
        this.flush({ frameId, queue: frameData.queue });
      }
    }
  };

  public createRelay = (frameId: string): { renderModule: RenderInterface; cancellation: PromiseCancellation } => {
    const frameData = this.getOrCreate(frameId);
    return { renderModule: new RenderRelay(this, frameId), cancellation: frameData.cancellation };
  };

  public done = (frameId: string) => {
    this.relay(frameId, RelayManager.completionMessage);
  };

  public readyToReceive = (frameId: string) => {
    const frameData = this.getOrCreate(frameId);
    frameData.readyToReceive = true;
    this.flush({ frameId, queue: frameData.queue });
  };

  public renderProgressText = (frameId: string, text: string) => {
    const frameData = this.frames.get(frameId);
    if (frameData) {
      frameData.progressText = text;
      this.relay(frameId, { renderText: text });
    }
  };

  public renderProgress = ({ frameId, percent, loaded, total, expectedTransferSize }: Bm.AjaxProgress) => {
    const perc = RelayManager.getPercentage(percent, loaded, total, expectedTransferSize);
    if (typeof perc !== 'undefined') {
      const frameData = this.frames.get(frameId);
      if (frameData?.readyToReceive && typeof frameData.progressText !== 'undefined') {
        this.relay(frameId, { renderText: `${frameData.progressText} ${perc}%` });
      }
    }
  };

  private dropRemovedNodes = (removedNode: Node) => {
    let frameId: string | undefined;
    if (removedNode.nodeType === Node.ELEMENT_NODE) {
      const element = removedNode as HTMLElement;
      if (element.tagName === 'IFRAME') {
        frameId = element.id;
      }
    }
    if (frameId) {
      if (this.debug) {
        console.debug('releasing resources connected to frameId=', frameId);
      }
      const frameData = this.frames.get(frameId);
      if (frameData) {
        frameData.cancellation.cancel = true;
        this.frames.delete(frameId);
      }
    } else {
      for (const childNode of removedNode.childNodes) {
        this.dropRemovedNodes(childNode);
      }
    }
  };

  private getOrCreate = (frameId: string): FrameEntry => {
    const frameEntry = this.frames.get(frameId);
    if (frameEntry) return frameEntry;
    const newFrameEntry = { queue: [], cancellation: { cancel: false } };
    this.frames.set(frameId, newFrameEntry);
    return newFrameEntry;
  };

  private flush = ({ frameId, queue }: { frameId: string; queue: RenderMessage[] }) => {
    while (true) {
      const message = queue.shift();
      if (message) {
        const msg: RenderMessageWithFrameId = { ...message, frameId };
        BrowserMsg.send.pgpBlockRender(
          'broadcast', // todo: own tabId?
          msg
        );
        if (message === RelayManager.completionMessage) {
          this.frames.delete(frameId);
        }
      } else break;
    }
  };
}
