
export type RecipientErrsMode = 'harshRecipientErrs' | 'gentleRecipientErrs';

export class ComposerUserError extends Error { }
export class ComposerNotReadyError extends ComposerUserError { }
export class ComposerResetBtnTrigger extends Error { }

export const PUBKEY_LOOKUP_RESULT_FAIL: 'fail' = 'fail';
export const PUBKEY_LOOKUP_RESULT_WRONG: 'wrong' = 'wrong';
