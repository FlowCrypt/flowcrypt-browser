'use strict';

// It's intended to send messages about human interactions (fairly infrequent messages)
// If you send many messages programmatically, some will be dropped


var signal_listener_frequency_ms = 300;
var signal_listener_max_inactivity_ms = 700;
var signal_slots_per_listener = 10000;
var key_list_by_receiver = {};
var scope = '';
var signal_scope_default_value = 'default';
var listen_timers = {};
var listen_last = {};
var listen_handlers = {};
var internals = undefined;


function signal_scope_set(new_scope) {
  scope = new_scope;
}

function signal_scope_get() {
  return scope;
}

function signal_listen(receiver, callbacks) {
  listen_handlers[receiver] = callbacks;
  listen_timers[receiver] = internals.setup_signal_listening_interval(receiver, callbacks);
}

function signal_send(receiver, name, data, custom_scope, then) {
  var random_signal_slot = internals.random_int(0, signal_slots_per_listener);
  var random_signal_slot_storage_key = internals.q_storage_key(receiver, random_signal_slot, custom_scope);
  var storage_with_random_signal_slot_filled = {};
  storage_with_random_signal_slot_filled[random_signal_slot_storage_key] = {
    name: name,
    data: data
  };
  console.log('signal out [' + (custom_scope || signal_scope_get()) + ':' + receiver + '/' + random_signal_slot + '] ' + name + ' ' + (JSON.stringify(data) || ''));
  chrome.storage.local.set(storage_with_random_signal_slot_filled, then); //async
}


var internals = new function() {
  var self = this; // to remain the same within scopes of following functions
  self.q_storage_key = function(name, i, custom_scope) {
    return '!singal.' + (custom_scope || signal_scope_get()) + '.' + name + '.' + i + '!';
  }
  self.q_storage_key_list = function(name, custom_scope) {
    var key_list = [];
    for(var i = 0; i < signal_slots_per_listener; i++) {
      key_list.push(self.q_storage_key(name, i, custom_scope));
    }
    return key_list;
  }
  self.collect_signals_from_storage_and_flush = function(receiver, storage) {
    var signals = [];
    var keys_to_flush = [];
    for(var key in storage) {
      if(storage.hasOwnProperty(key)) {
        keys_to_flush.push(key);
        signals.push(storage[key]);
      }
    }
    chrome.storage.local.remove(keys_to_flush); //async
    return signals;
  }
  self.random_int = function(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  self.setup_signal_listening_interval = function(receiver, callbacks) {
    return setInterval(function() {
      if(scope && typeof key_list_by_receiver[receiver] === 'undefined') {
        key_list_by_receiver[receiver] = self.q_storage_key_list(receiver);
      }
      if(typeof key_list_by_receiver[receiver] !== 'undefined') {
        chrome.storage.local.get(key_list_by_receiver[receiver], function(storage) {
          listen_last[receiver] = new Date();
          var new_signals = self.collect_signals_from_storage_and_flush(receiver, storage);
          for(var i = 0; i < new_signals.length; i++) {
            var signal = new_signals[i];
            console.log('signal in [' + signal_scope_get() + ':' + receiver + '] ' + signal.name + ' ' + (JSON.stringify(signal.data) || ''));
            if(typeof callbacks[signal.name] !== 'undefined') {
              callbacks[signal.name](signal.data);
            } else {
              console.log('no listener for ' + signal.name + ' in ' + receiver);
            }
          }
        });
      }
    }, signal_listener_frequency_ms);
  }
  self.reactivate_sleeping_listeners = function() {
    var now = new Date();
    for(var receiver in listen_last) {
      if(typeof listen_last[receiver] !== 'undefined' && now - listen_last[receiver] > signal_listener_max_inactivity_ms) {
        clearInterval(listen_timers[receiver]); // no listener action for over 2 cycles, stop it and start again
        listen_timers[receiver] = self.setup_signal_listening_interval(receiver, listen_handlers[receiver]);
        console.log('reactivated signal listener: ' + receiver + ', sleeping ' + (now - listen_last[receiver]).toString() + 'ms');
      }
    }
  }
}

window.addEventListener('focus', function() {
  setTimeout(internals.reactivate_sleeping_listeners, signal_listener_max_inactivity_ms);
});
