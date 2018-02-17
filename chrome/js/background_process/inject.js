/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

let responses = {};

function inject_cryptup_into_webmail_if_needed() {
  tool.each(chrome.runtime.getManifest().content_scripts, (i, group) => {
    get_content_script_tab_ids(group.matches, (tab_ids) => {
      tool.each(tab_ids, (i, tab_id) => {
        is_content_script_injection_needed(tab_id, (already_injected) => {
          if(!already_injected) {
            console.log("Injecting FlowCrypt into tab " + tab_id);
            inject_content_scripts(tab_id, group.js);
          }
        });
      });
    });
  });
}

function get_content_script_tab_ids(matches, callback) {
  chrome.tabs.query({ 'url': matches }, result => {
    callback(result.map(function (tab) {
      return tab.id;
    }));
  });
}

function is_content_script_injection_needed(tab_id, callback) {
  chrome.tabs.executeScript(tab_id, { code: 'Boolean(window.injected)' }, results => {
    callback(results[0]);
  });
}

function inject_content_scripts(tab_id, files, callback) {
  let files_copy = files.slice();
  chrome.tabs.executeScript(tab_id, { file: files_copy.shift() }, results => {
    if(files_copy.length) {
      inject_content_scripts(tab_id, files_copy, callback);
    } else if(callback) {
      callback();
    }
  });
}
