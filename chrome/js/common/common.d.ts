

interface BrowserWidnow extends Window {
    XMLHttpRequest: any,
    onunhandledrejection: (e: any) => void,
}

interface FlowCryptWindow extends BrowserWidnow {
    jQuery: JQuery,
    flowcrypt_attach: any,
    flowcrypt_storage: {
        keys_get: ((account_email: string, longid?: string) => Promise<KeyInfo[]|KeyInfo>),
        get: (account_email: string|null, items: string[], cb: (s: StorageResult) => void) => void,
        set: (account_email: string|null, items: Dict<Serializable>, cb?: () => void) => void,
        auth_info: (cb: (registered_email: string|null, registered_uuid: string|null, already_verified: boolean) => void) => void,
        account_emails_get: (cb: (emails: string[]) => void) => void,
        subscription: (cb: (stored_level: 'pro'|null, stored_expire:string, stored_active: boolean, stored_method: 'stripe'|'trial'|'group') => void) => void,
        passphrase_get: (account_email: string, longid: string) => Promise<string|null>,
        db_contact_get: (db: null, longids: string[], cb: (contacts: Contact[]) => void) => void,
    },
    lang: any,
    iso88592: any,
    is_bare_engine: boolean,
    openpgp: any,
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
    content?: string|Uint8Array,
    data?: string, // todo - deprecate this - only use content
    size: number,
    url?: string|null,
    inline?: boolean,
    message_id?: string,
    treat_as?: 'hidden'|'signature'|'message'|'encrypted'|'public_key'|'standard',
    id?: string,
}

interface Headers {
    [key: string]: string,
}

interface FromToHeaders {
    from: string,
    to: string[],
}

interface PubkeySearchResult {
    email: string,
    pubkey: string|null,
    has_pgp: boolean|null,
    client: string|null,
    attested: boolean|null,
}

interface Challenge {
    question?: string,
    answer: string,
}

interface Dict<T> {
    [key: string]: T;
}

interface PreventableEvent {
    name: "double"|"parallel"|"spree"|"slowspree"|"veryslowspree",
    id: string,
}

interface OpenpgpDecryptResult {
    data: string|Uint8Array,
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

interface Decrypted { // todo - should differentiate between DecryptSuccess and DecryptError
    success: boolean,
    signature: MessageVerifyResult|null,
    encrypted?: boolean|null,
    content?: OpenpgpDecryptResult,
    counts?: DecryptedErrorCounts, 
    unsecure_mdc?: boolean,
    encrypted_for?: string[],
    missing_passphrases?: string[],
    errors?: string[],
    format_error?: string,
    message?: OpenpgpMessage,
}

interface OpenpgpEncryptResult {
    data: string|Uint8Array,
}

interface NamedFunctionsObject {
    [key: string]: (...args: any[]) => any,
}

type UrlParam = string|number|null|undefined|boolean;

interface UrlParams {
    [key: string]: UrlParam,
}

interface KeyInfo {
    public: string,
    private: string,
    fingerprint: string,
    longid: string,
    decrypted?: OpenpgpKey,
}

interface MimeContent {
    headers: Headers,
    attachments: Attachment[],
    signature: string|undefined,
    html: string|undefined,
    text: string|undefined,
}

interface MimeAsHeadersAndBlocks {
    headers: Headers,
    blocks: MessageBlock[],
}

type MessageBlockType = "text"|"public_key"|"private_key"|"attest_packet"|"cryptup_verification"|"signed_message"|"message"|"password_message";

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
}

interface OpenpgpMessage {
    getEncryptionKeyIds: () => string[],
    getSigningKeyIds: () => string[],
    text?: string,
}

interface MessageVerifyResult {
    signer: string,
    contact: Contact|null,
    match: boolean, 
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
    headers: Headers,
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

type FlatTypes = null|undefined|number|string|boolean;
type Serializable = FlatTypes|FlatTypes[]|Dict<FlatTypes>|Dict<FlatTypes>[]
type StorageResult = Dict<Serializable>
type Callback = (r?: any) => void;
type BrowserMessageHandler = (message: Dict<any>, sender: chrome.runtime.MessageSender|"background", respond: Callback) => void;
type EncryptDecryptOutputFormat = 'utf8'|'binary';
type Options = Dict<any>;

type FlowCryptApiAuthToken = {account: string, token: string};
type FlowCryptApiAuthMethods = 'uuid'|FlowCryptApiAuthToken|null;
type ApiCallback = (ok: boolean, result: Dict<any>|string) => void;
type ApiCallFormat = 'JSON'|'FORM';
type ApiCallProgressCallback = (percent: number, loaded?: number, total?: number) => void;
type ApiCallProgressCallbacks = {upload?: ApiCallProgressCallback, download?: ApiCallProgressCallback};
type ApiCallMethod = 'POST'|'GET'|'DELETE'|'PUT';
type ApiResponseFormat = 'json';
type GmailApiResponseFormat = "raw"|"full"|'metadata';