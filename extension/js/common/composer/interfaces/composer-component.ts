/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypcom */

'use strict';

import { Composer } from '../composer';
import { ComposerUrlParams } from './composer-types';

export abstract class ComposerComponent {
  protected composer: Composer;
  protected urlParams: ComposerUrlParams;

  constructor(composer: Composer, urlParams: ComposerUrlParams) {
    this.composer = composer;
    this.urlParams = urlParams;
  }

  abstract initActions(): void;
}
