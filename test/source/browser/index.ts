export { BrowserHandle } from './browser_handle';
export { BrowserPool, Semaphore } from './browser_pool';
export { Controllable, ControllablePage, ControllableFrame } from './controllable';
export { Url, gmailSeq } from './url';

export const TIMEOUT_ELEMENT_GONE = 20;
export const TIMEOUT_ELEMENT_APPEAR = 20;
export const TIMEOUT_PAGE_LOAD = 40;
export const TIMEOUT_TEST_STATE_SATISFY = 10;
export const TIMEOUT_DESTROY_UNEXPECTED_ALERT = TIMEOUT_ELEMENT_APPEAR + 10;
