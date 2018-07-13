/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

class FlowCryptAccount {

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
      render_status: handlers.render_status || ((text: string, show_spinner?:boolean) => undefined),
      find_matching_tokens_from_email: handlers.find_matching_tokens_from_email || this.fetch_token_emails_on_gmail_and_find_matching_token,  
    };
    this.can_read_email = can_read_email;
  }

  subscribe = async (account_email: string, chosen_product: Product, source: string|null) => {
    this.event_handlers.render_status(chosen_product.method === 'trial' ? 'enabling trial..' : 'upgrading..', true);
    await tool.api.cryptup.account_check_sync();
    let auth_info = await Store.auth_info();
    if(auth_info.verified) {
      try {
        return await this.do_subscribe(chosen_product, source);
      } catch(error) {
        if(error.internal !== 'auth') { // auth error will get resolved by continuing below
          throw error;
        }
      }
    }
    await this.save_subscription_attempt(chosen_product, source);
    let response = await this.register(account_email);
    return await this.do_subscribe(chosen_product, source);
  };
  
  register = async (account_email: string) => { // register_and_attempt_to_verify
    this.event_handlers.render_status('registering..', true);
    let response = await tool.api.cryptup.account_login(account_email);
    if(response.verified) {
      return response;
    }
    if(this.can_read_email) {
      this.event_handlers.render_status('verifying..', true);
      let tokens = await this.wait_for_token_email(30);
      if(tokens && tokens.length) {
        return await this.verify(account_email, tokens);
      } else {
        throw {code: null, internal: 'email', message: `Please check your inbox (${account_email}) for a verification email`};
      }
    } else {
      throw {code: null, internal: 'email', message: `Please check your inbox (${account_email}) for a verification email`};
    }
  };
  
  verify = async (account_email: string, tokens: string[]) => {
    this.event_handlers.render_status('verifying your email address..', true);
    let last_token_error;
    for(let token of tokens) {
      try {
        return await tool.api.cryptup.account_login(account_email, token);
      } catch(error) {
        if(error.internal === 'token') {
          last_token_error = error;
        } else {
          throw error;
        }
      }
    }
    throw last_token_error;
  };

  register_new_device = async (account_email: string) => {
    await Store.set(null, { cryptup_account_uuid: undefined, cryptup_account_verified: false });
    this.event_handlers.render_status('checking..', true);
    return await this.register(account_email);
  };
  
  save_subscription_attempt = async (product: Product, source: string|null) => {
    (product as SubscriptionAttempt).source = source;
    await Store.set(null, { 'cryptup_subscription_attempt': product as SubscriptionAttempt });
  };
  
  parse_token_email_text = (verification_email_text: string, stored_uuid_to_cross_check?: string): string|undefined => {
    let token_link_match = verification_email_text.match(/account\/login?([^\s"<]+)/g);
    if(token_link_match !== null) {
      let token_link_params = tool.env.url_params(['account', 'uuid', 'token'], token_link_match[0].split('?')[1]);
      if ((!stored_uuid_to_cross_check || token_link_params.uuid === stored_uuid_to_cross_check) && token_link_params.token) {
        return token_link_params.token as string;
      }
    }
  };

  private do_subscribe = async (chosen_product: Product, source:string|null=null) => {
    await Store.remove(null, ['cryptup_subscription_attempt']);
    // todo - deal with auth error? would need to know account_email for new registration
    let response = await tool.api.cryptup.account_subscribe(chosen_product.id!, chosen_product.method!, source);
    if(response.subscription.level === chosen_product.level && response.subscription.method === chosen_product.method) {
      return response.subscription;
    }
    throw {code: null, message: 'Something went wrong when upgrading, please email me at human@flowcrypt.com to fix this.', internal: 'mismatch'};
  };
  
  private fetch_token_emails_on_gmail_and_find_matching_token = async (account_email: string, uuid: string): Promise<string[]|null> => {
    let tokens: string[] = [];
    let response = await tool.api.gmail.message_list(account_email, 'from:' + this.cryptup_verification_email_sender + ' to:' + account_email + ' in:anywhere', true);
    if(!response.messages) {
      return null;
    }
    let messages = await tool.api.gmail.messages_get(account_email, response.messages.map(m => m.id), 'full');
    for(let gmail_message_object of Object.values(messages)) {
      if((gmail_message_object as any).payload.mimeType === 'text/plain' && (gmail_message_object as any).payload.body.size > 0) {
        let token = this.parse_token_email_text(tool.str.base64url_decode((gmail_message_object as any).payload.body.data), uuid);
        if(token && typeof token === 'string') {
          tokens.push(token);
        }
      }
    }
    tokens.reverse();
    return tokens.length ? tokens : null;
  };
  
  private sleep(seconds: number) {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
  }

  private wait_for_token_email = async (timeout: number) => {
    let end = Date.now() + timeout * 1000;
    while (Date.now() < end) {
      if((end - Date.now()) < 20000) { // 20s left
        this.event_handlers.render_status('Still working..');
      } else if((end - Date.now()) < 10000) { // 10s left
        this.event_handlers.render_status('A little while more..');
      }
      let auth_info = await Store.auth_info();
      let tokens = await this.event_handlers.find_matching_tokens_from_email(auth_info.account_email!, auth_info.uuid!);
      if(tokens) {
        return tokens;
      } else {
        await this.sleep(5);
      }
    }
  };

}

