/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

tool.catch.try(() => {

  Store.get(null, ['errors'], (storage: {errors: string[]}) => {
    if(storage.errors && storage.errors.length) {
      var errors = ('<p>' + storage.errors.join('</p><br/><p>') + '</p>').replace(/\n/g, '<br>');
      $('.pre').html(errors);
    }
  });

  $('.clear').click(function () {
    Store.remove(null, ['errors'], function () {
      window.location.reload();
    });
  });

})();