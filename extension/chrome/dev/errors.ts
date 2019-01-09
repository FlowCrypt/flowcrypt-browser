/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch } from '../../js/common/platform/catch.js';
import { Store } from "../../js/common/platform/store.js";
import { Xss, Ui } from '../../js/common/browser.js';

Catch.try(async () => {

  const storage = await Store.getGlobal(['errors']);
  if (storage.errors && storage.errors.length > 0) {
    const errors = ('<p>' + storage.errors.join('</p><br/><p>') + '</p>').replace(/\n/g, '<br>');
    Xss.sanitizeRender('.pre', errors);
  }

  $('.clear').click(Ui.event.handle(async () => {
    await Store.removeGlobal(['errors']);
    window.location.reload();
  }));

})();
