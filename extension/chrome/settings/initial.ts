/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch } from '../../js/common/platform/catch.js';
import { View } from '../../js/common/view.js';

View.run(class InitialView extends View {

  public render = async () => {
    if (Catch.browser().name === 'chrome' && Number(Catch.browser().v) >= 76) {
      $('#chrome-steps').css('display', 'block');
    } else {
      $('#firefox-steps').css('display', 'block');
    }
  }

  public setHandlers = () => {
    // none
  }

});
