'use strict';

// It's intended to send messages about human interactions (fairly infrequent messages)
// If you send many messages programmatically, some will be dropped
// todo - separate listeners by tabs when needed, or replicate message for all listeners

var signal_listener_frequency_ms = 300;
var signal_slots_per_listener = 10000;
var key_list_by_receiver = {};
var scope = '';
var signal_scope_default_value = 'default';

function signal_scope_set(new_scope) {
  scope = new_scope;
}

function signal_scope_get() {
  return scope;
}

function q_storage_key(name, i, custom_scope) {
  return '!singal.' + ( custom_scope || signal_scope_get() ) + '.' + name + '.' + i + '!';
}

function q_storage_key_list(name, custom_scope) {
  var key_list = [];
  for(var i=0;i<signal_slots_per_listener;i++){
    key_list.push(q_storage_key(name, i, custom_scope));
  }
  return key_list;
}

function collect_signals_from_storage_and_flush(receiver, storage) {
  var signals = [];
  var keys_to_flush = [];
  for (var key in storage) {
    if (storage.hasOwnProperty(key)) {
      keys_to_flush.push(key);
      signals.push(storage[key]);
    }
  }
  chrome.storage.local.remove(keys_to_flush); //async
  return signals;
}

function random_int(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function signal_listen(receiver, callbacks) {
  setInterval(function() {
    if(scope && typeof key_list_by_receiver[receiver] === 'undefined') {
      key_list_by_receiver[receiver] = q_storage_key_list(receiver);
    }
    if(typeof key_list_by_receiver[receiver] !== 'undefined') {
      chrome.storage.local.get(key_list_by_receiver[receiver], function(storage) {
        var new_signals = collect_signals_from_storage_and_flush(receiver, storage);
        for (var i = 0; i < new_signals.length; i++) {
          var signal = new_signals[i];
          console.log('signal in [' + signal_scope_get() + ':' + receiver + '] ' + signal.name + ' ' + JSON.stringify(signal.data));
          if(typeof callbacks[signal.name] !== 'undefined') {
            callbacks[signal.name](signal.data);
          }
          else {
            console.log('no listener for ' + signal.name + ' in ' + receiver);
          }
        }
      });
    }
  }, signal_listener_frequency_ms);
}

function signal_send(receiver, name, data, custom_scope) {
  var random_signal_slot = random_int(0, signal_slots_per_listener);
  var random_signal_slot_storage_key = q_storage_key(receiver, random_signal_slot, custom_scope);
  var storage_with_random_signal_slot_filled = {};
  storage_with_random_signal_slot_filled[random_signal_slot_storage_key] = {name: name, data: data};
  console.log('signal out [' + ( custom_scope || signal_scope_get() ) + ':' + receiver + '/' + random_signal_slot + '] ' + name + ' ' + JSON.stringify(data));
  chrome.storage.local.set(storage_with_random_signal_slot_filled); //async
}
