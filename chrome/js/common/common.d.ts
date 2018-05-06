interface BrowserWidnow extends Window {
    XMLHttpRequest: any,
    onunhandledrejection: (e) => void,
}

interface FlowCryptWindow extends BrowserWidnow {
    catcher: any,
    openpgp: any,
    jQuery: JQuery,
    flowcrypt_attach: any,
    flowcrypt_storage: any,
    lang: any,
    iso88592: any,
    is_bare_engine: boolean,
}

interface FlowCryptManifest {
    oauth2: {client_id:string, url_code:string, url_tokens:string, url_redirect:string, state_header:string, scopes:string[]}
}
  
interface SelectorCacher {
    cached: (name: string) => JQuery,
    now: (name: string) => JQuery,
}

interface Contact {
    email: string,
    name: string | null,
    pubkey: string,
    has_pgp: boolean,
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
