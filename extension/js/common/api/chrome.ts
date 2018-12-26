/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

export const tabsQuery = (q: chrome.tabs.QueryInfo): Promise<chrome.tabs.Tab[]> => new Promise(resolve => chrome.tabs.query(q, resolve));

export const windowsCreate = (q: chrome.windows.CreateData): Promise<chrome.windows.Window | undefined> => new Promise(resolve => {
  if (typeof chrome.windows !== 'undefined') {
    chrome.windows.create(q, resolve);
  } else {
    alert('Your platform is not supported: browser does not support extension windows');
  }
});
