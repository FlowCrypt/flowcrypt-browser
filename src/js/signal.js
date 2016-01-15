
// This library uses very vague locking mechanism
// It's intended to send messages about human interactions (fairly infrequent messages)
// If you send many messages programmatically, some will be dropped
// It's possible messages will get dropped under light use, but unlikely

// todo - receiver-level locking instead of a global lock
// todo - separate receivers by tabs when needed, or replicate message for all receivers

var write_retry_ms = 99;
var signal_listener_frequency_ms = 300;

var test_v = '1';

function q_storage_key(name){
  return '!_' + test_v + '_singal.queue.' + name + '!';
}

var lock = false;

function set_signal_listener(receiver, callbacks) {
  setInterval(function(){
    if (!lock){
      lock = true;
      chrome.storage.local.get([q_storage_key(receiver)], function(storage) {
        var my_queue = storage[q_storage_key(receiver)];
        if(typeof my_queue === 'undefined' || my_queue.length > 0) {
          var clear_my_queue = {};
          clear_my_queue[q_storage_key(receiver)] = [];
          chrome.storage.local.set(clear_my_queue, function(){
            lock = false;
          });
        }
        else {
          lock = false;
        }
        for (var i = 0; i < my_queue.length; i++) {
          var msg = my_queue[i];
          callbacks[msg.name](msg.data, msg.sender);
        }
      });
    }
    else {
      console.log('notice: signal_listener skipped a beat because someone is currently listening')
    }
  }, signal_listener_frequency_ms);
}

function send_signal(name, sender, receiver, data){
  if (!lock) {
    lock = true;
    chrome.storage.local.get([q_storage_key(receiver)], function(storage) {
      storage[q_storage_key(receiver)].push({name: name, sender: sender, data: data});
      chrome.storage.local.set(storage, function(){
        lock = false;
      })
    });
  }
  else {
    setTimeout(function(){
      write_when_lock_open(name, sender, receiver, data);
    }, write_retry_ms);
  }
}
