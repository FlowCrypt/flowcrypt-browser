/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Lang } from '../../../js/common/lang.js';
import { isEnterpriseBuildUsed } from '../../../js/common/helpers.js';
import { Ui } from '../../../js/common/browser/ui.js';

const contactForSupportContainer = $('.ask_support_assistance_container');

contactForSupportContainer.text(Lang.general.contactIfNeedAssistance(isEnterpriseBuildUsed()));
Ui.activateModalPageLinkTags();
