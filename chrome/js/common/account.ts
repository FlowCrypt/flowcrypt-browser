/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypcom */

'use strict';

import { Store, SubscriptionAttempt } from './storage.js';
import { Env, Str, Catch, Dict } from './common.js';

import { Api } from './api.js';

type AccountEventHandlersOptional = {
  render_status_text?: (text: string, show_spinner?: boolean) => void;
  find_matching_tokens_from_email?: (account_email: string, uuid: string) => Promise<string[]|null>; };
type AccountEventHandlers = {
  render_status_text: (text: string, show_spinner?: boolean) => void;
  find_matching_tokens_from_email: (account_email: string, uuid: string) => Promise<string[]|null>; };

export type PaymentMethod = 'stripe'|'group'|'trial';
export type ProductLevel = 'pro'|null;
export type Product = {id: null|string, method: null|PaymentMethod, name: null|string, level: ProductLevel};

export class FlowCryptAccount {

  PRODUCTS: Dict<Product> = {
    null: {id: null, method: null, name: null, level: null},
    trial: { id: 'free_month', method: 'trial', name: 'trial', level: 'pro' },
    advanced_monthly: { id: 'cu-adv-month', method: 'stripe', name: 'advanced_monthly', level: 'pro' },
  };

  private can_read_email: boolean;
  private cryptup_verification_email_sender = 'verify@cryptup.org';
  private event_handlers: AccountEventHandlers;

  constructor(handlers: AccountEventHandlersOptional, can_read_email: boolean) {
    this.event_handlers = {
      render_status_text: handlers.render_status_text || ((text: string, show_spinner?:boolean) => undefined),
      find_matching_tokens_from_email: handlers.find_matching_tokens_from_email || this.fetch_token_emails_on_gmail_and_find_matching_token,
    };
    this.can_read_email = can_read_email;
  }

  subscribe = async (account_email: string, chosen_product: Product, source: string|null) => {
    this.event_handlers.render_status_text(chosen_product.method === 'trial' ? 'enabling trial..' : 'upgrading..', true);
    await Api.fc.account_check_sync();
    try {
      return await this.do_subscribe(chosen_product, source);
    } catch (e) {
      if (Api.error.is_auth_error(e)) {
        await this.save_subscription_attempt(chosen_product, source);
        let response = await this.register(account_email);
        return await this.do_subscribe(chosen_product, source);
      }
      throw e;
    }
  }

  register = async (account_email: string) => { // register_and_attempt_to_verify
    this.event_handlers.render_status_text('registering..', true);
    let response = await Api.fc.account_login(account_email);
    if (response.verified) {
      return response;
    }
    if (this.can_read_email) {
      this.event_handlers.render_status_text('verifying..', true);
      let tokens = await this.wait_for_token_email(30);
      if (tokens && tokens.length) {
        return await this.verify(account_email, tokens);
      } else {
        throw {code: null, internal: 'email', message: `Please check your inbox (${account_email}) for a verification email`};
      }
    } else {
      throw {code: null, internal: 'email', message: `Please check your inbox (${account_email}) for a verification email`};
    }
  }

  verify = async (account_email: string, tokens: string[]) => {
    this.event_handlers.render_status_text('verifying your email address..', true);
    let last_token_error;
    for (let token of tokens) {
      try {
        return await Api.fc.account_login(account_email, token);
      } catch (e) {
        if (Api.error.is_standard_error(e, 'token')) {
          last_token_error = e;
        } else {
          throw e;
        }
      }
    }
    throw last_token_error;
  }

  register_new_device = async (account_email: string) => {
    await Store.set(null, { cryptup_account_uuid: undefined });
    this.event_handlers.render_status_text('checking..', true);
    return await this.register(account_email);
  }

  save_subscription_attempt = async (product: Product, source: string|null) => {
    (product as any as SubscriptionAttempt).source = source;
    await Store.set(null, { 'cryptup_subscription_attempt': product as any as SubscriptionAttempt });
  }

  parse_token_email_text = (verification_email_text: string, stored_uuid_to_cross_check?: string): string|undefined => {
    let token_link_match = verification_email_text.match(/account\/login?([^\s"<]+)/g);
    if (token_link_match !== null) {
      let token_link_params = Env.url_params(['account', 'uuid', 'token'], token_link_match[0].split('?')[1]);
      if ((!stored_uuid_to_cross_check || token_link_params.uuid === stored_uuid_to_cross_check) && token_link_params.token) {
        return token_link_params.token as string;
      }
    }
  }

  private do_subscribe = async (chosen_product: Product, source:string|null=null) => {
    await Store.remove(null, ['cryptup_subscription_attempt']);
    // todo - deal with auth error? would need to know account_email for new registration
    let response = await Api.fc.account_subscribe(chosen_product.id!, chosen_product.method!, source);
    if (response.subscription.level === chosen_product.level && response.subscription.method === chosen_product.method) {
      return response.subscription;
    }
    throw {code: null, message: 'Something went wrong when upgrading, please email human@flowcrypt.com to get this resolved.', internal: 'mismatch'};
  }

  private fetch_token_emails_on_gmail_and_find_matching_token = async (account_email: string, uuid: string): Promise<string[]|null> => {
    let tokens: string[] = [];
    let response = await Api.gmail.message_list(account_email, 'from:' + this.cryptup_verification_email_sender + ' to:' + account_email + ' in:anywhere', true);
    if (!response.messages) {
      return null;
    }
    let messages = await Api.gmail.messages_get(account_email, response.messages.map(m => m.id), 'full');
    for (let gmail_message_object of messages) {
      if (gmail_message_object.payload.mimeType === 'text/plain' && gmail_message_object.payload.body && gmail_message_object.payload.body.size > 0 && gmail_message_object.payload.body.data) {
        let token = this.parse_token_email_text(Str.base64url_decode(gmail_message_object.payload.body.data), uuid);
        if (token && typeof token === 'string') {
          tokens.push(token);
        }
      }
    }
    tokens.reverse(); // most recent first
    return tokens.length ? tokens : null;
  }

  private sleep(seconds: number) {
    return new Promise(resolve => Catch.set_timeout(resolve, seconds * 1000));
  }

  private wait_for_token_email = async (timeout: number) => {
    let end = Date.now() + timeout * 1000;
    while (Date.now() < end) {
      if ((end - Date.now()) < 20000) { // 20s left
        this.event_handlers.render_status_text('Still working..');
      } else if ((end - Date.now()) < 10000) { // 10s left
        this.event_handlers.render_status_text('A little while more..');
      }
      let auth_info = await Store.auth_info();
      let tokens = await this.event_handlers.find_matching_tokens_from_email(auth_info.account_email!, auth_info.uuid!);
      if (tokens) {
        return tokens;
      } else {
        await this.sleep(5);
      }
    }
  }

}
