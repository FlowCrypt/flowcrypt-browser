

interface BrowserWidnow extends Window {
    XMLHttpRequest: any,
    onunhandledrejection: (e: any) => void,
}

type ContactFilter = { has_pgp: boolean }

interface FlowCryptWindow extends BrowserWidnow {
    jQuery: JQuery,
    $: JQuery,
    flowcrypt_attach: {
        init: Function,
    },
    flowcrypt_compose: any,
    flowcrypt_storage: {
        keys_get: ((account_email: string, longid?: string) => Promise<KeyInfo[]|KeyInfo>),
        get: (account_email: string|string[]|null, items: string[], cb: (s: StorageResult) => void) => void,
        set: (account_email: string|null, items: Dict<Serializable>, cb?: Callback) => void,
        auth_info: (cb: (registered_email: string|null, registered_uuid: string|null, already_verified: boolean) => void) => void,
        account_emails_get: (cb: (emails: string[]) => void) => void,
        subscription: (cb: (stored_level: 'pro'|null, stored_expire:string, stored_active: boolean, stored_method: 'stripe'|'trial'|'group') => void) => void,
        passphrase_get: (account_email: string, longid: string) => Promise<string|null>,
        db_contact_get: (db: null, longids: string[]|string, cb: (contacts: Contact[]|Contact) => void) => void,
        db_open: (cb: (db: IDBDatabase|null|false) => void) => void,
        db_contact_object: (email: string, name: string|null, client: string, pubkey: string, attested: boolean|null, pending_lookup:boolean, last_use: number) => Contact,
        db_contact_save: (db: IDBDatabase|null, contacts: Contact[]|Contact, callback: Callback) => void,
        db_contact_search: (db: IDBDatabase|null, filter: ContactFilter, cb: Callback) => void,
        session_set: (account_email: string, key: string, value: string|undefined) => Promise<string|undefined>,
        session_get: (account_email: string, key: string) => Promise<string|undefined>,
        remove: (account_email: string|null, key_or_keys: string|string[], callback?: Callback) => void,
        key: (account_key_or_list: string|string[], key: string|string[]) => string|string[],
        account_emails_add: (email: string, callback?: Callback) => void,
        keys_remove: (account_email: string, longid: string) => Promise<void>,
        passphrase_save: (type: StorageType, account_email: string, longid: string, passphrase: string|undefined) => Promise<void>,
        keys_add: (account_email: string, armored_prv: string) => Promise<void>,
    },
    lang: any,
    iso88592: any,
    is_bare_engine: boolean,
    openpgp: any,
    flowcrypt_account: any,
}

interface ContentScriptWindow extends FlowCryptWindow {
    TrySetDestroyableTimeout: (code: Function, ms: number) => number,
    TrySetDestroyableInterval: (code: Function, ms: number) => number,
    injected: true; // background script will use this to test if scripts were already injected, and inject if not
    account_email_global: null|string; // used by background script
    same_world_global: true; // used by background_script
    destruction_event: string;
    destroyable_class: string;
    reloadable_class: string;
    destroyable_intervals: number[];
    destroyable_timeouts: number[];
    destroy: () => void,
    vacant: () => boolean;
}

interface FlowCryptManifest {
    oauth2: {client_id:string, url_code:string, url_tokens:string, url_redirect:string, state_header:string, scopes:string[]},
}
  
interface SelectorCacher {
    cached: (name: string) => JQuery,
    now: (name: string) => JQuery,
}

interface Contact {
    email: string,
    name: string | null,
    pubkey: string,
    has_pgp: 0|1,
    searchable: string[],
    client: string | null,
    attested: boolean | null,
    fingerprint: string | null,
    longid: string | null,
    keywords: string | null,
    pending_lookup: number,
    last_use: number | null,
    date: number | null, // todo - should be removed. email provider search seems to return this?
}

interface Attachment {
    name: string, 
    type: string, 
    content?: string|Uint8Array|null,
    data?: string, // todo - deprecate this - only use content
    size: number,
    url?: string|null,
    inline?: boolean,
    message_id?: string,
    treat_as?: 'hidden'|'signature'|'message'|'encrypted'|'public_key'|'standard',
    id?: string,
}

interface FromToHeaders {
    from: string,
    to: string[],
}

interface PubkeySearchResult {
    email: string,
    pubkey: string|null,
    has_pgp: boolean|null,
    client: string|null, // todo - really?
    attested: boolean|null,
    has_cryptup: boolean|null,
}

interface Challenge {
    question?: string,
    answer: string,
}

interface Dict<T> {
    [key: string]: T;
}

type FlatHeaders = Dict<string>;
type RichHeaders = Dict<string|string[]>;


interface PreventableEvent {
    name: 'double'|'parallel'|'spree'|'slowspree'|'veryslowspree',
    id: string,
}

interface OpenpgpDecryptResult {
    data: string|Uint8Array,
    filename?: string,
}

interface DecryptedErrorCounts {
    decrypted: number,
    potentially_matching_keys: number,
    rounds: number,
    attempts: number,
    key_mismatch: number,
    wrong_password: number,
    unsecure_mdc: number,
    format_errors: number,
}

interface Decrypted {
}

interface DecryptSuccess extends Decrypted {
    success: true,
    content: OpenpgpDecryptResult,
    signature: MessageVerifyResult|null,
    encrypted: boolean|null,
}

interface DecryptError extends Decrypted {
    success: false,
    counts: DecryptedErrorCounts, 
    unsecure_mdc?: boolean,
    errors: string[],
    missing_passphrases?: string[],
    format_error?: string,
    encrypted: null|boolean,
    encrypted_for?: string[],
    signature: null,
    message?: OpenpgpMessage,
}

interface OpenpgpEncryptResult {
    data: string|Uint8Array,
    message: {
        packets: {
            write: () => Uint8Array,
        }
    },
}

type NamedFunctionsObject = Dict<(...args: any[]) => any>;
type UrlParam = string|number|null|undefined|boolean|string[];
type UrlParams = Dict<UrlParam>;

interface KeyInfo {
    public: string,
    private: string,
    fingerprint: string,
    longid: string,
    primary: boolean,
    decrypted?: OpenpgpKey,
}

interface MimeContent {
    headers: FlatHeaders,
    attachments: Attachment[],
    signature: string|undefined,
    html: string|undefined,
    text: string|undefined,
}

interface MimeAsHeadersAndBlocks {
    headers: FlatHeaders,
    blocks: MessageBlock[],
}

type MessageBlockType = 'text'|'public_key'|'private_key'|'attest_packet'|'cryptup_verification'|'signed_message'|'message'|'password_message';

interface MessageBlock {
    type: MessageBlockType, 
    content: string, 
    complete: boolean,
    signature?: string,
}

interface MimeParserNode {
    path: string[],
    headers: {
        [key: string]: {value: string}[],
    },
    rawContent: string,
    content: Uint8Array,
    appendChild: (child: MimeParserNode) => void,
}

interface OpenpgpKey {
    primaryKey: any,
    getEncryptionKeyPacket: () => any|null,
    verifyPrimaryKey: () => number,
    subKeys: any[],
    decrypt: (pp: string) => boolean,
    armor: () => string,
    isPrivate: () => boolean,
    toPublic: () => OpenpgpKey,
    getAllKeyPackets: () => any[],
    getSigningKeyPacket: () => any,
    users:  Dict<any>[],
}

interface OpenpgpMessage {
    getEncryptionKeyIds: () => string[],
    getSigningKeyIds: () => string[],
    text?: string,
}

interface MessageVerifyResult {
    signer: string|null,
    contact: Contact|null,
    match: boolean|null, 
    error: null|string,
}

interface InternalSortedKeysForDecrypt {
    verification_contacts: Contact[],
    for_verification: OpenpgpKey[],
    encrypted_for: string[],
    signed_by: string[],
    potentially_matching: KeyInfo[],
    with_passphrases: KeyInfo[],
    without_passphrases: KeyInfo[],
}

interface SendableMessageBody {
    'text/plain'?: string,
    'text/html'?: string,
}

interface SendableMessage {
    headers: FlatHeaders,
    from: string,
    to: string[],
    subject: string,
    body: SendableMessageBody,
    attachments: Attachment[],
    thread: string|null,
}

interface StandardError {
    internal: string|null,
    message: string,
    code: number|null,
}

interface AuthRequest {
    tab_id?: string,
    account_email: string,
    scopes?: string[],
    message_id?: string,
    auth_responder_id?: string,
    omit_read_scope?: boolean,
}

type WebMailName = 'gmail'|'outlook'|'inbox';
type PassphraseDialogType = 'embedded'|'sign'|'attest';
type Placement = 'settings'|'settings_compose'|'default'|'dialog'|'gmail'|'embedded';
type FlatTypes = null|undefined|number|string|boolean;
type SerializableTypes = FlatTypes|string[]|number[]|boolean[]|SubscriptionInfo;
type Serializable = SerializableTypes|SerializableTypes[]|Dict<SerializableTypes>|Dict<SerializableTypes>[];
type StorageResult = Dict<Serializable>;
type Callback = (r?: any) => void;
type BrowserMessageHandler = (request: Dict<any>|null, sender: chrome.runtime.MessageSender|'background', respond: Callback) => void;
type EncryptDecryptOutputFormat = 'utf8'|'binary';
type Options = Dict<any>;

type LongidToMnemonic = (longid: string) => string;
type FlowCryptApiAuthToken = {account: string, token: string};
type FlowCryptApiAuthMethods = 'uuid'|FlowCryptApiAuthToken|null;
type ApiCallback = (ok: boolean, result: Dict<any>|string|null) => void;
type ApiCallFormat = 'JSON'|'FORM';
type ApiCallProgressCallback = (percent: number|null, loaded?: number, total?: number) => void;
type ApiCallProgressCallbacks = {upload?: ApiCallProgressCallback, download?: ApiCallProgressCallback};
type ApiCallMethod = 'POST'|'GET'|'DELETE'|'PUT';
type ApiResponseFormat = 'json';
type GmailApiResponseFormat = 'raw'|'full'|'metadata';
type NamedSelectors = Dict<JQuery<HTMLElement>>;
type SelectorCache = {
    cached: (name: string) => JQuery<HTMLElement>,
    now: (name: string) => JQuery<HTMLElement>,
    selector: (name: string) => string,
}
type StorageType = 'session'|'local';
type EmailProvider = 'gmail';

type WebmailVariantObject = {new_data_layer: null|boolean, new_ui: null|boolean, email: null|string, gmail_variant: WebmailVariantString}
type WebmailVariantString = null|'html'|'standard'|'new';
type WebmailSpecificInfo = {
    name: WebMailName,
    variant: WebmailVariantString,
    get_user_account_email: () => string|undefined,
    get_user_full_name: () => string|undefined,
    get_replacer: () => WebmailElementReplacer,
    start: (account_email: string, inject: Injector, notifications: Notifications, factory: Factory, notify_murdered: Callback) => void,
}
interface WebmailElementReplacer {
    everything: () => void,
    set_reply_box_editable: () => void,
    reinsert_reply_box: (subject: string, my_email: string, reply_to: string[], thread_id: string) => void,
}

interface JQueryStatic {
    featherlight: Function,
}

interface JQuery {
    featherlight: Function,
}

type AttachLimits = {count?: number, size?: number, size_mb?: number, oversize?: (new_file_size: number) => void}

type PromiseFactory<T> = () => T | PromiseLike<T>;

interface PromiseConstructor {
    sequence<T>(promise_factories: PromiseFactory<T>[]): Promise<T[]>;
}

// interface Promise<T> {
//     done<T>(callback: (success: boolean, result: T) => void): void;
//     validate<T>(validator: (result: T) => boolean): Promise<T>;
// }

interface SubscriptionInfo {
    active: boolean|null;
    method: 'stripe'|'group'|'trial'|null;
    level: 'pro'|null,
  }