
export type bogus = never; // that way TS understands this is to be treated as a module

import {Attachment} from '../js/common/common.js';
import {Injector} from '../js/common/inject.js';
import {Notifications} from '../js/common/notifications.js';
import {XssSafeFactory} from '../js/common/factory.js';
import { DecryptResult, DiagnoseMessagePubkeysResult, MessageVerifyResult } from '../js/common/pgp.js';

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

interface ContentScriptWindow extends FcWindow {
    TrySetDestroyableTimeout: (code: () => void, ms: number) => number;
    TrySetDestroyableInterval: (code: () => void, ms: number) => number;
    injected: true; // background script will use this to test if scripts were already injected, and inject if not
    account_email_global: null|string; // used by background script
    same_world_global: true; // used by background_script
    destruction_event: string;
    destroyable_class: string;
    reloadable_class: string;
    destroyable_intervals: number[];
    destroyable_timeouts: number[];
    destroy: () => void;
    vacant: () => boolean;
}

interface FlowCryptManifest extends chrome.runtime.Manifest {
    oauth2: {client_id:string, url_code:string, url_tokens:string, url_redirect:string, state_header:string, scopes:string[]};
}

// todo Store
interface Contact {
    email: string;
    name: string | null;
    pubkey: string | null;
    has_pgp: 0|1;
    searchable: string[];
    client: string | null;
    attested: boolean | null;
    fingerprint: string | null;
    longid: string | null;
    keywords: string | null;
    pending_lookup: number;
    last_use: number | null;
    date: number | null; // todo - should be removed. email provider search seems to return this?
}

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

// todo Setup
interface SetupOptions {
    full_name: string;
    passphrase: string;
    passphrase_save: boolean;
    submit_main: boolean;
    submit_all: boolean;
    setup_simple: boolean;
    key_backup_prompt: number|boolean;
    recovered?: boolean;
    is_newly_created_key: boolean;
}

interface FromToHeaders {
    from: string;
    to: string[];
}

// todo Api or Store
interface PubkeySearchResult {
    email: string;
    pubkey: string|null;
    attested: boolean|null;
    has_cryptup: boolean|null;
    longid: string|null;
}

interface Challenge {
    question?: string;
    answer: string;
}

interface Dict<T> {
    [key: string]: T;
}

// Todo Env
type FlatHeaders = Dict<string>;
type RichHeaders = Dict<string|string[]>;
type UrlParam = string|number|null|undefined|boolean|string[];
type UrlParams = Dict<UrlParam>;

// Todo Ui
type PreventableEventName = 'double'|'parallel'|'spree'|'slowspree'|'veryslowspree';

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

// Todo Api
interface SendableMessageBody {
    [key: string]: string|undefined;
    'text/plain'?: string;
    'text/html'?: string;
}
interface SendableMessage {
    headers: FlatHeaders;
    from: string;
    to: string[];
    subject: string;
    body: SendableMessageBody;
    attachments: Attachment[];
    thread: string|null;
}
interface StandardError {
    code: number|null;
    message: string;
    internal: string|null;
    data?: string;
    stack?: string;
}
interface StandardErrorResponse {error: StandardError;}

type KeyBackupMethod = 'file'|'inbox'|'none'|'print';
type WebMailName = 'gmail'|'outlook'|'inbox'|'settings';
type PassphraseDialogType = 'embedded'|'sign'|'attest';
type Placement = 'settings'|'settings_compose'|'default'|'dialog'|'gmail'|'embedded'|'compose';
type Callback = (r?: any) => void;

// Todo BrowserMsg
type BrowserMessageRequestDb = {f: string, args: any[]};
type BrowserMessageRequestSessionSet = {account_email: string, key: string, value: string|undefined};
type BrowserMessageRequestSessionGet = {account_email: string, key: string};
type BrowserMessageRequest = null|Dict<any>;
type BrowserMessageResponse = any|Dict<any>;
type BrowserMessageHandler = (request: BrowserMessageRequest, sender: chrome.runtime.MessageSender|'background', respond: Callback) => void|Promise<void>;

// Todo Api
type FlowCryptApiAuthToken = {account: string, token: string};
type FlowCryptApiAuthMethods = 'uuid'|FlowCryptApiAuthToken|null;

type PaymentMethod = 'stripe'|'group'|'trial';
type ProductLevel = 'pro'|null;
type Product = {id: null|string, method: null|PaymentMethod, name: null|string, level: ProductLevel};

// Todo Ui
type NamedSelectors = Dict<JQuery<HTMLElement>>;
type SelectorCache = {
    cached: (name: string) => JQuery<HTMLElement>;
    now: (name: string) => JQuery<HTMLElement>;
    selector: (name: string) => string;
};

// Todo Pgp
type EncryptDecryptOutputFormat = 'utf8'|'binary';

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

// Todo Api
type GoogleAuthTokenInfo = {issued_to: string, audience: string, scope: string, expires_in: number, access_type: 'offline'};
type GoogleAuthTokensResponse = {access_token: string, expires_in: number, refresh_token?: string};
type AuthRequest = {tab_id: string, account_email: string|null, scopes: string[], message_id?: string, auth_responder_id: string, omit_read_scope?: boolean};
type GoogleAuthWindowResult$result = 'Success'|'Denied'|'Error'|'Closed';
type GoogleAuthWindowResult = {result: GoogleAuthWindowResult$result, state: AuthRequest, params: {code: string, error: string}};
type AuthResultSuccess = {success: true, result: 'Success', account_email: string, message_id?: string};
type AuthResultError = {success: false, result: GoogleAuthWindowResult$result, account_email: string|null, message_id?: string, error?: string};
type AuthResult = AuthResultSuccess|AuthResultError;
// type AjaxError = {request: JQuery.jqXHR<any>, status: JQuery.Ajax.ErrorTextStatus, error: string};

type BrowserEventErrorHandler = {auth?: () => void, auth_popup?: () => void, network?: () => void, other?: (e: any) => void};

// Todo Pgp or Mime?
type CryptoArmorHeaderDefinition = {begin: string, middle?: string, end: string|RegExp, replace: boolean};
type CryptoArmorHeaderDefinitions = {
    readonly [type in ReplaceableMessageBlockType|'null'|'signature']: CryptoArmorHeaderDefinition;
};

// Todo KeyImportUi
type KeyImportUiCheckResult = {
  normalized: string;
  longid: string;
  passphrase: string;
  fingerprint: string;
  decrypted: OpenPGP.key.Key;
  encrypted: OpenPGP.key.Key;
};

type ParsedAttest = {
  success: boolean;
  content: {
    [key: string]: string|undefined;
    action?: string;
    attester?: string;
    email_hash?: string;
    fingerprint?: string;
    fingerprint_old?: string;
    random?: string;
  };
  text: string|null;
  error: string|null;
};
