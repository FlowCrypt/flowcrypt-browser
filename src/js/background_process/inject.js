'use strict';

var responses = {};

function inject_cryptup_into_gmail_if_needed(type) {
  $.each(chrome.runtime.getManifest().content_scripts, function(i, group) {
    get_content_script_tab_ids(group.matches, function(tab_ids) {
      $.each(tab_ids, function(i, tab_id) {
        is_content_script_injection_needed(tab_id, function(already_injected) {
          if(!already_injected) {
            if(type === 'notification_only') {
              console.log("Injecting CryptUP notification into tab " + tab_id);
              inject_notification(tab_id, 'Please <a href="#" class="reload">reload this Gmail tab</a> to make CryptUP work.');
            } else {
              console.log("Injecting CryptUP into tab " + tab_id);
              inject_content_scripts(tab_id, group.js);
            }
          }
        });
      });
    });
  });
}

function get_content_script_tab_ids(matches, callback) {
  chrome.tabs.query({
    'url': matches
  }, function(result) {
    callback(result.map(function(tab) {
      return tab.id;
    }));
  });
}

function is_content_script_injection_needed(tab_id, callback) {
  chrome.tabs.executeScript(tab_id, {
    code: 'Boolean(window.injected)',
  }, function(results) {
    callback(results[0]);
  });
}

function inject_content_scripts(tab_id, files, callback) {
  chrome.tabs.executeScript(tab_id, {
    file: files.shift(),
  }, function(results) {
    if(files.length) {
      inject_content_scripts(tab_id, files, callback);
    } else if(callback) {
      callback();
    }
  });
}

function inject_notification(tab_id, notification) {
  var files = [
    "/lib/jquery.min.js",
    "/js/common/storage.js",
    "/js/common/common.js",
    "/js/content_scripts/gmail_tab/elements/inject.js",
    "/js/content_scripts/gmail_tab/elements/notifications.js",
  ];
  inject_content_scripts(tab_id, files, function() {
    var code = [
      'Try(function() {',
      '  init_elements_inject_js();',
      '  init_elements_notifications_js();',
      '  inject_meta("");',
      '  gmail_notification_show("' + notification.replace(/"/g, '\\\"') + '");',
      '  $("body").one("click", Try(gmail_notification_clear));',
      '  window.same_world_global = true;',
      '})();',
    ].join('\n');
    chrome.tabs.executeScript(tab_id, {
      code: code,
    });
  });
}
