
export type bogus = never; // that way TS understands this is to be treated as a module

import { Attachment } from '../js/common/common.js';
import { Injector } from '../js/common/inject.js';
import { Notifications } from '../js/common/notifications.js';
import { DecryptResult, DiagnoseMessagePubkeysResult, MessageVerifyResult } from '../js/common/pgp.js';
import { FlatHeaders, StandardError } from '../js/common/api.js';
import { XssSafeFactory } from '../js/common/browser.js';

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

// todo Attachment
type FlowCryptAttachmentLinkData = {name: string, type: string, size: number};

type Attachment$treat_as = "public_key" | "message" | "hidden" | "signature" | "encrypted" | "standard";

type AttachmentMeta = {
  data?: string|Uint8Array|null;
  type?:string|null;
  name?: string|null;
  length?: number|null;
  url?: string|null;
  inline?: boolean|null;
  id?: string|null;
  message_id?: string|null;
  treat_as?: Attachment$treat_as;
  cid?: string|null;
};

interface FromToHeaders {
    from: string;
    to: string[];
}

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

// TodoMime
interface MimeContent {
    headers: FlatHeaders;
    attachments: Attachment[];
    signature: string|undefined;
    html: string|undefined;
    text: string|undefined;
}
interface MimeParserNode {
  path: string[];
  headers: {
      [key: string]: {value: string}[];
  };
  rawContent: string;
  content: Uint8Array;
  appendChild: (child: MimeParserNode) => void;
  contentTransferEncoding: {value: string};
  charset?: string;
}
type KeyBlockType = 'public_key'|'private_key';
type ReplaceableMessageBlockType = KeyBlockType|'attest_packet'|'cryptup_verification'|'signed_message'|'message'|'password_message';
type MessageBlockType = 'text'|ReplaceableMessageBlockType;
interface MessageBlock {
    type: MessageBlockType;
    content: string;
    complete: boolean;
    signature?: string;
}

type KeyBackupMethod = 'file'|'inbox'|'none'|'print';
type WebMailName = 'gmail'|'outlook'|'inbox'|'settings';
type PassphraseDialogType = 'embedded'|'sign'|'attest';
type Placement = 'settings'|'settings_compose'|'default'|'dialog'|'gmail'|'embedded'|'compose';
type Callback = (r?: any) => void;

// Todo BrowserMsg
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

// todo Attachment
type AttachLimits = {count?: number, size?: number, size_mb?: number, oversize?: (new_file_size: number) => void};

type BrowserEventErrorHandler = {auth?: () => void, auth_popup?: () => void, network?: () => void, other?: (e: any) => void};

// Todo Pgp or Mime?
type CryptoArmorHeaderDefinition = {begin: string, middle?: string, end: string|RegExp, replace: boolean};
type CryptoArmorHeaderDefinitions = {
    readonly [type in ReplaceableMessageBlockType|'null'|'signature']: CryptoArmorHeaderDefinition;
};
