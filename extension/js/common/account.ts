/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypcom */

'use strict';

import { Store, SubscriptionAttempt } from './store.js';
import { Env, Str, Catch, Dict } from './common.js';
import { Api } from './api.js';

type AccountEventHandlersOptional = {
  renderStatusText?: (text: string, show_spinner?: boolean) => void;
  findMatchingTokensFromEmail?: (acctEmail: string, uuid: string) => Promise<string[]|null>; };
type AccountEventHandlers = {
  renderStatusText: (text: string, show_spinner?: boolean) => void;
  findMatchingTokensFromEmail: (acctEmail: string, uuid: string) => Promise<string[]|null>; };

export type PaymentMethod = 'stripe'|'group'|'trial';
export type ProductLevel = 'pro'|null;
export type Product = {id: null|string, method: null|PaymentMethod, name: null|string, level: ProductLevel};

export class FlowCryptAccount {

  PRODUCTS: Dict<Product> = {
    null: {id: null, method: null, name: null, level: null},
    trial: { id: 'free_month', method: 'trial', name: 'trial', level: 'pro' },
    advancedMonthly: { id: 'cu-adv-month', method: 'stripe', name: 'advanced_monthly', level: 'pro' },
  };

  private canReadEmail: boolean;
  private cryptupVerificationEmailSender = 'verify@cryptup.org';
  private eventHandlers: AccountEventHandlers;

  constructor(handlers: AccountEventHandlersOptional, canReadEmail: boolean) {
    this.eventHandlers = {
      renderStatusText: handlers.renderStatusText || ((text: string, show_spinner?:boolean) => undefined),
      findMatchingTokensFromEmail: handlers.findMatchingTokensFromEmail || this.fetchTokenEmailsOnGmailAndFindMatchingToken,
    };
    this.canReadEmail = canReadEmail;
  }

  subscribe = async (acctEmail: string, chosenProduct: Product, source: string|null) => {
    this.eventHandlers.renderStatusText(chosenProduct.method === 'trial' ? 'enabling trial..' : 'upgrading..', true);
    await Api.fc.accountCheckSync();
    try {
      return await this.doSubscribe(chosenProduct, source);
    } catch (e) {
      if (Api.err.isAuthErr(e)) {
        await this.saveSubscriptionAttempt(chosenProduct, source);
        let response = await this.register(acctEmail);
        return await this.doSubscribe(chosenProduct, source);
      }
      throw e;
    }
  }

  register = async (acctEmail: string) => { // register_and_attempt_to_verify
    this.eventHandlers.renderStatusText('registering..', true);
    let response = await Api.fc.accountLogin(acctEmail);
    if (response.verified) {
      return response;
    }
    if (this.canReadEmail) {
      this.eventHandlers.renderStatusText('verifying..', true);
      let tokens = await this.waitForTokenEmail(30);
      if (tokens && tokens.length) {
        return await this.verify(acctEmail, tokens);
      } else {
        throw {code: null, internal: 'email', message: `Please check your inbox (${acctEmail}) for a verification email`};
      }
    } else {
      throw {code: null, internal: 'email', message: `Please check your inbox (${acctEmail}) for a verification email`};
    }
  }

  verify = async (acctEmail: string, tokens: string[]) => {
    this.eventHandlers.renderStatusText('verifying your email address..', true);
    let lastTokenErr;
    for (let token of tokens) {
      try {
        return await Api.fc.accountLogin(acctEmail, token);
      } catch (e) {
        if (Api.err.isStandardErr(e, 'token')) {
          lastTokenErr = e;
        } else {
          throw e;
        }
      }
    }
    throw lastTokenErr;
  }

  registerNewDevice = async (acctEmail: string) => {
    await Store.set(null, { cryptup_account_uuid: undefined });
    this.eventHandlers.renderStatusText('checking..', true);
    return await this.register(acctEmail);
  }

  saveSubscriptionAttempt = async (product: Product, source: string|null) => {
    (product as any as SubscriptionAttempt).source = source;
    await Store.set(null, { 'cryptup_subscription_attempt': product as any as SubscriptionAttempt });
  }

  parseTokenEmailText = (verifEmailText: string, storedUuidToCrossCheck?: string): string|undefined => {
    let tokenLinkMatch = verifEmailText.match(/account\/login?([^\s"<]+)/g);
    if (tokenLinkMatch !== null) {
      let tokenLinkParams = Env.urlParams(['account', 'uuid', 'token'], tokenLinkMatch[0].split('?')[1]);
      if ((!storedUuidToCrossCheck || tokenLinkParams.uuid === storedUuidToCrossCheck) && tokenLinkParams.token) {
        return tokenLinkParams.token as string;
      }
    }
  }

  private doSubscribe = async (chosenProduct: Product, source:string|null=null) => {
    await Store.remove(null, ['cryptup_subscription_attempt']);
    // todo - deal with auth error? would need to know account_email for new registration
    let response = await Api.fc.accountSubscribe(chosenProduct.id!, chosenProduct.method!, source);
    if (response.subscription.level === chosenProduct.level && response.subscription.method === chosenProduct.method) {
      return response.subscription;
    }
    throw {code: null, message: 'Something went wrong when upgrading, please email human@flowcrypt.com to get this resolved.', internal: 'mismatch'};
  }

  private fetchTokenEmailsOnGmailAndFindMatchingToken = async (acctEmail: string, uuid: string): Promise<string[]|null> => {
    let tokens: string[] = [];
    let response = await Api.gmail.msgList(acctEmail, 'from:' + this.cryptupVerificationEmailSender + ' to:' + acctEmail + ' in:anywhere', true);
    if (!response.messages) {
      return null;
    }
    let msgs = await Api.gmail.msgsGet(acctEmail, response.messages.map(m => m.id), 'full');
    for (let gmailMsg of msgs) {
      if (gmailMsg.payload.mimeType === 'text/plain' && gmailMsg.payload.body && gmailMsg.payload.body.size > 0 && gmailMsg.payload.body.data) {
        let token = this.parseTokenEmailText(Str.base64urlDecode(gmailMsg.payload.body.data), uuid);
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

  private waitForTokenEmail = async (timeout: number) => {
    let end = Date.now() + timeout * 1000;
    while (Date.now() < end) {
      if ((end - Date.now()) < 20000) { // 20s left
        this.eventHandlers.renderStatusText('Still working..');
      } else if ((end - Date.now()) < 10000) { // 10s left
        this.eventHandlers.renderStatusText('A little while more..');
      }
      let authInfo = await Store.authInfo();
      let tokens = await this.eventHandlers.findMatchingTokensFromEmail(authInfo.account_email!, authInfo.uuid!);
      if (tokens) {
        return tokens;
      } else {
        await this.sleep(5);
      }
    }
  }

}
