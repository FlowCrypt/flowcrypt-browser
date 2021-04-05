/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { View } from './view.js';

export abstract class ViewModule<T extends View> {

  protected view: T;

  constructor(view: T) {
    this.view = view;
  }

}
