'use strict';

account_storage_get(null, 'errors', function(storage) {
  if(storage.errors && storage.errors.length) {
    var errors = ('<p>' + storage.errors.join('</p><br/><p>') + '</p>').replace(/\n/g, '<br>');
    $('.pre').html(errors);
  }
});

$('.clear').click(function() {
  account_storage_remove(null, 'errors', function() {
    window.location.reload();
  });
});
