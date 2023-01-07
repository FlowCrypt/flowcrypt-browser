/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Lang } from '../../js/common/lang.js';
import { View } from '../../js/common/view.js';
View.run(
  class EmailProviderAuthSecurityView extends View {
    public render = async () => {
      const contactForSupportContainer = $('.ask_support_assistance_container');
      const htmlBody = $('body');
      contactForSupportContainer.text(Lang.general.contactIfNeedAssistance());
      htmlBody.css('display', 'block');
    };

    public setHandlers = () => {
      // no need
    };
  }
);
