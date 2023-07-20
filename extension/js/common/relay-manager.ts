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
  relay?: RenderRelay;
};

export class RelayManager implements RelayManagerInterface {
  private readonly frames = new Map<string, FrameEntry>();

  public constructor(private debug: boolean = false) {
    const framesObserver = new MutationObserver(async mutationsList => {
      for (const mutation of mutationsList) {
        if (mutation.type === 'childList') {
          const removedFrameIds = this.findFrameIds(mutation.removedNodes);
          const addedFrameIds = this.findFrameIds(mutation.addedNodes);
          for (const frameId of removedFrameIds) {
            if (addedFrameIds.includes(frameId)) {
              this.restartRelay(frameId);
            } else {
              this.dropRemovedFrame(frameId);
            }
          }
        }
      }
    });
    framesObserver.observe(window.document, { subtree: true, childList: true });
  }

  public relay = (frameId: string, message: RenderMessage, dontEnqueue?: boolean) => {
    const frameData = this.frames.get(frameId);
    if (frameData) {
      if (!dontEnqueue || this.flushIfReady(frameId)) {
        frameData.queue.push(message);
        this.flushIfReady(frameId);
      }
    }
  };

  public createAndStartRelay = (frameId: string, processor: (renderModule: RenderInterface) => Promise<void>) => {
    const frameData = this.getOrCreate(frameId);
    const relay = new RenderRelay(this, frameId, processor);
    frameData.relay = relay;
    relay.start();
  };

  public retry = (frameId: string) => {
    const frameData = this.frames.get(frameId);
    frameData?.relay?.executeRetry();
  };

  public renderProgress = (r: Bm.AjaxProgress) => {
    // simply forward this message to all relays
    // the correct recipient will recognize itself by operationId match
    // and return true
    for (const [, value] of this.frames) {
      if (value.relay?.renderProgress(r)) break;
    }
  };

  public associate = (frameId: string, tabId: string) => {
    const frameData = this.getOrCreate(frameId);
    frameData.tabId = tabId;
    this.flushIfReady(frameId);
  };

  public restartRelay = (frameId: string) => {
    const frameData = this.frames.get(frameId);
    if (frameData?.relay) {
      frameData.relay.cancellation.cancel = true; // cancel the old processing to prevent interference and release resources
      const relay = frameData.relay.clone();
      this.frames.set(frameId, { queue: [], relay }); // wire the new relay
      relay.start(); // start the processor anew
    }
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
    const newFrameEntry = { queue: [] };
    this.frames.set(frameId, newFrameEntry);
    return newFrameEntry;
  };

  private flushIfReady = (frameId: string) => {
    const frameData = this.frames.get(frameId);
    while (frameData?.tabId) {
      const message = frameData.queue.shift();
      if (message) {
        BrowserMsg.send.pgpBlockRender(frameData.tabId, message);
      } else {
        return true; // flushed
      }
    }
    return false; // not flushed
  };
}
