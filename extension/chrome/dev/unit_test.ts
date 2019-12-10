/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Pgp } from '../../js/common/core/pgp.js';
import { Url } from '../../js/common/core/common.js';

(async () => {

  const uncheckedUrlParams = Url.parse(['f', 'args']);
  const f = String(uncheckedUrlParams.f);
  const args = JSON.parse(String(uncheckedUrlParams.args)) as any[];

  const renderRes = (error: any, result?: any) => {
    error = (typeof error === 'undefined') ? undefined : String(error);
    $('#result').text(JSON.stringify({ error, result }));
    $('#result').attr('data-test-state', 'ready');
  };

  const test = async (method: Function, arg: any[]) => { // tslint:disable-line:ban-types
    try {
      return renderRes(undefined, await method.apply(undefined, arg)); // tslint:disable-line:no-unsafe-any
    } catch (e) {
      return renderRes(e);
    }
  };

  if (f === 'Pgp.armor.detectBlocks') {
    return await test(Pgp.armor.detectBlocks, args);
  } else if (f === 'Pgp.hash.sha1') {
    return await test(Pgp.hash.sha1UtfStr, args);
  } else if (f === 'Pgp.hash.sha256') {
    return await test(Pgp.hash.sha256UtfStr, args);
  } else if (f === 'Pgp.hash.doubleSha1Upper') {
    return await test(Pgp.hash.doubleSha1Upper, args);
  } else if (f === 'Pgp.hash.challengeAnswer') {
    return await test(Pgp.hash.challengeAnswer, args);
  } else {
    return renderRes('Unknown unit test f');
  }

})().catch(e => console.error(e));
