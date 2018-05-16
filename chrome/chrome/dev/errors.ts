/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

tool.catch.try(() => {

  Store.get(null, ['errors']).then((storage: {errors: string[]}) => {
    if(storage.errors && storage.errors.length) {
      let errors = ('<p>' + storage.errors.join('</p><br/><p>') + '</p>').replace(/\n/g, '<br>');
      $('.pre').html(errors);
    }
  });

  $('.clear').click(() => Store.remove(null, ['errors']).then(() => window.location.reload()));

})();