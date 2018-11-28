/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Pgp } from '../../js/common/pgp.js';
import { Env } from '../../js/common/browser.js';

(() => {

  const uncheckedUrlParams = Env.urlParams(['f', 'args']);
  const f = String(uncheckedUrlParams.f);
  const args = JSON.parse(String(uncheckedUrlParams.args)) as any[];

  const test = (method: Function, arg: any[]) => { // tslint:disable-line:ban-types
    try {
      return finish(undefined, method.apply(undefined, arg));
    } catch (e) {
      return finish(e);
    }
  };

  const finish = (error: any, result?: any) => {
    error = (typeof error === 'undefined') ? undefined : String(error);
    $('#result').text(JSON.stringify({ error, result }));
    $('#result').attr('data-test-state', 'ready');
  };

  if (f === 'Pgp.armor.detectBlocks' && args.length === 1 && typeof args[0] === 'string') {
    return test(Pgp.armor.detectBlocks, args);
  } else {
    return finish('Unknown unit test f');
  }

})();
