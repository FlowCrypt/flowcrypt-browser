/* Business Source License 1.0 © 2016 FlowCrypt Limited (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/CryptUp/cryptup-browser/tree/master/src/LICENCE */

'use strict';

window.flowcrypt_storage.get(null, 'errors', storage => {
  if(storage.errors && storage.errors.length) {
    var errors = ('<p>' + storage.errors.join('</p><br/><p>') + '</p>').replace(/\n/g, '<br>');
    $('.pre').html(errors);
  }
});

$('.clear').click(function () {
  window.flowcrypt_storage.remove(null, 'errors', function () {
    window.location.reload();
  });
});
