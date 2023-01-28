/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

export abstract class BackupUiModule<BackupUi> {
  protected ui: BackupUi;

  public constructor(ui: BackupUi) {
    this.ui = ui;
  }
}
