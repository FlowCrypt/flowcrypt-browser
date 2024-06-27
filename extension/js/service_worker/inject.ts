/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch } from '../common/platform/catch.js';

export const injectFcIntoWebmail = () => {
  const contentScriptGroups = chrome.runtime.getManifest().content_scripts ?? []; // we know it's in the manifest
  // one time when extension installed or on browser start - go through all matching tabs and inject
  for (const group of contentScriptGroups) {
    getContentScriptTabIds(group.matches || [], tabIds => {
      for (const tabId of tabIds) {
        injectContentScriptIntoTabIfNeeded(tabId, group.js || []);
      }
    });
  }
  // on Firefox, standard way of loading content scripts stopped working. We have to listen to tab loaded events, and inject then
  // basically here we do what normally the browser is supposed to do (inject content scripts when page is done loading)
  if (Catch.isFirefox()) {
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
  isContentScriptInjectionNeeded(tabId, alreadyInjected => {
    if (!alreadyInjected) {
      injectContentScripts(tabId, files);
    }
  });
};

const getContentScriptTabIds = (matches: string[], callback: (tabIds: number[]) => void) => {
  chrome.tabs.query({ url: matches }, result => {
    callback(result.filter(tab => typeof tab.id !== 'undefined').map(tab => tab.id) as number[]);
  });
};

const isContentScriptInjectionNeeded = (tabId: number, callback: (injected: boolean) => void) => {
  chrome.scripting.executeScript(
    {
      target: { tabId },
      func: () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        return Boolean((window as any).injected);
      },
    },
    results => {
      callback(results && results.length > 0 && results[0].result === true);
    }
  );
};

const injectContentScripts = (tabId: number, files: string[], callback?: () => void) => {
  const filesCopy = files.slice();
  const scriptFile = filesCopy.shift();
  chrome.scripting.executeScript(
    {
      target: { tabId },
      files: scriptFile ? [scriptFile] : [],
      injectImmediately: true,
    },
    () => {
      if (filesCopy.length) {
        injectContentScripts(tabId, filesCopy, callback);
      } else if (callback) {
        callback();
      }
    }
  );
};
