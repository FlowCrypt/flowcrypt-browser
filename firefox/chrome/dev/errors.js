/* Business Source License 1.0 © 2016 FlowCrypt Limited (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/CryptUp/cryptup-browser/tree/master/src/LICENCE */

'use strict';

account_storage_get(null, 'errors', function (storage) {
  if(storage.errors && storage.errors.length) {
    var errors = ('<p>' + storage.errors.join('</p><br/><p>') + '</p>').replace(/\n/g, '<br>');
    $('.pre').html(errors);
  }
});

$('.clear').click(function () {
  account_storage_remove(null, 'errors', function () {
    window.location.reload();
  });
});
