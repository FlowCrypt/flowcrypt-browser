/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */
'use strict';

import { Api } from './shared/api.js';
import { Catch } from '../platform/catch.js';
import { Browser } from '../browser/browser.js';

namespace FlowCryptWebsiteRes {
  export type FcBlogPost = { title: string; date: string; url: string };
}

export class FlowCryptWebsite extends Api {
  public static pubKeyUrl = (resource: string) => {
    return `https://flowcrypt.com/pub/${resource}`;
  };

  public static retrieveBlogPosts = async (): Promise<FlowCryptWebsiteRes.FcBlogPost[]> => {
    const xmlString = await Api.ajax({ url: 'https://flowcrypt.com/blog/feed.xml', method: 'GET', stack: Catch.stackTrace() }, 'text');
    const xml = $.parseXML(xmlString);
    const posts: FlowCryptWebsiteRes.FcBlogPost[] = [];
    for (const post of Browser.arrFromDomNodeList(xml.querySelectorAll('entry'))) {
      const children = Browser.arrFromDomNodeList(post.childNodes);
      const title = children.find(n => n.nodeName.toLowerCase() === 'title')?.textContent;
      const date = children.find(n => n.nodeName.toLowerCase() === 'published')?.textContent?.substring(0, 10);
      const url = (children.find(n => n.nodeName.toLowerCase() === 'link') as HTMLAnchorElement).getAttribute('href');
      if (title && date && url) {
        posts.push({ title, date, url });
      }
    }
    return posts.slice(0, 5);
  };
}
