/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { View } from './view.js';

export abstract class ViewModule<T extends View> {

  protected view: T;

  constructor(view: T) {
    this.view = view;
  }

}
