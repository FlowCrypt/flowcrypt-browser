
export type bogus = never; // that way TS understands this is to be treated as a module

import { Injector } from '../js/common/inject.js';
import { Notifications } from '../js/common/notifications.js';
import { DecryptResult, DiagnoseMessagePubkeysResult, MessageVerifyResult } from '../js/common/pgp.js';
import { FlatHeaders, StandardError } from '../js/common/api.js';
import { XssSafeFactory } from '../js/common/browser.js';
import { Attachment } from '../js/common/attachment.js';

interface BrowserWidnow extends Window {
    XMLHttpRequest: any;
    onunhandledrejection: (e: any) => void;
    'emailjs-mime-codec': AnyThirdPartyLibrary;
    'emailjs-mime-parser': AnyThirdPartyLibrary;
    'emailjs-mime-builder': AnyThirdPartyLibrary;
    'emailjs-addressparser': {
      parse: (raw: string) => {name: string, address: string}[];
    };
}
type DbContactFilter = { has_pgp?: boolean, substring?: string, limit?: number };

type Codec = {encode: (text: string, mode: 'fatal'|'html') => string, decode: (text: string) => string, labels: string[], version: string};

interface FcWindow extends BrowserWidnow {
    $: JQuery;
    iso88592: Codec;
    // windows1252: Codec;
    // koi8r: Codec;
    is_bare_engine: boolean;
}

type AnyThirdPartyLibrary = any;
type Thrown = Error|StandardError|any;

interface Challenge {
    question?: string;
    answer: string;
}

interface Dict<T> {
    [key: string]: T;
}

// Todo Env
type UrlParam = string|number|null|undefined|boolean|string[];
type UrlParams = Dict<UrlParam>;

type ConsummableBrowserBlob = {blob_type: 'text'|'uint8', blob_url: string};

type KeyBackupMethod = 'file'|'inbox'|'none'|'print';
type WebMailName = 'gmail'|'outlook'|'inbox'|'settings';
type PassphraseDialogType = 'embedded'|'sign'|'attest';
type Placement = 'settings'|'settings_compose'|'default'|'dialog'|'gmail'|'embedded'|'compose';
type Callback = (r?: any) => void;

type PaymentMethod = 'stripe'|'group'|'trial';
type ProductLevel = 'pro'|null;
type Product = {id: null|string, method: null|PaymentMethod, name: null|string, level: ProductLevel};

type EmailProvider = 'gmail';
type AccountEventHandlersOptional = {
    render_status_text?: (text: string, show_spinner?: boolean) => void;
    find_matching_tokens_from_email?: (account_email: string, uuid: string) => Promise<string[]|null>;
};
type AccountEventHandlers = {
    render_status_text: (text: string, show_spinner?: boolean) => void;
    find_matching_tokens_from_email: (account_email: string, uuid: string) => Promise<string[]|null>;
};

type WebmailVariantObject = {new_data_layer: null|boolean, new_ui: null|boolean, email: null|string, gmail_variant: WebmailVariantString};
type WebmailVariantString = null|'html'|'standard'|'new';
type WebmailSpecificInfo = {
    name: WebMailName;
    variant: WebmailVariantString;
    get_user_account_email: () => string|undefined;
    get_user_full_name: () => string|undefined;
    get_replacer: () => WebmailElementReplacer;
    start: (account_email: string, inject: Injector, notifications: Notifications, factory: XssSafeFactory, notify_murdered: Callback) => Promise<void>;
};
interface WebmailElementReplacer {
    everything: () => void;
    set_reply_box_editable: () => void;
    reinsert_reply_box: (subject: string, my_email: string, reply_to: string[], thread_id: string) => void;
    scroll_to_bottom_of_conversation: () => void;
}
type NotificationWithHandlers = {notification: string, callbacks: Dict<Callback>};

interface JQS extends JQueryStatic {
    featherlight: Function; // tslint:disable-line:ban-types
}
