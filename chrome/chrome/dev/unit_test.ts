/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

(() => {

  let url_params = Env.url_params(['f', 'args']);
  let f = String(url_params.f);
  let args = JSON.parse(String(url_params.args));

  let test = (method: Function, arg: any[]) => { // tslint:disable-line:ban-types
    try {
      return finish(null, method.apply(null, arg));
    } catch (e) {
      return finish(e);
    }
  };

  let finish = (error: string|StandardError|Error|null, result?: any) => {
    error = (error === null) ? null : String(error);
    $('#result').text(JSON.stringify({error, result}));
    $('#result').attr('data-test-state', 'ready');
  };

  if (f === 'tool.crypto.armor.detect_blocks' && args.length === 1 && typeof args[0] === 'string') {
    return test(tool.crypto.armor.detect_blocks, args);
  } else {
    return finish('Unknown unit test f');
  }

})();
