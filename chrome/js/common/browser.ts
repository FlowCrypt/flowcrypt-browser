/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import * as DOMPurify from 'dompurify';
import { Catch, UnreportableError, Env, Str, Value, Attachment } from './common';
import { BrowserMsg } from './extension';
import { Store } from './storage';
import { Api } from './api';
import * as t from '../../types/common';
import { Pgp } from './pgp';
import { mnemonic } from './mnemonic';
import { Attach } from './attach';

declare const openpgp: typeof OpenPGP;

export class Ui {

  public static EVENT_DOUBLE_MS = 1000;
  public static EVENT_SPREE_MS = 50;
  public static EVENT_SLOW_SPREE_MS = 200;
  public static EVENT_VERY_SLOW_SPREE_MS = 500;

  public static retry_link = (caption:string='retry') => `<a href="${Xss.html_escape(window.location.href)}">${Xss.html_escape(caption)}</a>`;

  public static delay = (ms: number) => new Promise(resolve => Catch.set_timeout(resolve, ms));

  public static spinner = (color: string, placeholder_class:"small_spinner"|"large_spinner"='small_spinner') => {
    let path = `/img/svgs/spinner-${color}-small.svg`;
    let url = typeof chrome !== 'undefined' && chrome.extension && chrome.extension.getURL ? chrome.extension.getURL(path) : path;
    return `<i class="${placeholder_class}" data-test="spinner"><img src="${url}" /></i>`;
  }

  public static render_overlay_prompt_await_user_choice = (buttons: t.Dict<{title?: string, color?: string}>, prompt: string): Promise<string> => {
    return new Promise(resolve => {
      let btns = Object.keys(buttons).map(id => `<div class="button ${Xss.html_escape(buttons[id].color || 'green')} overlay_action_${Xss.html_escape(id)}">${Xss.html_escape(buttons[id].title || id.replace(/_/g, ' '))}</div>`).join('&nbsp;'.repeat(5));
      Xss.sanitize_append('body', `
        <div class="featherlight white prompt_overlay" style="display: block;">
          <div class="featherlight-content" data-test="dialog">
            <div class="line">${prompt.replace(/\n/g, '<br>')}</div>
            <div class="line">${btns}</div>
            <div class="line">&nbsp;</div>
            <div class="line">Email human@flowcrypt.com if you need assistance.</div>
          </div>
        </div>
      `);
      let overlay = $('.prompt_overlay');
      for(let id of Object.keys(buttons)) {
        overlay.find(`.overlay_action_${id}`).one('click', () => {
          overlay.remove();
          resolve(id);
        });
      }
    });
  }

  public static abort_and_render_error_on_unprotected_key = async (account_email?: string, tab_id?: string) => {
    if(account_email) {
      let [primary_ki] = await Store.keys_get(account_email, ['primary']);
      let {setup_done, setup_simple} = await Store.get_account(account_email, ['setup_simple', 'setup_done']);
      if(setup_done && setup_simple && primary_ki && openpgp.key.readArmored(primary_ki.private).keys[0].isDecrypted()) {
        if(window.location.pathname === '/chrome/settings/index.htm') {
          // @ts-ignore - this lets it compile in content script that is missing Settings
          Settings.render_sub_page(account_email, tab_id!, '/chrome/settings/modules/change_passphrase.htm');
        } else {
          let msg = `Protect your key with a pass phrase to finish setup.`;
          let r = await Ui.render_overlay_prompt_await_user_choice({finish_setup: {}, later: {color: 'gray'}}, msg);
          if(r === 'finish_setup') {
            BrowserMsg.send(null, 'settings', {account_email});
          }
        }
      }
    }
  }

  public static abort_and_render_error_on_url_param_type_mismatch = (values: t.UrlParams, name: string, expected_type: string): t.UrlParam => {
    let actual_type = typeof values[name];
    if (actual_type !== expected_type) {
      let msg = `Cannot render page (expected ${Xss.html_escape(name)} to be of type ${Xss.html_escape(expected_type)} but got ${Xss.html_escape(actual_type)})<br><br>Was the URL editted manually? Please write human@flowcrypt.com for help.`;
      Xss.sanitize_render('body', msg).addClass('bad').css({padding: '20px', 'font-size': '16px'});
      throw new UnreportableError(msg);
    }
    return values[name];
  }

  public static abort_and_render_error_on_url_param_value_mismatch = <T>(values: t.Dict<T>, name: string, expected_values: T[]): T => {
    if (expected_values.indexOf(values[name]) === -1) {
      let msg = `Cannot render page (expected ${Xss.html_escape(name)} to be one of ${Xss.html_escape(expected_values.map(String).join(','))} but got ${Xss.html_escape(String(values[name]))}<br><br>Was the URL editted manually? Please write human@flowcrypt.com for help.`;
      Xss.sanitize_render('body', msg).addClass('bad').css({padding: '20px', 'font-size': '16px'});
      throw new UnreportableError(msg);
    }
    return values[name];
  }

  public static passphrase_toggle = async (pass_phrase_input_ids: string[], force_initial_show_or_hide:"show"|"hide"|null=null) => {
    let button_hide = '<img src="/img/svgs/eyeclosed-icon.svg" class="eye-closed"><br>hide';
    let button_show = '<img src="/img/svgs/eyeopen-icon.svg" class="eye-open"><br>show';
    let {hide_pass_phrases} = await Store.get_global(['hide_pass_phrases']);
    let show: boolean;
    if (force_initial_show_or_hide === 'hide') {
      show = false;
    } else if (force_initial_show_or_hide === 'show') {
      show = true;
    } else {
      show = !hide_pass_phrases;
    }
    for (let id of pass_phrase_input_ids) {
      let passphrase_input = $('#' + id);
      passphrase_input.addClass('toggled_passphrase');
      if (show) {
        passphrase_input.after('<label href="#" id="toggle_' + id + '" class="toggle_show_hide_pass_phrase" for="' + id + '">' + button_hide + '</label>');
        passphrase_input.attr('type', 'text');
      } else {
        passphrase_input.after('<label href="#" id="toggle_' + id + '" class="toggle_show_hide_pass_phrase" for="' + id + '">' + button_show + '</label>');
        passphrase_input.attr('type', 'password');
      }
      $('#toggle_' + id).click(Ui.event.handle(target => {
        if (passphrase_input.attr('type') === 'password') {
          $('#' + id).attr('type', 'text');
          Xss.sanitize_render(target, button_hide);
          Store.set(null, { hide_pass_phrases: false }).catch(Catch.rejection);
        } else {
          $('#' + id).attr('type', 'password');
          Xss.sanitize_render(target, button_show);
          Store.set(null, { hide_pass_phrases: true }).catch(Catch.rejection);
        }
      }));
    }
  }

  public static enter = (callback: () => void) => (e: JQuery.Event<HTMLElement, null>) => { // returns a function
    if (e.which === Env.key_codes().enter) {
      callback();
    }
  }

  public static build_jquery_selectors = (selectors: t.Dict<string>): t.SelectorCache => {
    let cache: t.NamedSelectors = {};
    return {
      cached: (name: string) => {
        if (!cache[name]) {
          if (typeof selectors[name] === 'undefined') {
            Catch.report('unknown selector name: ' + name);
          }
          cache[name] = $(selectors[name]);
        }
        return cache[name];
      },
      now: (name: string) => {
        if (typeof selectors[name] === 'undefined') {
          Catch.report('unknown selector name: ' + name);
        }
        return $(selectors[name]);
      },
      selector: (name: string) => {
        if (typeof selectors[name] === 'undefined') {
          Catch.report('unknown selector name: ' + name);
        }
        return selectors[name];
      }
    };
  }

  public static scroll = (selector: string|JQuery<HTMLElement>, repeat:number[]=[]) => {
    let el = $(selector as string).first()[0]; // as string due to JQuery TS quirk
    if (el) {
      el.scrollIntoView();
      for (let delay of repeat) { // useful if mobile keyboard is about to show up
        Catch.set_timeout(() => el.scrollIntoView(), delay);
      }
    }
  }

  public static event = {
    clicked: (selector: string): Promise<HTMLElement> => new Promise(resolve => $(selector).one('click', function() { resolve(this); })),
    stop: () => (e: JQuery.Event) => { // returns a function
      e.preventDefault();
      e.stopPropagation();
      return false;
    },
    protect: () => {
      // prevent events that could potentially leak information about sensitive info from bubbling above the frame
      $('body').on('keyup keypress keydown click drag drop dragover dragleave dragend submit', e => {
        // don't ask me how come Chrome allows it to bubble cross-domain
        // should be used in embedded frames where the parent cannot be trusted (eg parent is webmail)
        // should be further combined with iframe type=content + sandboxing, but these could potentially be changed by the parent frame
        // so this indeed seems like the only defense
        // happened on only one machine, but could potentially happen to other users as well
        // if you know more than I do about the hows and whys of events bubbling out of iframes on different domains, let me know
        e.stopPropagation();
      });
    },
    handle: (cb: (e: HTMLElement, event: JQuery.Event<HTMLElement, null>) => void|Promise<void>, err_handler?: t.BrowserEventErrorHandler) => {
      return function(event: JQuery.Event<HTMLElement, null>) {
        let r;
        try {
          r = cb(this, event);
          if(typeof r === 'object' && typeof r.catch === 'function') {
            r.catch(e => Ui.event.__dispatch_err(e, err_handler));
          }
        } catch(e) {
          Ui.event.__dispatch_err(e, err_handler);
        }
      };
    },
    __dispatch_err: (e: any, err_handler?: t.BrowserEventErrorHandler) => {
      if(Api.error.is_network_error(e) && err_handler && err_handler.network) {
        err_handler.network();
      } else if (Api.error.is_auth_error(e) && err_handler && err_handler.auth) {
        err_handler.auth();
      } else if (Api.error.is_auth_popup_needed(e) && err_handler && err_handler.auth_popup) {
        err_handler.auth_popup();
      } else if (err_handler && err_handler.other) {
        err_handler.other(e);
      } else {
        Catch.handle_exception(e);
      }
    },
    prevent: (preventable_event: t.PreventableEventName, cb: (e: HTMLElement, reset_timer: () => void) => void|Promise<void>, err_handler?: t.BrowserEventErrorHandler) => {
      let event_timer: number|undefined;
      let event_fired_on: number|undefined;
      let cb_reset_timer = () => {
        event_timer = undefined;
        event_fired_on = undefined;
      };
      let cb_with_errors_handled = (e: HTMLElement) => {
        let r;
        try {
          r = cb(e, cb_reset_timer);
          if(typeof r === 'object' && typeof r.catch === 'function') {
            r.catch(e => Ui.event.__dispatch_err(e, err_handler));
          }
        } catch(e) {
          Ui.event.__dispatch_err(e, err_handler);
        }
      };
      return function() {
        if (preventable_event === 'spree') {
          clearTimeout(event_timer);
          event_timer = Catch.set_timeout(() => cb_with_errors_handled(this), Ui.EVENT_SPREE_MS);
        } else if (preventable_event === 'slowspree') {
          clearTimeout(event_timer);
          event_timer = Catch.set_timeout(() => cb_with_errors_handled(this), Ui.EVENT_SLOW_SPREE_MS);
        } else if (preventable_event === 'veryslowspree') {
          clearTimeout(event_timer);
          event_timer = Catch.set_timeout(() => cb_with_errors_handled(this), Ui.EVENT_VERY_SLOW_SPREE_MS);
        } else {
          if (event_fired_on) {
            if (preventable_event === 'parallel') {
              // event handling is still being processed. Do not call back
            } else if (preventable_event === 'double') {
              if (Date.now() - event_fired_on > Ui.EVENT_DOUBLE_MS) {
                event_fired_on = Date.now();
                cb_with_errors_handled(this);
              }
            }
          } else {
            event_fired_on = Date.now();
            cb_with_errors_handled(this);
          }
        }
      };
    }
  };

  /**
   * XSS WARNING
   *
   * Return values are inserted directly into DOM. Results must be html escaped.
   *
   * When edited, REQUEST A SECOND SET OF EYES TO REVIEW CHANGES
   */
  public static renderable_message_block = (factory: XssSafeFactory, block: t.MessageBlock, message_id:string|null=null, sender_email:string|null=null, is_outgoing: boolean|null=null) => {
    if (block.type === 'text' || block.type === 'private_key') {
      return Xss.html_escape(block.content).replace(/\n/g, '<br>') + '<br><br>';
    } else if (block.type === 'message') {
      return factory.embedded_message(block.complete ? Pgp.armor.normalize(block.content, 'message') : '', message_id, is_outgoing, sender_email, false);
    } else if (block.type === 'signed_message') {
      return factory.embedded_message(block.content, message_id, is_outgoing, sender_email, false);
    } else if (block.type === 'public_key') {
      return factory.embedded_pubkey(Pgp.armor.normalize(block.content, 'public_key'), is_outgoing);
    } else if (block.type === 'password_message') {
      return factory.embedded_message('', message_id, is_outgoing, sender_email, true, null, block.content); // here block.content is message short id
    } else if (block.type === 'attest_packet') {
      return factory.embedded_attest(block.content);
    } else if (block.type === 'cryptup_verification') {
      return factory.embedded_verification(block.content);
    } else {
      Catch.report('dunno how to process block type: ' + block.type);
      return '';
    }
  }

  public static time = {
    wait: (until_this_function_evaluates_true: () => boolean|undefined) => new Promise((success, error) => {
      let interval = Catch.set_interval(() => {
        let result = until_this_function_evaluates_true();
        if (result === true) {
          clearInterval(interval);
          if (success) {
            success();
          }
        } else if (result === false) {
          clearInterval(interval);
          if (error) {
            error();
          }
        }
      }, 50);
    }),
    sleep: (ms: number, set_timeout: (code: () => void, t: number) => void = Catch.set_timeout) => new Promise(resolve => set_timeout(resolve, ms)),
  };

  public static e = (name: string, attrs: t.Dict<string>) => $(`<${name}/>`, attrs)[0].outerHTML; // xss-tested: jquery escapes attributes

}

export class Xss {

  private static ALLOWED_HTML_TAGS = ['p', 'div', 'br', 'u', 'i', 'em', 'b', 'ol', 'ul', 'pre', 'li', 'table', 'tr', 'td', 'th', 'img', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'address', 'blockquote', 'dl', 'fieldset', 'a', 'font'];
  private static ADD_ATTR = ['email', 'page', 'addurltext', 'longid', 'index'];
  private static HREF_REGEX_CACHE = null as null|RegExp;

  public static sanitize_render = (selector: string|HTMLElement|JQuery<HTMLElement>, dirty_html: string) => $(selector as any).html(Xss.html_sanitize(dirty_html)); // xss-sanitized

  public static sanitize_append = (selector: string|HTMLElement|JQuery<HTMLElement>, dirty_html: string) => $(selector as any).append(Xss.html_sanitize(dirty_html)); // xss-sanitized

  public static sanitize_prepend = (selector: string|HTMLElement|JQuery<HTMLElement>, dirty_html: string) => $(selector as any).prepend(Xss.html_sanitize(dirty_html)); // xss-sanitized

  public static sanitize_replace = (selector: string|HTMLElement|JQuery<HTMLElement>, dirty_html: string) => $(selector as any).replaceWith(Xss.html_sanitize(dirty_html)); // xss-sanitized

  public static html_sanitize = (dirty_html: string): string => { // originaly text_or_html
    return DOMPurify.sanitize(dirty_html, {
      SAFE_FOR_JQUERY: true,
      ADD_ATTR: Xss.ADD_ATTR,
      ALLOWED_URI_REGEXP: Xss.sanitize_href_regexp(),
    });
  }

  public static html_sanitize_keep_basic_tags = (dirty_html: string): string => {
    // used whenever untrusted remote content (eg html email) is rendered, but we still want to preserve html
    DOMPurify.removeAllHooks();
    DOMPurify.addHook('afterSanitizeAttributes', node => {
      if ('src' in node) {
        // replace images with a link that points to that image
        let img: Element = node;
        let src = img.getAttribute('src')!;
        let title = img.getAttribute('title');
        img.removeAttribute('src');
        let a = document.createElement('a');
        a.href = src;
        a.className = 'image_src_link';
        a.target = '_blank';
        a.innerText = title || 'show image';
        let heightWidth = `height: ${img.clientHeight ? `${Number(img.clientHeight)}px` : 'auto'}; width: ${img.clientWidth ? `${Number(img.clientWidth)}px` : 'auto'};`;
        a.setAttribute('style', `text-decoration: none; background: #FAFAFA; padding: 4px; border: 1px dotted #CACACA; display: inline-block; ${heightWidth}`);
        img.outerHTML = a.outerHTML; // xss-safe-value - "a" was build using dom node api
      }
      if ('target' in node) { // open links in new window
        (node as Element).setAttribute('target', '_blank');
      }
    });
    let clean_html = DOMPurify.sanitize(dirty_html, {
      SAFE_FOR_JQUERY: true,
      ADD_ATTR: Xss.ADD_ATTR,
      ALLOWED_TAGS: Xss.ALLOWED_HTML_TAGS,
      ALLOWED_URI_REGEXP: Xss.sanitize_href_regexp(),
    });
    DOMPurify.removeAllHooks();
    return clean_html;
  }

  public static html_sanitize_and_strip_all_tags = (dirty_html: string, output_newline: string): string => {
    let html = Xss.html_sanitize_keep_basic_tags(dirty_html);
    let random = Str.random(5);
    let br = `CU_BR_${random}`;
    let block_start = `CU_BS_${random}`;
    let block_end = `CU_BE_${random}`;
    html = html.replace(/<br[^>]*>/gi, br);
    html = html.replace(/\n/g, '');
    html = html.replace(/<\/(p|h1|h2|h3|h4|h5|h6|ol|ul|pre|address|blockquote|dl|div|fieldset|form|hr|table)[^>]*>/gi, block_end);
    html = html.replace(/<(p|h1|h2|h3|h4|h5|h6|ol|ul|pre|address|blockquote|dl|div|fieldset|form|hr|table)[^>]*>/gi, block_start);
    html = html.replace(RegExp(`(${block_start})+`, 'g'), block_start).replace(RegExp(`(${block_end})+`, 'g'), block_end);
    html = html.split(block_end + block_start).join(br).split(br + block_end).join(br);
    let text = html.split(br).join('\n').split(block_start).filter(v => !!v).join('\n').split(block_end).filter(v => !!v).join('\n');
    text = text.replace(/\n{2,}/g, '\n\n');
    // not all tags were removed above. Remove all remaining tags
    text = DOMPurify.sanitize(text, {SAFE_FOR_JQUERY: true, ALLOWED_TAGS: []});
    text = text.trim();
    if(output_newline !== '\n') {
      text = text.replace(/\n/g, output_newline);
    }
    return text;
  }

  public static html_escape = (str: string) => str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\//g, '&#x2F;');

  public static html_unescape = (str: string) => {
    // the &nbsp; at the end is replaced with an actual NBSP character, not a space character. IDE won't show you the difference. Do not change.
    return str.replace(/&#x2F;/g, '/').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ');
  }

  private static sanitize_href_regexp = () => { // allow href links that have same origin as our extension + cid
    if(Xss.HREF_REGEX_CACHE === null) {
      if (window && window.location && window.location.origin && window.location.origin.match(/^(?:chrome-extension|moz-extension):\/\/[a-z0-9\-]+$/g)) {
        Xss.HREF_REGEX_CACHE = new RegExp(`^(?:(http|https|cid):|${Str.regex_escape(window.location.origin)}|[^a-z]|[a-z+.\\-]+(?:[^a-z+.\\-:]|$))`, 'i');
      } else {
        Xss.HREF_REGEX_CACHE = /^(?:(http|https):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i;
      }
    }
    return Xss.HREF_REGEX_CACHE;
  }

}

export class XssSafeFactory {

  /**
   * XSS WARNING
   *
   * Method return values are inserted directly into DOM.
   *
   * All public methods are expected to escape unknown content to prevent XSS.
   *
   * If you add or edit a method, REQUEST A SECOND SET OF EYES TO REVIEW CHANGES
   */

  private set_params: t.UrlParams;
  private reloadable_class: string;
  private destroyable_class: string;
  private hide_gmail_new_message_in_thread_notification = '<style>.ata-asE { display: none !important; visibility: hidden !important; }</style>';

  constructor(account_email: string, parent_tab_id: string, reloadable_class:string='', destroyable_class:string='', set_params:t.UrlParams={}) {
    this.reloadable_class = Xss.html_escape(reloadable_class);
    this.destroyable_class = Xss.html_escape(destroyable_class);
    this.set_params = set_params;
    this.set_params.account_email = account_email;
    this.set_params.parent_tab_id = parent_tab_id;
  }

  src_img = (relative_path: string) => this.ext_url(`img/${relative_path}`);

  private frame_src = (path: string, params:t.UrlParams={}) => {
    for (let k of Object.keys(this.set_params)) {
      params[k] = this.set_params[k];
    }
    return Env.url_create(path, params);
  }

  src_compose_message = (draft_id?: string) => {
    return this.frame_src(this.ext_url('chrome/elements/compose.htm'), { is_reply_box: false, draft_id, placement: 'gmail' });
  }

  src_passphrase_dialog = (longids:string[]=[], type: t.PassphraseDialogType) => {
    return this.frame_src(this.ext_url('chrome/elements/passphrase.htm'), { type, longids });
  }

  src_subscribe_dialog = (verification_email_text: string|null, placement: t.Placement, source: string|null, subscribe_result_tab_id:string|null=null) => {
    return this.frame_src(this.ext_url('chrome/elements/subscribe.htm'), { verification_email_text, placement, source, subscribe_result_tab_id });
  }

  src_verification_dialog = (verification_email_text: string) => {
    return this.frame_src(this.ext_url('chrome/elements/verification.htm'), { verification_email_text });
  }

  src_attest = (attest_packet: string) => {
    return this.frame_src(this.ext_url('chrome/elements/attest.htm'), { attest_packet, });
  }

  src_add_pubkey_dialog = (emails: string[], placement: t.Placement) => {
    return this.frame_src(this.ext_url('chrome/elements/add_pubkey.htm'), { emails, placement });
  }

  src_add_footer_dialog = (placement: t.Placement) => {
    return this.frame_src(this.ext_url('chrome/elements/shared/footer.htm'), { placement });
  }

  src_sending_address_dialog = (placement: t.Placement) => {
    return this.frame_src(this.ext_url('chrome/elements/sending_address.htm'), { placement });
  }

  src_pgp_attachment_iframe = (a: Attachment) => {
    if(!a.id && !a.url && a.has_data()) { // data provided directly, pass as object url
      a.url = Attachment.methods.object_url_create(a.as_bytes());
    }
    return this.frame_src(this.ext_url('chrome/elements/attachment.htm'), {frame_id: this.new_id(), message_id: a.message_id, name: a.name, type: a.type, size: a.length, attachment_id: a.id, url: a.url });
  }

  src_pgp_block_iframe = (message: string, message_id: string|null, is_outgoing: boolean|null, sender_email: string|null, has_password: boolean, signature: string|null|boolean, short: string|null) => {
    return this.frame_src(this.ext_url('chrome/elements/pgp_block.htm'), { frame_id: this.new_id(), message, has_password, message_id, sender_email, is_outgoing, signature, short });
  }

  src_pgp_pubkey_iframe = (armored_pubkey: string, is_outgoing: boolean|null) => {
    return this.frame_src(this.ext_url('chrome/elements/pgp_pubkey.htm'), { frame_id: this.new_id(), armored_pubkey, minimized: Boolean(is_outgoing), });
  }

  src_reply_message_iframe = (conversation_params: t.UrlParams, skip_click_prompt: boolean, ignore_draft: boolean) => {
    let params: t.UrlParams = {
      is_reply_box: true,
      frame_id: 'frame_' + Str.random(10),
      placement: 'gmail',
      thread_id: conversation_params.thread_id,
      skip_click_prompt: Boolean(skip_click_prompt),
      ignore_draft: Boolean(ignore_draft),
      thread_message_id: conversation_params.thread_message_id,
    };
    if (conversation_params.reply_to) { // for gmail and inbox. Outlook gets this from API
      let headers = this.resolve_from_to(conversation_params.addresses as string[], conversation_params.my_email as string, conversation_params.reply_to as string[]);
      params.to = headers.to;
      params.from = headers.from;
      params.subject = 'Re: ' + conversation_params.subject;
    }
    return this.frame_src(this.ext_url('chrome/elements/compose.htm'), params);
  }

  src_stripe_checkout = () => {
    return this.frame_src('https://flowcrypt.com/stripe.htm', {});
  }

  meta_notification_container = () => {
    return `<div class="${this.destroyable_class} webmail_notifications" style="text-align: center;"></div>`;
  }

  meta_stylesheet = (file: string) => {
    return `<link class="${this.destroyable_class}" rel="stylesheet" href="${this.ext_url(`css/${file}.css`)}" />`;
  }

  dialog_passphrase = (longids: string[], type: t.PassphraseDialogType) => {
    return this.div_dialog_DANGEROUS(this.iframe(this.src_passphrase_dialog(longids, type), ['medium'], {scrolling: 'no'}), 'dialog-passphrase'); // xss-safe-factory
  }

  dialog_subscribe = (verif_em_txt: string|null, source: string|null, sub_res_tab_id: string|null) => {
    return this.div_dialog_DANGEROUS(this.iframe(this.src_subscribe_dialog(verif_em_txt, 'dialog', source, sub_res_tab_id), ['mediumtall'], {scrolling: 'no'}), 'dialog-subscribe'); // xss-safe-factory
  }

  dialog_add_pubkey = (emails: string[]) => {
    return this.div_dialog_DANGEROUS(this.iframe(this.src_add_pubkey_dialog(emails, 'gmail'), ['tall'], {scrolling: 'no'}), 'dialog-add-pubkey'); // xss-safe-factory
  }

  embedded_compose = (draft_id?: string) => {
    return Ui.e('div', {id: 'new_message', class: 'new_message', 'data-test': 'container-new-message', html: this.iframe(this.src_compose_message(draft_id), [], {scrolling: 'no'})});
  }

  embedded_subscribe = (verif_email_text: string, source: string) => {
    return this.iframe(this.src_subscribe_dialog(verif_email_text, 'embedded', source), ['short', 'embedded'], {scrolling: 'no'});
  }

  embedded_verification = (verif_email_text: string) => {
    return this.iframe(this.src_verification_dialog(verif_email_text), ['short', 'embedded'], {scrolling: 'no'});
  }

  embedded_attachment = (meta: Attachment) => {
    return Ui.e('span', {class: 'pgp_attachment', html: this.iframe(this.src_pgp_attachment_iframe(meta))});
  }

  embedded_message = (armored: string, message_id: string|null, is_outgoing: boolean|null, sender: string|null, has_password: boolean, signature:string|null|boolean=null, short:string|null=null) => {
    return this.iframe(this.src_pgp_block_iframe(armored, message_id, is_outgoing, sender, has_password, signature, short), ['pgp_block']) + this.hide_gmail_new_message_in_thread_notification;
  }

  embedded_pubkey = (armored_pubkey: string, is_outgoing: boolean|null) => {
    return this.iframe(this.src_pgp_pubkey_iframe(armored_pubkey, is_outgoing), ['pgp_block']);
  }

  embedded_reply = (conversation_params: t.UrlParams, skip_click_prompt: boolean, ignore_draft:boolean=false) => {
    return this.iframe(this.src_reply_message_iframe(conversation_params, skip_click_prompt, ignore_draft), ['reply_message']);
  }

  embedded_passphrase = (longids: string[]) => {
    return this.div_dialog_DANGEROUS(this.iframe(this.src_passphrase_dialog(longids, 'embedded'), ['medium'], {scrolling: 'no'}), 'embedded-passphrase'); // xss-safe-factory
  }

  embedded_attachment_status = (content: string) => {
    return Ui.e('div', {class: 'attachment_loader', html: Xss.html_sanitize(content)});
  }

  embedded_attest = (attest_packet: string) => {
    return this.iframe(this.src_attest(attest_packet), ['short', 'embedded'], {scrolling: 'no'});
  }

  embedded_stripe_checkout = () => {
    return this.iframe(this.src_stripe_checkout(), [], {sandbox: 'allow-forms allow-scripts allow-same-origin'});
  }

  button_compose = (webmail_name: t.WebMailName) => {
    if (webmail_name === 'inbox') {
      return `<div class="S ${this.destroyable_class}"><div class="new_message_button y pN oX" tabindex="0" data-test="action-secure-compose"><img src="${this.src_img('logo/logo.svg')}"/></div><label class="bT qV" id="cryptup_compose_button_label"><div class="tv">Secure Compose</div></label></div>`;
    } else if (webmail_name === 'outlook') {
      return `<div class="_fce_c ${this.destroyable_class} cryptup_compose_button_container" role="presentation"><div class="new_message_button" title="New Secure Email"><img src="${this.src_img('logo-19-19.png')}"></div></div>`;
    } else {
      return `<div class="${this.destroyable_class} z0"><div class="new_message_button T-I J-J5-Ji T-I-KE L3" id="flowcrypt_new_message_button" role="button" tabindex="0" data-test="action-secure-compose">Secure Compose</div></div>`;
    }
  }

  button_reply = () => {
    return `<div class="${this.destroyable_class} reply_message_button"><img src="${this.src_img('svgs/reply-icon.svg')}" /></div>`;
  }

  button_without_cryptup = () => {
    return `<span class="hk J-J5-Ji cryptup_convo_button show_original_conversation ${this.destroyable_class}" data-tooltip="Show conversation without FlowCrypt"><span>see original</span></span>`;
  }

  button_with_cryptup = () => {
    return `<span class="hk J-J5-Ji cryptup_convo_button use_secure_reply ${this.destroyable_class}" data-tooltip="Use Secure Reply"><span>secure reply</span></span>`;
  }

  button_recipients_use_encryption = (webmail_name: t.WebMailName) => {
    if (webmail_name !== 'gmail') {
      Catch.report('switch_to_secure not implemented for ' + webmail_name);
      return '';
    } else {
      return '<div class="aoD az6 recipients_use_encryption">Your recipients seem to have encryption set up! <a href="#">Secure Compose</a></div>';
    }
  }

  private ext_url = (s: string) => chrome.extension.getURL(s);

  private new_id = () => `frame_${Str.random(10)}`;

  private resolve_from_to = (secondary_emails: string[], my_email: string, their_emails: string[]) => { // when replaying to email I've sent myself, make sure to send it to the other person, and not myself
    if (their_emails.length === 1 && Value.is(their_emails[0]).in(secondary_emails)) {
      return { from: their_emails[0], to: my_email }; // replying to myself, reverse the values to actually write to them
    }
    return { to: their_emails, from: my_email };
  }

  private iframe = (src: string, classes:string[]=[], element_attrs:t.UrlParams={}) => {
    let id = Env.url_params(['frame_id'], src).frame_id as string;
    let class_attr = (classes || []).concat(this.reloadable_class).join(' ');
    let attributes: t.Dict<string> = {id, class: class_attr, src};
    for (let name of Object.keys(element_attrs)) {
      attributes[name] = String(element_attrs[name]);
    }
    return Ui.e('iframe', attributes);
  }

  private div_dialog_DANGEROUS = (content_MUST_BE_XSS_SAFE: string, data_test: string) => { // xss-dangerous-function
    return Ui.e('div', { id: 'cryptup_dialog', html: content_MUST_BE_XSS_SAFE, 'data-test': data_test });
  }

}

export class KeyCanBeFixed extends Error {
  encrypted: OpenPGP.key.Key;
}

export class UserAlert extends Error {}

export class KeyImportUI {

  private expected_longid: string|null;
  private reject_known: boolean;
  private check_encryption: boolean;
  private check_signing: boolean;
  public on_bad_passphrase: VoidCallback = () => undefined;

  constructor(o: {expect_longid?: string, reject_known?: boolean, check_encryption?: boolean, check_signing?: boolean}) {
    this.expected_longid = o.expect_longid || null;
    this.reject_known = o.reject_known === true;
    this.check_encryption = o.check_encryption === true;
    this.check_signing = o.check_signing === true;
  }

  public init_prv_import_source_form = (account_email: string, parent_tab_id: string|null) => {
    $('input[type=radio][name=source]').off().change(function() {
      if ((this as HTMLInputElement).value === 'file') {
        $('.input_private_key').val('').change().prop('disabled', true);
        $('.source_paste_container').css('display', 'none');
        $('.source_paste_container .pass_phrase_needed').hide();
        $('#fineuploader_button > input').click();
      } else if ((this as HTMLInputElement).value === 'paste') {
        $('.input_private_key').val('').change().prop('disabled', false);
        $('.source_paste_container').css('display', 'block');
        $('.source_paste_container .pass_phrase_needed').hide();
      } else if ((this as HTMLInputElement).value === 'backup') {
        window.location.href = Env.url_create('/chrome/settings/setup.htm', {account_email, parent_tab_id, action: 'add_key'});
      }
    });
    $('.line.pass_phrase_needed .action_use_random_pass_phrase').click(Ui.event.handle(target => {
      $('.source_paste_container .input_passphrase').val(Pgp.password.random());
      $('.input_passphrase').attr('type', 'text');
      $('#e_rememberPassphrase').prop('checked', true);
    }));
    $('.input_private_key').change(Ui.event.handle(target => {
      let k = openpgp.key.readArmored($(target).val() as string).keys[0];
      $('.input_passphrase').val('');
      if(k && k.isPrivate() && k.isDecrypted()) {
        $('.line.pass_phrase_needed').show();
      } else {
        $('.line.pass_phrase_needed').hide();
      }
    }));
    let attach = new Attach(() => ({count: 100, size: 1024 * 1024, size_mb: 1}));
    attach.initialize_attach_dialog('fineuploader', 'fineuploader_button');
    attach.set_attachment_added_callback(file => {
      let k;
      if (Value.is(Pgp.armor.headers('private_key').begin).in(file.as_text())) {
        let first_prv = Pgp.armor.detect_blocks(file.as_text()).blocks.filter(b => b.type === 'private_key')[0];
        if (first_prv) {
          k = openpgp.key.readArmored(first_prv.content).keys[0];  // filter out all content except for the first encountered private key (GPGKeychain compatibility)
        }
      } else {
        k = openpgp.key.read(file.as_bytes()).keys[0];
      }
      if (typeof k !== 'undefined') {
        $('.input_private_key').val(k.armor()).change().prop('disabled', true);
        $('.source_paste_container').css('display', 'block');
      } else {
        $('.input_private_key').val('').change().prop('disabled', false);
        alert('Not able to read this key. Is it a valid PGP private key?');
        $('input[type=radio][name=source]').removeAttr('checked');
      }
    });
  }

  check_prv = async (account_email: string, armored: string, passphrase: string): Promise<t.KeyImportUiCheckResult> => {
    let normalized = this.normalize('private_key', armored);
    let decrypted = this.read('private_key', normalized);
    let encrypted = this.read('private_key', normalized);
    let longid = this.longid(decrypted);
    this.reject_if_not('private_key', decrypted);
    await this.reject_known_if_selected(account_email, decrypted);
    this.reject_if_different_from_selected_longid(longid);
    await this.decrypt_and_encrypt_as_needed(decrypted, encrypted, passphrase);
    await this.check_encryption_prv_if_selected(decrypted, encrypted);
    await this.check_signing_if_selected(decrypted);
    return {normalized, longid, passphrase, fingerprint: Pgp.key.fingerprint(decrypted)!, decrypted, encrypted}; // will have fp if had longid
  }

  check_pub = async (armored: string): Promise<string> => {
    let normalized = this.normalize('public_key', armored);
    let parsed = this.read('public_key', normalized);
    let longid = this.longid(parsed);
    await this.check_encryption_pub_if_selected(normalized);
    return normalized;
  }

  private normalize = (type: t.KeyBlockType, armored: string) => {
    let headers = Pgp.armor.headers(type);
    let normalized = Pgp.key.normalize(armored);
    if (!normalized) {
      throw new UserAlert('There was an error processing this key, possibly due to bad formatting.\nPlease insert complete key, including "' + headers.begin + '" and "' + headers.end + '"');
    }
    return normalized;
  }

  private read = (type: t.KeyBlockType, normalized: string) => {
    let headers = Pgp.armor.headers(type);
    let k = openpgp.key.readArmored(normalized).keys[0];
    if (typeof k === 'undefined') {
      throw new UserAlert('Private key is not correctly formated. Please insert complete key, including "' + headers.begin + '" and "' + headers.end + '"');
    }
    return k;
  }

  private longid = (k: OpenPGP.key.Key) => {
    let longid = Pgp.key.longid(k);
    if (!longid) {
      throw new UserAlert('This key may not be compatible. Email human@flowcrypt.com and let us know which software created this key, so we can get it resolved.\n\n(error: cannot get long_id)');
    }
    return longid;
  }

  private reject_if_not = (type: t.KeyBlockType, k: OpenPGP.key.Key) => {
    let headers = Pgp.armor.headers(type);
    if (type === 'private_key' && k.isPublic()) {
      throw new UserAlert('This was a public key. Please insert a private key instead. It\'s a block of text starting with "' + headers.begin + '"');
    }
    if (type === 'public_key' && !k.isPublic()) {
      throw new UserAlert('This was a public key. Please insert a private key instead. It\'s a block of text starting with "' + headers.begin + '"');
    }
  }

  private reject_known_if_selected = async (account_email: string, k: OpenPGP.key.Key) => {
    if(this.reject_known) {
      let keyinfos = await Store.keys_get(account_email);
      let private_keys_long_ids = keyinfos.map(ki => ki.longid);
      if (Value.is(Pgp.key.longid(k)!).in(private_keys_long_ids)) {
        throw new UserAlert('This is one of your current keys, try another one.');
      }
    }
  }

  private reject_if_different_from_selected_longid = (longid: string) => {
    if(this.expected_longid && longid !== this.expected_longid) {
      throw new UserAlert(`Key does not match. Looking for key with KeyWords ${mnemonic(this.expected_longid)} (${this.expected_longid})`);
    }
  }

  private decrypt_and_encrypt_as_needed = async (to_decrypt: OpenPGP.key.Key, to_encrypt: OpenPGP.key.Key, passphrase: string): Promise<void> => {
    if(!passphrase) {
      throw new UserAlert('Please enter a pass phrase to use with this key');
    }
    let decrypt_result;
    try {
      if(to_encrypt.isDecrypted()) {
        await to_encrypt.encrypt(passphrase);
      }
      if(to_decrypt.isDecrypted()) {
        return;
      }
      decrypt_result = await Pgp.key.decrypt(to_decrypt, [passphrase]);
    } catch (e) {
      throw new UserAlert(`This key is not supported by FlowCrypt yet. Please write at human@flowcrypt.com to add support soon. (decrypt error: ${String(e)})`);
    }
    if (!decrypt_result) {
      this.on_bad_passphrase();
      if(this.expected_longid) {
        throw new UserAlert('This is the right key! However, the pass phrase does not match. Please try a different pass phrase. Your original pass phrase might have been different then what you use now.');
      } else {
        throw new UserAlert('The pass phrase does not match. Please try a different pass phrase.');
      }
    }
  }

  private check_encryption_prv_if_selected = async (k: OpenPGP.key.Key, encrypted: OpenPGP.key.Key) => {
    if(this.check_encryption && await k.getEncryptionKey() === null) {
      if (await k.verifyPrimaryKey() === openpgp.enums.keyStatus.no_self_cert || await Pgp.key.usable_but_expired(k)) { // known issues - key can be fixed
        let e = new KeyCanBeFixed('');
        e.encrypted = encrypted;
        throw e;
      } else {
        throw new UserAlert('This looks like a valid key but it cannot be used for encryption. Please write at human@flowcrypt.com to see why is that.');
      }
    }
  }

  private check_encryption_pub_if_selected = async (normalized: string) => {
    if(this.check_encryption && !await Pgp.key.usable(normalized)) {
      throw new UserAlert('This public key looks correctly formatted, but cannot be used for encryption. Please write at human@flowcrypt.com. We\'ll see if there is a way to fix it.');
    }
  }

  private check_signing_if_selected = async (k: OpenPGP.key.Key) => {
    if(this.check_signing && await k.getSigningKey() === null) {
      throw new UserAlert('This looks like a valid key but it cannot be used for signing. Please write at human@flowcrypt.com to see why is that.');
    }
  }
}
