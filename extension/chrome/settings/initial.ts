/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch } from '../../js/common/platform/catch.js';

if (Catch.browser().name === 'chrome' && Number(Catch.browser().v) >= 76) {
  $('#chrome-steps').css('display', 'block');
} else {
  $('#firefox-steps').css('display', 'block');
}
