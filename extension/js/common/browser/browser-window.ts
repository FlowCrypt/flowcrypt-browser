/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyThirdPartyLibrary = any;
export type AddrParserResult = { name?: string; address?: string };

/* eslint-disable @typescript-eslint/naming-convention */
export interface BrowserWindow extends Window {
  onunhandledrejection: (e: unknown) => void;
  'emailjs-mime-codec': AnyThirdPartyLibrary;
  'emailjs-mime-parser': AnyThirdPartyLibrary;
  'emailjs-mime-builder': AnyThirdPartyLibrary;
  'emailjs-addressparser': {
    parse: (raw: string) => AddrParserResult[];
  };
}

export interface ContentScriptWindow extends BrowserWindow {
  TrySetDestroyableTimeout: (code: () => void, ms: number) => number;
  TrySetDestroyableInterval: (code: () => void, ms: number) => number;
  injected: true; // background script will use this to test if scripts were already injected, and inject if not
  account_email_global: undefined | string; // used by background script
  same_world_global: true; // used by background_script
  destruction_event: string;
  destroyable_class: string;
  reloadable_class: string;
  destroyable_intervals: number[];
  destroyable_timeouts: number[];
  destroy: () => void;
  vacant: () => boolean;
}
/* eslint-enable @typescript-eslint/naming-convention */
