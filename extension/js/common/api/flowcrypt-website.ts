/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

// tslint:disable:oneliner-object-literal
// tslint:disable:no-null-keyword

'use strict';

import { Api, ProgressCbs, ReqFmt } from './shared/api.js';
import { Dict } from '../core/common.js';
import { BACKEND_API_HOST } from '../core/const.js';
import { Catch } from '../platform/catch.js';
import { Browser } from '../browser/browser.js';

export namespace FlowCryptWebsiteRes {
  export type FcHelpFeedback = { sent: boolean };
  export type FcBlogPost = { title: string, date: string, url: string };
}

export class FlowCryptWebsite extends Api {

  public static url = (type: 'api' | 'me' | 'pubkey' | 'decrypt' | 'web', resource = '') => {
    return ({
      api: BACKEND_API_HOST,
      me: `https://flowcrypt.com/me/${resource}`,
      pubkey: `https://flowcrypt.com/pub/${resource}`,
      decrypt: `https://flowcrypt.com/${resource}`,
      web: 'https://flowcrypt.com/',
    } as Dict<string>)[type];
  }

  public static helpFeedback = async (acctEmail: string, message: string): Promise<FlowCryptWebsiteRes.FcHelpFeedback> => {
    return await FlowCryptWebsite.request<FlowCryptWebsiteRes.FcHelpFeedback>('help/feedback', {
      email: acctEmail,
      message,
    });
  }

  public static retrieveBlogPosts = async (): Promise<FlowCryptWebsiteRes.FcBlogPost[]> => {
    const xml = await Api.ajax({ url: 'https://flowcrypt.com/blog/feed.xml', dataType: 'xml' }, Catch.stackTrace()) as XMLDocument; // tslint:disable-line:no-direct-ajax
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
  }

  private static request = async <RT>(path: string, vals: Dict<any>, fmt: ReqFmt = 'JSON', addHeaders: Dict<string> = {}, progressCbs?: ProgressCbs): Promise<RT> => {
    return await FlowCryptWebsite.apiCall(FlowCryptWebsite.url('api'), path, vals, fmt, progressCbs, { 'api-version': '3', ...addHeaders });
  }

}
