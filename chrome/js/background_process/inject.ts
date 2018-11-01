/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

/// <reference path="../../../node_modules/@types/chrome/index.d.ts" />
/// <reference path="../../../node_modules/@types/openpgp/index.d.ts" />
/// <reference path="../common/common.d.ts" />

let inject_cryptup_into_webmail_if_needed = () => {
  for (let group of chrome.runtime.getManifest().content_scripts!) {  // we know it's in the manifest
    get_content_script_tab_ids(group.matches || [], (tab_ids) => {
      for (let tab_id of tab_ids) {
        is_content_script_injection_needed(tab_id, (already_injected) => {
          if (!already_injected) {
            console.info("Injecting FlowCrypt into tab " + tab_id);
            inject_content_scripts(tab_id, group.js || []);
          }
        });
      }
    });
  }
};

let get_content_script_tab_ids = (matches: string[], callback: (tab_ids: number[]) => void) => {
  chrome.tabs.query({ 'url': matches }, result => {
    callback(result.filter(tab => typeof tab.id !== 'undefined').map((tab)  => tab.id) as number[]);
  });
};

let is_content_script_injection_needed = (tab_id: number, callback: (injected: boolean) => void) => {
  chrome.tabs.executeScript(tab_id, { code: 'Boolean(window.injected)' }, results => {
    callback(results[0]);
  });
};

let inject_content_scripts = (tab_id: number, files: string[], callback:Callback|null=null) => {
  let files_copy = files.slice();
  chrome.tabs.executeScript(tab_id, { file: files_copy.shift() }, results => {
    if (files_copy.length) {
      inject_content_scripts(tab_id, files_copy, callback);
    } else if (callback) {
      callback();
    }
  });
};
