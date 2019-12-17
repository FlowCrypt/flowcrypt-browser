/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { UrlParams, Url } from '../../../../js/common/core/common.js';
import { InboxModule } from './inbox_module.js';
import { Xss } from '../../../../js/common/platform/xss.js';

export class InboxHelperModule extends InboxModule {

  redirectToUrl = (params: UrlParams) => {
    const newUrlSearch = Url.create('', params);
    if (newUrlSearch !== window.location.search) {
      window.location.search = newUrlSearch;
    } else {
      window.location.reload();
    }
  }

  displayBlock = (name: string, title: string) => {
    this.view.S.cached('threads').css('display', name === 'thread' ? 'none' : 'block');
    this.view.S.cached('thread').css('display', name === 'thread' ? 'block' : 'none');
    Xss.sanitizeRender('h1', `${title}`);
  }
}
