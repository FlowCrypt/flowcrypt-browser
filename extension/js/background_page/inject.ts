/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch } from '../common/platform/catch.js';

export const injectFcIntoWebmail = () => {
  const contentScriptGroups = chrome.runtime.getManifest().content_scripts!; // we know it's in the manifest
  // one time when extension installed or on browser start - go through all matching tabs and inject
  for (const group of contentScriptGroups) {
    getContentScriptTabIds(group.matches || [], (tabIds) => {
      for (const tabId of tabIds) {
        injectContentScriptIntoTabIfNeeded(tabId, group.js || []);
      }
    });
  }
  // on Firefox, standard way of loading content scripts stopped working. We have to listen to tab loaded events, and inject then
  // basically here we do what normally the browser is supposed to do (inject content scripts when page is done loading)
  if (Catch.browser().name === 'firefox') {
    chrome.tabs.onUpdated.addListener((tabId, changed, tab) => {
      if (changed.status === 'complete' && tab.active && tab.url) {
        for (const group of contentScriptGroups) {
          for (const groupMatchUrl of group.matches || []) {
            if (tab.url.startsWith(groupMatchUrl.replace(/\*$/, ''))) {
              injectContentScriptIntoTabIfNeeded(tabId, group.js || []);
            }
          }
        }
      }
    });
  }
};

const injectContentScriptIntoTabIfNeeded = (tabId: number, files: string[]) => {
  isContentScriptInjectionNeeded(tabId, (alreadyInjected) => {
    if (!alreadyInjected) {
      console.info("Injecting FlowCrypt into tab " + tabId);
      injectContentScripts(tabId, files);
    }
  });
};

const getContentScriptTabIds = (matches: string[], callback: (tabIds: number[]) => void) => {
  chrome.tabs.query({ 'url': matches }, result => {
    callback(result.filter(tab => typeof tab.id !== 'undefined').map((tab) => tab.id) as number[]);
  });
};

const isContentScriptInjectionNeeded = (tabId: number, callback: (injected: boolean) => void) => {
  chrome.tabs.executeScript(tabId, { code: 'Boolean(window.injected)' }, (results: (boolean | undefined)[]) => {
    callback(results[0] === true);
  });
};

const injectContentScripts = (tabId: number, files: string[], callback?: () => void) => {
  const filesCopy = files.slice();
  chrome.tabs.executeScript(tabId, { file: filesCopy.shift() }, () => {
    if (filesCopy.length) {
      injectContentScripts(tabId, filesCopy, callback);
    } else if (callback) {
      callback();
    }
  });
};
