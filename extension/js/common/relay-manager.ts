/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Bm } from './browser/browser-msg.js';
import { PromiseCancellation } from './core/common.js';
import { BindInterface, RelayManagerInterface } from './relay-manager-interface.js';
import { RenderInterface } from './render-interface.js';
import { RenderMessage } from './render-message.js';
import { RenderRelay } from './render-relay.js';

type FrameEntry = {
  frameWindow?: Window;
  readyToReceive?: true;
  queue: RenderMessage[];
  cancellation: PromiseCancellation;
  progressText?: string;
};

export class RelayManager implements RelayManagerInterface, BindInterface {
  private static readonly completionMessage: RenderMessage = { done: true };
  private readonly frames = new Map<string, FrameEntry>();
  private readonly frameElementsMap = new Map<Node, string>();
  private readonly targetOrigin = chrome.runtime.getURL('');

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
      if (frameData.readyToReceive && frameData.frameWindow) {
        this.flush({ frameId, frameWindow: frameData.frameWindow, queue: frameData.queue });
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
    if (frameData.frameWindow) {
      this.flush({ frameId, frameWindow: frameData.frameWindow, queue: frameData.queue });
    }
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

  public bind = (frameId: string, { frameElement, frameWindow }: { frameElement: HTMLIFrameElement; frameWindow: Window }) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const frameData = this.frames.get(frameId)!;
    frameData.frameWindow = frameWindow;
    this.frameElementsMap.set(frameElement, frameId);
    if (frameData.readyToReceive) {
      this.flush({ frameId, frameWindow, queue: frameData.queue });
    }
  };

  private dropRemovedNodes = (removedNode: Node) => {
    const frameId = this.frameElementsMap.get(removedNode);
    if (frameId) {
      if (this.debug) {
        console.debug('releasing resources connected to frameId=', frameId);
      }
      this.frameElementsMap.delete(removedNode);
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

  private flush = ({ frameId, frameWindow, queue }: { frameId: string; frameWindow: Window; queue: RenderMessage[] }) => {
    while (true) {
      const message = queue.shift();
      if (message) {
        frameWindow.postMessage(message, this.targetOrigin);
        if (message === RelayManager.completionMessage) {
          this.frames.delete(frameId); // todo: also delete related this.frameElementsMap entry?
        }
      } else break;
    }
  };
}
