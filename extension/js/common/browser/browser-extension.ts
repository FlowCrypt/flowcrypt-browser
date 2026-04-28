/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Dict } from '../core/common.js';
import { FlatTypes } from '../platform/store/abstract-store.js';
import { CatchHelper } from '../platform/catch-helper.js';
import { Catch } from '../platform/catch.js';

export class BrowserExtension {
  // todo - move extension-specific common.js code here

  public static prepareBugReport = (name: string, details?: Dict<FlatTypes>, error?: Error | unknown): string => {
    const bugReport: Dict<string> = { name, stack: CatchHelper.stackTrace() };
    try {
      bugReport.error = JSON.stringify(error, undefined, 2);
    } catch (e) {
      bugReport.error_as_string = Catch.stringify(error);
      bugReport.error_serialization_error = Catch.stringify(e);
    }
    try {
      bugReport.details = JSON.stringify(details, undefined, 2);
    } catch (e) {
      bugReport.details_as_string = Catch.stringify(details);
      bugReport.details_serialization_error = Catch.stringify(e);
    }
    let result = '';
    for (const k of Object.keys(bugReport)) {
      result += `\n[${k}]\n${bugReport[k]}\n`;
    }
    return result;
  };
}
