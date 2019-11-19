/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypcom */

'use strict';

import { NewMsgData, ComposerUrlParams } from '../interfaces/composer-types.js';
import { Composer } from '../composer.js';
import { SendableMsg } from '../../api/email_provider_api.js';

export interface MailFormatterInterface {
  createMsgObject(): Promise<SendableMsg>;
}

export class BaseMailFormatter {
  protected composer: Composer;
  protected urlParams: ComposerUrlParams;

  protected newMsgData: NewMsgData;

  constructor(composer: Composer, newMsgData: NewMsgData) {
    this.composer = composer;
    this.urlParams = composer.urlParams;
    this.newMsgData = newMsgData;
  }
}
