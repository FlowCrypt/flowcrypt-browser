/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

tool.catch.try(async () => {

  let storage = await Store.get_global(['errors']);
  if (storage.errors && storage.errors.length > 0) {
    let errors = ('<p>' + storage.errors.join('</p><br/><p>') + '</p>').replace(/\n/g, '<br>');
    $('.pre').html(tool.str.html_sanitize(errors)); // xss-sanitized
  }

  $('.clear').click(tool.ui.event.handle(async () => {
    await Store.remove(null, ['errors']);
    window.location.reload();
  }));

})();
