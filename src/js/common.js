function get_url_params(expected_keys) {
  var raw_url_data = window.location.search.replace('?', '').split('&');
  var url_data = {};
  for(var i = 0; i < raw_url_data.length; i++) {
    var pair = raw_url_data[i].split('=');
    if(expected_keys.indexOf(pair[0]) !== -1) {
      url_data[pair[0]] = decodeURIComponent(pair[1]);
    }
  }
  return url_data;
}

function is_email_valid(email) {
  return /[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/i.test(email);
}

function get_account_emails(callback) {
  account_storage_get(null, ['account_emails'], function(storage) {
    var account_emails = [];
    if(typeof storage['account_emails'] !== 'undefined') {
      account_emails = JSON.parse(storage['account_emails']);
    }
    callback(account_emails);
  });
}

function for_each_known_account_email(callback) {
  get_account_emails(function(account_emails) {
    for(var i in account_emails) {
      callback(account_emails[i]);
    }
  });
}

function add_account_email_to_list_of_accounts(account_email, callback) { //todo: concurrency issues with another tab loaded at the same time
  get_account_emails(function(account_emails) {
    if(account_emails.indexOf(account_email) === -1) {
      account_emails.push(account_email);
      account_storage_set(null, {
        'account_emails': JSON.stringify(account_emails)
      }, callback);
    } else if(typeof callback !== 'undefined') {
      callback();
    }
  });
}

function get_spinner() {
  return '&nbsp;<i class="fa fa-spinner fa-spin"></i>&nbsp;';
}

function random_string(length) {
  var id = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  for(var i = 0; i < (length || 5); i++) {
    id += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return id;
}

/* -------------------- DOUBLE CLICK/PARALLEL PROTECTION FOR JQUERY ----------------------------------- */

var events_fired = {};
var DOUBLECLICK_MS = 1000;

function doubleclick() {
  return {
    name: 'doubleclick',
    id: random_string(10),
  };
}

function parallel() {
  return {
    name: 'parallel',
    id: random_string(10),
  };
}

function prevent(meta, callback) {
  return function() {
    if(meta.id in events_fired) {
      if(meta.name === 'parallel') {
        return; // id was found - means the event handling is still being processed. Do not call back
      } else if(meta.name === 'doubleclick') {
        if(Date.now() - events_fired[meta.id] > DOUBLECLICK_MS) {
          events_fired[meta.id] = Date.now();
          callback(this, meta.id);
        }
      }
    } else {
      events_fired[meta.id] = Date.now();
      callback(this, meta.id);
    }
  }
}

function release(id) {
  if(id in events_fired) {
    var ms_to_release = DOUBLECLICK_MS + events_fired[id] - Date.now();
    if(ms_to_release > 0) {
      setTimeout(function() {
        delete events_fired[id];
      }, ms_to_release);
    } else {
      delete events_fired[id];
    }
  }
}
