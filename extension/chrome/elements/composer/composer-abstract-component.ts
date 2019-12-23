/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypcom */

'use strict';

import { Composer } from './composer';
import { ComposeView } from '../../../chrome/elements/compose';

export abstract class ComposerComponent {
  protected composer: Composer;
  protected view: ComposeView;

  constructor(composer: Composer) {
    this.composer = composer;
    this.view = composer.view;
  }

  public abstract initActions(): void;
}
