/* Business Source License 1.0 © 2016 FlowCrypt Limited (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/CryptUp/cryptup-browser/tree/master/src/LICENCE */

'use strict';

var responses = {};

function inject_cryptup_into_webmail_if_needed() {
  $.each(chrome.runtime.getManifest().content_scripts, function (i, group) {
    get_content_script_tab_ids(group.matches, function (tab_ids) {
      $.each(tab_ids, function (i, tab_id) {
        is_content_script_injection_needed(tab_id, function (already_injected) {
          if(!already_injected) {
            console.log("Injecting CryptUp into tab " + tab_id);
            inject_content_scripts(tab_id, group.js);
          }
        });
      });
    });
  });
}

function get_content_script_tab_ids(matches, callback) {
  chrome.tabs.query({ 'url': matches }, function (result) {
    callback(result.map(function (tab) {
      return tab.id;
    }));
  });
}

function is_content_script_injection_needed(tab_id, callback) {
  chrome.tabs.executeScript(tab_id, { code: 'Boolean(window.injected)' }, function (results) {
    callback(results[0]);
  });
}

function inject_content_scripts(tab_id, files, callback) {
  var files_copy = files.slice();
  chrome.tabs.executeScript(tab_id, { file: files_copy.shift() }, function (results) {
    if(files_copy.length) {
      inject_content_scripts(tab_id, files_copy, callback);
    } else if(callback) {
      callback();
    }
  });
}
