/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

export const injectFcIntoWebmailIfNeeded = () => {
  for (const group of chrome.runtime.getManifest().content_scripts!) {  // we know it's in the manifest
    getContentCcriptTabIds(group.matches || [], (tabIds) => {
      for (const tabId of tabIds) {
        isContentScriptInjectionNeeded(tabId, (alreadyInjected) => {
          if (!alreadyInjected) {
            console.info("Injecting FlowCrypt into tab " + tabId);
            injectContentScripts(tabId, group.js || []);
          }
        });
      }
    });
  }
};

const getContentCcriptTabIds = (matches: string[], callback: (tabIds: number[]) => void) => {
  chrome.tabs.query({ 'url': matches }, result => {
    callback(result.filter(tab => typeof tab.id !== 'undefined').map((tab) => tab.id) as number[]);
  });
};

const isContentScriptInjectionNeeded = (tabId: number, callback: (injected: boolean) => void) => {
  chrome.tabs.executeScript(tabId, { code: 'Boolean(window.injected)' }, results => {
    callback(results[0]);
  });
};

const injectContentScripts = (tabId: number, files: string[], callback: (() => void) | null = null) => {
  const filesCopy = files.slice();
  chrome.tabs.executeScript(tabId, { file: filesCopy.shift() }, results => {
    if (filesCopy.length) {
      injectContentScripts(tabId, filesCopy, callback);
    } else if (callback) {
      callback();
    }
  });
};
