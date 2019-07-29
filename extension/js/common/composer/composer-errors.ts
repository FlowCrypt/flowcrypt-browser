/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

export type RecipientErrsMode = 'harshRecipientErrs' | 'gentleRecipientErrs';

export class ComposerUserError extends Error { }
export class ComposerNotReadyError extends ComposerUserError { }
export class ComposerResetBtnTrigger extends Error { }
