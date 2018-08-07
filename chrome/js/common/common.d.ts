
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
type AnyPlatformDependentCode = any;
type Thrown = Error|StandardError|any;

interface ContentScriptWindow extends FcWindow {
    TrySetDestroyableTimeout: (code: Function, ms: number) => number; // tslint:disable-line:ban-types
    TrySetDestroyableInterval: (code: Function, ms: number) => number; // tslint:disable-line:ban-types
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

interface SelectorCacher {
    cached: (name: string) => JQuery;
    now: (name: string) => JQuery;
}

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

interface ContactUpdate {
    email?: string;
    name?: string | null;
    pubkey?: string;
    has_pgp?: 0|1;
    searchable?: string[];
    client?: string | null;
    attested?: boolean | null;
    fingerprint?: string | null;
    longid?: string | null;
    keywords?: string | null;
    pending_lookup?: number;
    last_use?: number | null;
    date?: number | null; // todo - should be removed. email provider search seems to return this?
}

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
};

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

type FlatHeaders = Dict<string>;
type RichHeaders = Dict<string|string[]>;

interface PreventableEvent {
    name: 'double'|'parallel'|'spree'|'slowspree'|'veryslowspree';
    id: string;
}

type ConsummableBrowserBlob = {blob_type: 'text'|'uint8', blob_url: string};

interface DecryptSuccess {
    success: true;
    content: {
      blob?: ConsummableBrowserBlob;
      text?: string;
      uint8?: Uint8Array;
      filename: string|null;
    };
    signature: MessageVerifyResult|null;
    is_encrypted: boolean|null;
}

type DecryptError$error = {
  type: DecryptErrorTypes;
  error?: string;
};

type DecryptError$longids = {
  message: string[];
  matching: string[];
  chosen: string[];
  need_passphrase: string[];
};

interface DecryptError {
    success: false;
    error: DecryptError$error;
    longids: DecryptError$longids;
    is_encrypted: null|boolean;
    signature: null;
    message?: OpenPGP.message.Message|OpenPGP.cleartext.CleartextMessage;
}

type DecryptResult = DecryptSuccess|DecryptError;
type DiagnoseMessagePubkeysResult = { found_match: boolean, receivers: number, };
type PossibleBgExecResults = DecryptResult|DiagnoseMessagePubkeysResult|MessageVerifyResult;
type BgExecRequest = {path: string, args: any[]};
type BgExecResponse = {result?: PossibleBgExecResults, exception?: {name: string, message: string, stack: string}};

type UrlParam = string|number|null|undefined|boolean|string[];
type UrlParams = Dict<UrlParam>;

interface KeyInfo {
    public: string;
    private: string;
    fingerprint: string;
    longid: string;
    primary: boolean;
    decrypted?: OpenPGP.key.Key;
    keywords: string;
}

interface MimeContent {
    headers: FlatHeaders;
    attachments: Attachment[];
    signature: string|undefined;
    html: string|undefined;
    text: string|undefined;
}

type StoredAuthInfo = {account_email: string|null, uuid: string|null, verified: boolean|null};

type KeyBlockType = 'public_key'|'private_key';
type ReplaceableMessageBlockType = KeyBlockType|'attest_packet'|'cryptup_verification'|'signed_message'|'message'|'password_message';
type MessageBlockType = 'text'|ReplaceableMessageBlockType;

interface MessageBlock {
    type: MessageBlockType;
    content: string;
    complete: boolean;
    signature?: string;
}

interface MimeParserNode {
    path: string[];
    headers: {
        [key: string]: {value: string}[];
    };
    rawContent: string;
    content: Uint8Array;
    appendChild: (child: MimeParserNode) => void;
}

interface MessageVerifyResult {
    signer: string|null;
    contact: Contact|null;
    match: boolean|null;
    error: null|string;
}

interface InternalSortedKeysForDecrypt {
    verification_contacts: Contact[];
    for_verification: OpenPGP.key.Key[];
    encrypted_for: string[];
    signed_by: string[];
    prv_matching: KeyInfo[];
    prv_for_decrypt: KeyInfo[];
    prv_for_decrypt_decrypted: KeyInfo[];
    prv_for_decrypt_without_passphrases: KeyInfo[];
}

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

type KeyBackupMethod = 'file'|'inbox'|'none'|'print';
type WebMailName = 'gmail'|'outlook'|'inbox'|'settings';
type PassphraseDialogType = 'embedded'|'sign'|'attest';
type Placement = 'settings'|'settings_compose'|'default'|'dialog'|'gmail'|'embedded'|'compose';
type FlatTypes = null|undefined|number|string|boolean;
type SerializableTypes = FlatTypes|string[]|number[]|boolean[]|SubscriptionInfo;
type Serializable = SerializableTypes|SerializableTypes[]|Dict<SerializableTypes>|Dict<SerializableTypes>[];
type Callback = (r?: any) => void;
type EncryptDecryptOutputFormat = 'utf8'|'binary';

type BrowserMessageRequestDb = {f: string, args: any[]};
type BrowserMessageRequestSessionSet = {account_email: string, key: string, value: string|undefined};
type BrowserMessageRequestSessionGet = {account_email: string, key: string};
type BrowserMessageRequest = null|Dict<any>;
type BrowserMessageResponse = any|Dict<any>;
type BrowserMessageHandler = (request: BrowserMessageRequest, sender: chrome.runtime.MessageSender|'background', respond: Callback) => void;

type FlowCryptApiAuthToken = {account: string, token: string};
type FlowCryptApiAuthMethods = 'uuid'|FlowCryptApiAuthToken|null;

type PaymentMethod = 'stripe'|'group'|'trial';
type ProductLevel = 'pro'|null;
type Product = {id: null|string, method: null|PaymentMethod, name: null|string, level: ProductLevel};
type ApiCallFormat = 'JSON'|'FORM';
type ApiCallProgressCallback = (percent: number|null, loaded: number|null, total: number|null) => void;
type ApiCallProgressCallbacks = {upload?: ApiCallProgressCallback|null, download?: ApiCallProgressCallback|null};
type ApiCallMethod = 'POST'|'GET'|'DELETE'|'PUT';
type ApiResponseFormat = 'json';
type GmailApiResponseFormat = 'raw'|'full'|'metadata';
type NamedSelectors = Dict<JQuery<HTMLElement>>;
type SelectorCache = {
    cached: (name: string) => JQuery<HTMLElement>;
    now: (name: string) => JQuery<HTMLElement>;
    selector: (name: string) => string;
};
type StorageType = 'session'|'local';
type EmailProvider = 'gmail';
type ProviderContactsQuery = {substring: string};
type ProviderContactsResults = {new: Contact[], all: Contact[]};

type AccountEventHandlersOptional = {
    render_status?: (text: string, show_spinner?: boolean) => void;
    find_matching_tokens_from_email?: (account_email: string, uuid: string) => Promise<string[]|null>;
};
type AccountEventHandlers = {
    render_status: (text: string, show_spinner?: boolean) => void;
    find_matching_tokens_from_email: (account_email: string, uuid: string) => Promise<string[]|null>;
};

// specific api results
type ApirFcHelpFeedback = {sent: boolean};
type ApirFcAccountLogin = {registered: boolean, verified: boolean, subscription: SubscriptionInfo};
type ApirFcAccountUpdate$result = {alias: string, email: string, intro: string, name: string, photo: string, default_message_expire: number};
type ApirFcAccountUpdate = {result: ApirFcAccountUpdate$result, updated: boolean};
type ApirFcAccountSubscribe = {subscription: SubscriptionInfo};
type ApirFcAccountCheck = {email: string|null, subscription: {level: SubscriptionLevel, expire: string, expired: boolean, method: PaymentMethod|null}|null};

type ApirFcMessagePresignFiles = {approvals: {base_url: string, fields: {key: string}}[]};
type ApirFcMessageConfirmFiles = {confirmed: string[], admin_codes: string[]};
type ApirFcMessageToken = {token: string};
type ApirFcMessageUpload = {short: string, admin_code: string};
type ApirFcMessageLink = {expire: string, deleted: boolean, url: string, expired: boolean};
type ApirFcMessageExpiration = {updated: boolean};

type ApirAttInitialConfirm = {attested: boolean};
type ApirAttReplaceRequest = {saved: boolean};
type ApirAttReplaceConfirm = {attested: boolean};
type ApirAttTestWelcome = {sent: boolean};
type ApirAttInitialLegacySugmit = {attested: boolean, saved: boolean};

type ApirGmailMessage$header = {name: string, value: string};
type ApirGmailMessage$payload$body = {attachmentId: string, size: number, data?: string};
type ApirGmailMessage$payload$part = {body?: ApirGmailMessage$payload$body, filename?: string, mimeType?: string, headers?: ApirGmailMessage$header[]};
type ApirGmailMessage$payload = {parts?: ApirGmailMessage$payload$part[], headers?: ApirGmailMessage$header[], mimeType?: string, body?: ApirGmailMessage$payload$body};
type ApirGmailMessage = {id: string, threadId?: string|null, payload: ApirGmailMessage$payload, raw?: string, internalDate?: number|string};
type ApirGmailMessageList$message = {id: string, threadId: string};
type ApirGmailMessageList = {messages?: ApirGmailMessageList$message[], resultSizeEstimate: number};
type ApirGmailAttachment = {attachmentId: string, size: number, data: string};
type ApirGmailMessageSend = {id: string};
type ApirGmailThreadGet = {id: string, messages: ApirGmailMessage[]};
type ApirGmailDraftCreate = {id: string};
type ApirGmailDraftDelete = {};
type ApirGmailDraftUpdate = {};
type ApirGmailDraftGet = {id: string, message: ApirGmailMessage};
type ApirGmailDraftSend = {};

type ApirGoogleUserInfo = {name: string, locale: string, picture: string};

type WebmailVariantObject = {new_data_layer: null|boolean, new_ui: null|boolean, email: null|string, gmail_variant: WebmailVariantString};
type WebmailVariantString = null|'html'|'standard'|'new';
type WebmailSpecificInfo = {
    name: WebMailName;
    variant: WebmailVariantString;
    get_user_account_email: () => string|undefined;
    get_user_full_name: () => string|undefined;
    get_replacer: () => WebmailElementReplacer;
    start: (account_email: string, inject: Injector, notifications: Notifications, factory: Factory, notify_murdered: Callback) => void;
};
interface WebmailElementReplacer {
    everything: () => void;
    set_reply_box_editable: () => void;
    reinsert_reply_box: (subject: string, my_email: string, reply_to: string[], thread_id: string) => void;
}
type NotificationWithHandlers = {notification: string, callbacks: Dict<Callback>};

interface JQueryStatic {
    featherlight: Function; // tslint:disable-line:ban-types
}

interface JQuery {
    featherlight: Function; // tslint:disable-line:ban-types
}

type AttachLimits = {count?: number, size?: number, size_mb?: number, oversize?: (new_file_size: number) => void};

type SubscriptionLevel = 'pro'|null;

interface SubscriptionInfo {
    active: boolean|null;
    method: PaymentMethod|null;
    level: SubscriptionLevel;
    expire: string|null;
}

interface SubscriptionAttempt extends Product {
    source: string|null;
}

type GoogleAuthTokenInfo = {issued_to: string, audience: string, scope: string, expires_in: number, access_type: 'offline'};
type GoogleAuthTokensResponse = {access_token: string, expires_in: number, refresh_token?: string};
type AuthRequest = {tab_id: string, account_email: string|null, scopes: string[], message_id?: string, auth_responder_id: string, omit_read_scope?: boolean};
type GoogleAuthWindowResult$result = 'Success'|'Denied'|'Error'|'Closed';
type GoogleAuthWindowResult = {result: GoogleAuthWindowResult$result, state: AuthRequest, params: {code: string, error: string}};
type AuthResultSuccess = {success: true, result: 'Success', account_email: string, message_id?: string};
type AuthResultError = {success: false, result: GoogleAuthWindowResult$result, account_email: string|null, message_id?: string, error?: string};
type AuthResult = AuthResultSuccess|AuthResultError;
// type AjaxError = {request: JQuery.jqXHR<any>, status: JQuery.Ajax.ErrorTextStatus, error: string};

type StoredReplyDraftMeta = string; // draft_id
type StoredComposeDraftMeta = {recipients: string[], subject: string, date: number};
type StoredAdminCode = {date: number, codes: string[]};
type StoredAttestLog = {attempt: number, packet?: string, success: boolean, result: string};
type Storable = FlatTypes|string[]|KeyInfo[]|Dict<StoredReplyDraftMeta>|Dict<StoredComposeDraftMeta>|Dict<StoredAdminCode>|SubscriptionAttempt|SubscriptionInfo|StoredAttestLog[];

interface RawStore {
    [key: string]: Storable;
}

interface BaseStore extends RawStore {
}

interface GlobalStore extends BaseStore {
    version?: number|null;
    account_emails?: string; // stringified array
    errors?: string[];
    settings_seen?: boolean;
    hide_pass_phrases?: boolean;
    cryptup_account_email?: string|null;
    cryptup_account_uuid?: string|null;
    cryptup_account_subscription?: SubscriptionInfo|null;
    cryptup_account_verified?: boolean;
    dev_outlook_allow?: boolean;
    cryptup_subscription_attempt?: SubscriptionAttempt;
    admin_codes?: Dict<StoredAdminCode>;
}

interface AccountStore extends BaseStore {
    keys?: KeyInfo[];
    notification_setup_needed_dismissed?: boolean;
    email_provider?: EmailProvider;
    google_token_access?: string;
    google_token_expires?: number;
    google_token_scopes?: string[];
    google_token_refresh?: string;
    hide_message_password?: boolean; // is global?
    addresses?: string[];
    addresses_pks?: string[];
    addresses_keyserver?: string[];
    email_footer?: string|null;
    drafts_reply?: Dict<StoredReplyDraftMeta>;
    drafts_compose?: Dict<StoredComposeDraftMeta>;
    pubkey_sent_to?: string[];
    full_name?: string;
    cryptup_enabled?: boolean;
    setup_done?: boolean;
    setup_simple?: boolean;
    is_newly_created_key?: boolean;
    key_backup_method?: KeyBackupMethod;
    attests_requested?: string[]; // attester names
    attests_processed?: string[]; // attester names
    key_backup_prompt?: number|false;
    successfully_received_at_leat_one_message?: boolean;
    notification_setup_done_seen?: boolean;
    attest_log?: StoredAttestLog[];

    // temporary
    tmp_submit_main?: boolean;
    tmp_submit_all?: boolean;
}

type CryptoArmorHeaderDefinition = {begin: string, middle?: string, end: string|RegExp, replace: boolean};
type CryptoArmorHeaderDefinitions = {
    readonly [type in ReplaceableMessageBlockType|'null']: CryptoArmorHeaderDefinition;
};

type KeyImportUiCheckResult = {normalized: string, longid: string, passphrase: string, fingerprint: string, decrypted: OpenPGP.key.Key, encrypted: OpenPGP.key.Key};

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
