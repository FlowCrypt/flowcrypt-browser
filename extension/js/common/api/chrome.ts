/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

// could be replaced by a shim from mozilla

export const tabsQuery = (q: chrome.tabs.QueryInfo): Promise<chrome.tabs.Tab[]> => new Promise(resolve => chrome.tabs.query(q, resolve));

export const windowsCreate = (q: chrome.windows.CreateData): Promise<chrome.windows.Window | undefined> => new Promise(resolve => chrome.windows.create(q, resolve));
