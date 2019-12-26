/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypcom */

'use strict';

import { ComposeView } from '../../../chrome/elements/compose';
import { Composer } from './composer';

export abstract class ComposerComponent {
  protected composer: Composer;
  protected view: ComposeView;

  constructor(composer: Composer) {
    this.composer = composer;
    this.view = composer.view;
  }

  public abstract initActions(): void;
}
