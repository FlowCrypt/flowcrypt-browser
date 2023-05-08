/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */
'use strict';

import { Api } from './shared/api.js';
import { Dict } from '../core/common.js';
import { BACKEND_API_HOST } from '../core/const.js';
import { Catch } from '../platform/catch.js';
import { Browser } from '../browser/browser.js';

namespace FlowCryptWebsiteRes {
  export type FcBlogPost = { title: string; date: string; url: string };
}

export class FlowCryptWebsite extends Api {
  public static url = (type: 'api' | 'me' | 'pubkey' | 'decrypt' | 'web', resource = '') => {
    return (
      {
        api: BACKEND_API_HOST,
        me: `https://flowcrypt.com/me/${resource}`,
        pubkey: `https://flowcrypt.com/pub/${resource}`,
        web: 'https://flowcrypt.com/',
      } as Dict<string>
    )[type];
  };

  public static retrieveBlogPosts = async (): Promise<FlowCryptWebsiteRes.FcBlogPost[]> => {
    const xml = (await Api.ajax({ url: 'https://flowcrypt.com/blog/feed.xml', dataType: 'xml' }, Catch.stackTrace())) as XMLDocument;
    const posts: FlowCryptWebsiteRes.FcBlogPost[] = [];
    for (const post of Browser.arrFromDomNodeList(xml.querySelectorAll('entry'))) {
      const children = Browser.arrFromDomNodeList(post.childNodes);
      const title = children.find(n => n.nodeName.toLowerCase() === 'title')?.textContent;
      const date = children.find(n => n.nodeName.toLowerCase() === 'published')?.textContent?.substr(0, 10);
      const url = (children.find(n => n.nodeName.toLowerCase() === 'link') as HTMLAnchorElement).getAttribute('href');
      if (title && date && url) {
        posts.push({ title, date, url });
      }
    }
    return posts.slice(0, 5);
  };
}
