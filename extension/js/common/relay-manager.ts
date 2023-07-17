/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Bm, BrowserMsg } from './browser/browser-msg.js';
import { RelayManagerInterface } from './relay-manager-interface.js';
import { RenderInterface } from './render-interface.js';
import { RenderMessage } from './render-message.js';
import { RenderRelay } from './render-relay.js';

type FrameEntry = {
  tabId?: string;
  queue: RenderMessage[];
  progressText?: string;
  relay?: RenderRelay;
};

export class RelayManager implements RelayManagerInterface {
  private static readonly completionMessage: RenderMessage = { done: true };
  private readonly frames = new Map<string, FrameEntry>();

  public constructor(private debug: boolean = false) {
    const framesObserver = new MutationObserver(async mutationsList => {
      for (const mutation of mutationsList) {
        if (mutation.type === 'childList') {
          const removedFrameIds = this.findFrameIds(mutation.removedNodes);
          // todo: const addedFrameIds = this.findFrameIds(mutation.addedNodes);
          // Value.arr.intersection -- reloaded frames
          for (const frameId of removedFrameIds) {
            this.dropRemovedFrame(frameId);
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
      this.flushIfReady(frameId);
    }
  };

  public createRelay = (frameId: string): RenderInterface => {
    const frameData = this.getOrCreate(frameId);
    const relay = new RenderRelay(this, frameId);
    frameData.relay = relay;
    return relay;
  };

  public done = (frameId: string) => {
    this.relay(frameId, RelayManager.completionMessage);
  };

  public retry = (frameId: string) => {
    const frameData = this.frames.get(frameId);
    frameData?.relay?.executeRetry();
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
      if (frameData?.tabId && typeof frameData.progressText !== 'undefined') {
        this.relay(frameId, { renderText: `${frameData.progressText} ${perc}%` });
      }
    }
  };

  public associate = (frameId: string, tabId: string) => {
    const frameData = this.getOrCreate(frameId);
    frameData.tabId = tabId;
    this.flushIfReady(frameId);
  };

  private findFrameIds = (nodes: NodeList): string[] => {
    const frameIds: string[] = [];
    for (const node of nodes) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement;
        if (element.tagName === 'IFRAME') {
          frameIds.push(element.id);
          continue;
        }
      }
      frameIds.push(...this.findFrameIds(node.childNodes));
    }
    return frameIds;
  };

  private dropRemovedFrame = (frameId: string) => {
    if (this.debug) {
      console.debug('releasing resources connected to frameId=', frameId);
    }
    const frameData = this.frames.get(frameId);
    if (frameData) {
      if (frameData.relay?.cancellation) frameData.relay.cancellation.cancel = true;
      this.frames.delete(frameId);
    }
  };

  private getOrCreate = (frameId: string): FrameEntry => {
    const frameEntry = this.frames.get(frameId);
    if (frameEntry) return frameEntry;
    const newFrameEntry = { queue: [], cancellation: { cancel: false } };
    this.frames.set(frameId, newFrameEntry);
    return newFrameEntry;
  };

  private flushIfReady = (frameId: string) => {
    const frameData = this.frames.get(frameId);
    while (frameData?.tabId) {
      const message = frameData.queue.shift();
      if (message) {
        BrowserMsg.send.pgpBlockRender(frameData.tabId, message);
        if (message === RelayManager.completionMessage) {
          this.frames.delete(frameId);
          break;
        }
      } else break;
    }
  };
}
