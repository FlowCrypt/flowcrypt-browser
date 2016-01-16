
// It's intended to send messages about human interactions (fairly infrequent messages)
// If you send many messages programmatically, some will be dropped
// todo - separate listeners by tabs when needed, or replicate message for all listeners

var signal_listener_frequency_ms = 300;
var signal_slots_per_listener = 10000;
var key_list_by_receiver = {};

var test_v = '2';

function q_storage_key(name, i){
  return '!v' + test_v + '.singal.' + name + '.' + i + '!';
}

function q_storage_key_list(name){
  var key_list = [];
  for(var i=0;i<signal_slots_per_listener;i++){
    key_list.push(q_storage_key(name, i));
  }
  return key_list;
}

function collect_signals_from_storage_and_flush(receiver, storage){
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

function set_signal_listener(receiver, callbacks) {
  key_list_by_receiver[receiver] = q_storage_key_list(receiver);
  setInterval(function(){
    chrome.storage.local.get(key_list_by_receiver[receiver], function(storage) {
      var new_signals = collect_signals_from_storage_and_flush(receiver, storage);
      for (var i = 0; i < new_signals.length; i++) {
        var signal = new_signals[i];
        console.log('signal in [' + signal.sender + ' -> ' + receiver + '] ' + signal.name + ' ' + JSON.stringify(signal.data));
        callbacks[signal.name](signal.data, signal.sender);
      }
    });
  }, signal_listener_frequency_ms);
}

function send_signal(name, sender, receiver, data){
  var random_signal_slot = random_int(0, signal_slots_per_listener);
  var random_signal_slot_storage_key = q_storage_key(receiver, random_signal_slot);
  var storage_with_random_signal_slot_filled = {};
  storage_with_random_signal_slot_filled[random_signal_slot_storage_key] = {name: name, sender: sender, data: data};
  console.log('signal out [' + sender + ' -> ' + receiver + '/' + random_signal_slot + '] ' + name + ' ' + JSON.stringify(data));
  chrome.storage.local.set(storage_with_random_signal_slot_filled); //async
}
