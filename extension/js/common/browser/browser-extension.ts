/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch } from '../platform/catch.js';
import { Dict } from '../core/common.js';
import { FlatTypes } from '../platform/store/abstract-store.js';

export class BrowserExtension { // todo - move extension-specific common.js code here

  public static prepareBugReport = (name: string, details?: Dict<FlatTypes>, error?: Error | any): string => {
    const bugReport: Dict<string> = { name, stack: Catch.stackTrace() };
    try {
      bugReport.error = JSON.stringify(error, undefined, 2);
    } catch (e) {
      bugReport.error_as_string = String(error);
      bugReport.error_serialization_error = String(e);
    }
    try {
      bugReport.details = JSON.stringify(details, undefined, 2);
    } catch (e) {
      bugReport.details_as_string = String(details);
      bugReport.details_serialization_error = String(e);
    }
    let result = '';
    for (const k of Object.keys(bugReport)) {
      result += `\n[${k}]\n${bugReport[k]}\n`;
    }
    return result;
  };

}
