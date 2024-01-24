/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch } from '../../js/common/platform/catch.js';
import { View } from '../../js/common/view.js';

View.run(
  class InitialView extends View {
    public render = async () => {
      const browserName = Catch.browser().name === 'chrome' && Number(Catch.browser().v) >= 76 ? 'chrome' : 'firefox';
      const stepsEl = document.getElementById(`${browserName}-steps`);
      if (stepsEl) {
        stepsEl.style.display = 'block';
      }
    };

    public setHandlers = () => {
      // none
    };
  }
);
