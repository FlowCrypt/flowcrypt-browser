/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { AbstractStore } from './abstract-store.js';
import { Catch } from '../catch.js';
import { BrowserMsg } from '../../browser/browser-msg.js';
import { DateUtility, EmailParts, Str, Value } from '../../core/common.js';
import { Key, KeyUtil, PubkeyInfo, ContactInfoWithSortedPubkeys, KeyIdentity } from '../../core/crypto/key.js';

/* eslint-disable no-null/no-null */

export type Email = {
  email: string;
  name: string | null;
  searchable: string[];
  fingerprints: string[];
  lastUse: number | null;
};

export type Pubkey = {
  fingerprint: string;
  armoredKey: string;
  longids: string[];
  lastCheck: number | null;
  expiresOn: number | null;
};

type Revocation = {
  fingerprint: string;
};

type PubkeyAttributes = {
  fingerprint: string | null;
  expiresOn: number | null;
};

export type ContactPreview = EmailParts & {
  hasPgp: boolean;
  pgpLoading?: Promise<boolean> | undefined;
  lastUse: number | null;
};

export type ContactUpdate = {
  name?: string | null;
  lastUse?: number | null;
  pubkey?: Key | string;
  pubkeyLastCheck?: number | null; // when non-null, `pubkey` must be supplied
};

type ContactUpdateParsed = {
  name?: string | null;
  lastUse?: number | null;
  pubkey?: Key;
  pubkeyLastCheck?: number | null; // when non-null, `pubkey` must be supplied
};

type DbContactFilter = { hasPgp?: boolean; substring?: string; limit?: number };

const x509postfix = '-X509';

/**
 * Store of contacts and their public keys
 * This includes an index of email and name substrings for easier search when user is typing
 * Db is initialized in the background page and accessed through BrowserMsg
 */
export class ContactStore extends AbstractStore {
  // static [f: string]: Function; // https://github.com/Microsoft/TypeScript/issues/6480

  private static dbQueryKeys = ['limit', 'substring', 'hasPgp'];

  // Taken from https://github.com/derhuerst/email-providers
  private static commonDomains = new Set([
    'facebook.com',
    'yahoo.com',
    'qq.com',
    'msn.com',
    'live.com',
    'go.com',
    'outlook.com',
    'aol.com',
    'free.fr',
    'about.com',
    '163.com',
    'indiatimes.com',
    'yandex.ru',
    'example.com',
    'alibaba.com',
    'geocities.com',
    'yahoo.co.jp',
    'aliyun.com',
    'netscape.com',
    'sky.com',
    'earthlink.net',
    'naver.com',
    'angelfire.com',
    'mail.ru',
    'medscape.com',
    'spb.ru',
    'uol.com.br',
    'discovery.com',
    'gmail.com',
    'zoho.com',
    'globo.com',
    'space.com',
    'frontier.com',
    'icloud.com',
    'homestead.com',
    'mac.com',
    'pp.ua',
    'bt.com',
    'yandex.com',
    't-online.de',
    'lycos.com',
    'altavista.com',
    'comcast.net',
    'orange.fr',
    'web.id',
    'msk.ru',
    'ancestry.com',
    'nus.edu.sg',
    'att.net',
    'rambler.ru',
    'sapo.pt',
    'icq.com',
    'kansascity.com',
    'law.com',
    'me.com',
    'daum.net',
    'libero.it',
    'india.com',
    'canada.com',
    'hotmail.com',
    'berlin.de',
    'test.com',
    'techspot.com',
    'excite.co.jp',
    'wanadoo.fr',
    'onet.pl',
    'fortunecity.com',
    'zp.ua',
    'skynet.be',
    'care2.com',
    'terra.com.br',
    'telenet.be',
    'sina.cn',
    'wp.pl',
    'shaw.ca',
    'excite.com',
    'compuserve.com',
    'sina.com',
    'interia.pl',
    'web.de',
    'docomo.ne.jp',
    'geek.com',
    'ig.com.br',
    'mindspring.com',
    'freeserve.co.uk',
    'ntlworld.com',
    'virginmedia.com',
    'virgilio.it',
    'rr.com',
    'sympatico.ca',
    'detik.com',
    'tiscali.it',
    'doityourself.com',
    'chez.com',
    'tom.com',
    'xoom.com',
    'iinet.net.au',
    'arcor.de',
    'gazeta.pl',
    'sfr.fr',
    'catholic.org',
    'cox.net',
    'rcn.com',
    'freenet.de',
    'yourdomain.com',
    'blueyonder.co.uk',
    'yam.com',
    'aol.co.uk',
    'protonmail.com',
    'ya.ru',
    'gmx.net',
    'blackplanet.com',
    'test.de',
    'albawaba.com',
    'pochta.ru',
    'r7.com',
    'rogers.com',
    'verizon.net',
    'btinternet.com',
    '21cn.com',
    'ireland.com',
    'name.com',
    'anonymize.com',
    'online.de',
    'ozemail.com.au',
    'lycos.co.uk',
    'sify.com',
    'virgin.net',
    'i.ua',
    'hotbot.com',
    'mail.com',
    'rin.ru',
    'www.com',
    'terra.es',
    'oath.com',
    'erols.com',
    'home.nl',
    'centrum.cz',
    'o2.co.uk',
    'seznam.cz',
    'parrot.com',
    'hidemyass.com',
    'charter.net',
    'lycos.de',
    'planet.nl',
    'myway.com',
    'chat.ru',
    'pe.hu',
    'voila.fr',
    'hamptonroads.com',
    'telus.net',
    'kiwibox.com',
    'ivillage.com',
    '126.com',
    'sanook.com',
    'walla.co.il',
    'tiscali.co.uk',
    'mydomain.com',
    'netcom.com',
    'bluewin.ch',
    'dailypioneer.com',
    'chello.nl',
    'tpg.com.au',
    'alice.it',
    'freeuk.com',
    'club-internet.fr',
    'sci.fi',
    'poste.it',
    'iespana.es',
    'optusnet.com.au',
    'gmx.com',
    'lycos.es',
    'webindia123.com',
    'metacrawler.com',
    'onmilwaukee.com',
    'freeyellow.com',
    'nate.com',
    'sweb.cz',
    'lycos.nl',
    'bugmenot.com',
    'bigpond.com',
    'prodigy.net',
    'usa.com',
    'eircom.net',
    'foxmail.com',
    'unican.es',
    'frontiernet.net',
    'looksmart.com',
    'wanadoo.es',
    'za.com',
    'terra.com',
    'ukr.net',
    'casino.com',
    'cogeco.ca',
    'inbox.com',
    'i.am',
    'mail2web.com',
    'neuf.fr',
    'aim.com',
    'pobox.com',
    'yahoo.co.uk',
    '10minutemail.com',
    'newmail.ru',
    'hetnet.nl',
    'crosswinds.net',
    'hot.ee',
    'pacbell.net',
    'yahoofs.com',
    'depechemode.com',
    'dmv.com',
    'mail-tester.com',
    'iol.it',
    'nyc.com',
    'dejanews.com',
    'netins.net',
    'supereva.it',
    'bangkok.com',
    'concentric.net',
    'mailinator.com',
    'yeah.net',
    'netspace.net.au',
    'yahoo.jp',
    'islamonline.net',
    'iprimus.com.au',
    'go.ro',
    'lycos.it',
    'sprynet.com',
    'hey.com',
    'o2.pl',
    'idirect.com',
    'talktalk.co.uk',
    'fr.nf',
    'doctor.com',
    'elvis.com',
    'zip.net',
    'spray.se',
    'wow.com',
    'scubadiving.com',
    'swissinfo.org',
    'bigfoot.com',
    'juno.com',
    'incredimail.com',
    'cu.cc',
    'starmedia.com',
    'sdf.org',
    'adelphia.net',
    'bellsouth.net',
    'yahoo.com.cn',
    'gportal.hu',
    'masrawy.com',
    'yahoo.fr',
    'bolt.com',
    'attbi.com',
    'bigpond.net.au',
    'terra.cl',
    'optimum.net',
    'zonnet.nl',
    'yahoo.de',
    'land.ru',
    'aeiou.pt',
    'msn.co.uk',
    'hushmail.com',
    'btconnect.com',
    'blogos.com',
    '37.com',
    'interfree.it',
    'thirdage.com',
    'ananzi.co.za',
    'saudia.com',
    'seanet.com',
    'montevideo.com.uy',
    '4mg.com',
    'telstra.com',
    'forthnet.gr',
    'gmx.de',
    'yahoo.com.tw',
    'westnet.com.au',
    'cableone.net',
    'ny.com',
    'c3.hu',
    'roadrunner.com',
    'spacewar.com',
    'netzero.net',
    'hispavista.com',
    'fastmail.fm',
    'sbcglobal.net',
    'temp-mail.org',
    'tds.net',
    'singpost.com',
    'singnet.com.sg',
    'guerrillamail.com',
    'sp.nl',
    'freeola.com',
    'cs.com',
    '123.com',
    'everyone.net',
    'oi.com.br',
    'tin.it',
    'mchsi.com',
    'terra.com.ar',
    'lawyer.com',
    'barcelona.com',
    'bright.net',
    'yahoo.com.br',
    'btopenworld.com',
    'iwon.com',
    'us.to',
    'front.ru',
    'webjump.com',
    'windstream.net',
    '3ammagazine.com',
    'talkcity.com',
    'excite.it',
    'dropzone.com',
    'qwest.net',
    'c2i.net',
    'airmail.net',
    'dnsmadeeasy.com',
    'maktoob.com',
    'games.com',
    'dynu.net',
    'recycler.com',
    'dog.com',
    'talktalk.net',
    'abv.bg',
    'ptd.net',
    'wowway.com',
    'asheville.com',
    'hotmail.ru',
    'yahoo.cn',
    'inbox.lv',
    'pipeline.com',
    'bellatlantic.net',
    'fuse.net',
    'bizhosting.com',
    'conexcol.com',
    'gocollege.com',
    'yahoo.es',
    'yahoo.ca',
    'zzn.com',
    'freeuk.net',
    'swbell.net',
    'go2net.com',
    'tiscali.be',
    'netscape.net',
    'beer.com',
    'windowslive.com',
    'bestweb.net',
    'epix.net',
    'enter.net',
    'garbage.com',
    'home.ro',
    'vnn.vn',
    'yopmail.com',
    'ymail.com',
  ]);

  public static async dbOpen(): Promise<IDBDatabase> {
    return await new Promise((resolve, reject) => {
      const openDbReq = indexedDB.open('cryptup', 5);
      openDbReq.onupgradeneeded = event => {
        const db = openDbReq.result;
        if (event.oldVersion < 4) {
          const emails = db.createObjectStore('emails', { keyPath: 'email' });
          const pubkeys = db.createObjectStore('pubkeys', { keyPath: 'fingerprint' });
          emails.createIndex('search', 'searchable', { multiEntry: true });
          emails.createIndex('index_fingerprints', 'fingerprints', { multiEntry: true }); // fingerprints of all connected pubkeys
          pubkeys.createIndex('index_longids', 'longids', { multiEntry: true }); // longids of all public key packets in armored pubkey
        }
        if (event.oldVersion < 5) {
          db.createObjectStore('revocations', { keyPath: 'fingerprint' });
        }
        if (db.objectStoreNames.contains('contacts')) {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const countRequest = openDbReq.transaction!.objectStore('contacts').count();
          ContactStore.setReqPipe(countRequest, (count: number) => {
            if (count === 0) {
              console.info('contacts store is now empty, deleting it...');
              db.deleteObjectStore('contacts');
            }
          });
        }
      };
      openDbReq.onsuccess = () => {
        resolve(openDbReq.result);
      };
      openDbReq.onblocked = () => {
        reject(ContactStore.errCategorize(openDbReq.error));
      };
      openDbReq.onerror = () => {
        reject(ContactStore.errCategorize(openDbReq.error));
      };
    });
  }

  /**
   * Used to update certain fields of existing contacts or create new contacts using the provided data.
   * If an array of emails is provided, the update operation will be performed independently on each of them.
   * Null or missing properties from the `update` object will not be overwritten in the database,
   * The `pubkey` property will be used only to add or update a pubkey record by the pubkey fingerprint.
   * Null value of `pubkey` won't affect any pubkey records.
   * The `pubkeyLastCheck` property can be set to a non-null value only when `pubkey` specified
   * and will be applied only to that specific pubkey record. Missing or null `pubkeyLastCheck` will
   * leave the `pubkeyLastCheck` value of the existing pubkey unchanged.
   *
   * @param {IDBDatabase} db                     (optional) database to use
   * @param {string | string[]} email            a single email or an array of emails
   * @param {ContactUpdate} update               object containing fields to be updated
   * @returns {Promise<void>}
   *
   * @async
   * @static
   */
  public static async update(db: IDBDatabase | undefined, email: string | string[], update: ContactUpdate): Promise<void> {
    if (!db) {
      // relay op through background process
      if (update.pubkey && typeof update.pubkey !== 'string') {
        KeyUtil.pack(update.pubkey);
      }
      await BrowserMsg.send.bg.await.db({ f: 'update', args: [email, update] });
      return;
    }
    if (Array.isArray(email)) {
      await Promise.all(email.map(oneEmail => ContactStore.update(db, oneEmail, update)));
      return;
    }
    const validEmail = Str.parseEmail(email).email;
    if (!validEmail) {
      throw Error(`Cannot update contact because email is not valid: ${email}`);
    }
    let pubkey = typeof update.pubkey === 'string' ? await KeyUtil.parse(update.pubkey) : update.pubkey;
    if (pubkey?.isPrivate) {
      Catch.report(`Wrongly updating prv ${pubkey.id} as contact - converting to pubkey`);
      pubkey = await KeyUtil.asPublicKey(pubkey);
    }
    const tx = db.transaction(['emails', 'pubkeys', 'revocations'], 'readwrite');
    await new Promise((resolve, reject) => {
      ContactStore.setTxHandlers(tx, resolve, reject);
      ContactStore.updateTx(tx, validEmail, { ...update, pubkey });
    });
  }

  public static async getEncryptionKeys(db: undefined | IDBDatabase, emails: string[]): Promise<{ email: string; keys: Key[] }[]> {
    if (!db) {
      // relay op through background process
      return (await BrowserMsg.send.bg.await.db({ f: 'getEncryptionKeys', args: [emails] })) as {
        email: string;
        keys: Key[];
      }[];
    }
    if (emails.length === 1) {
      const email = emails[0];
      const contact = await ContactStore.getOneWithAllPubkeys(db, email);
      const keys = (contact?.sortedPubkeys ?? [])
        .filter(k => !k.revoked && (k.pubkey.usableForEncryption || k.pubkey.usableForEncryptionButExpired))
        .map(k => k.pubkey);
      for (const key of keys) {
        KeyUtil.pack(key);
      }
      return [{ email, keys }];
    } else {
      return (await Promise.all(emails.map(email => ContactStore.getEncryptionKeys(db, [email])))).reduce((a, b) => a.concat(b));
    }
  }

  public static async search(db: IDBDatabase | undefined, query: DbContactFilter): Promise<ContactPreview[]> {
    return (await ContactStore.rawSearch(db, query)).filter(Boolean).map(ContactStore.toContactPreview);
  }

  public static async searchPubkeys(db: IDBDatabase | undefined, query: DbContactFilter): Promise<string[]> {
    const fingerprints = (await ContactStore.rawSearch(db, query))
      .filter(Boolean)
      .map(email => email.fingerprints)
      .reduce((a, b) => a.concat(b));
    return (await ContactStore.extractPubkeys(db, fingerprints)).map(pubkey => pubkey.armoredKey).filter(Boolean);
  }

  public static async getOneWithAllPubkeys(db: IDBDatabase | undefined, email: string): Promise<ContactInfoWithSortedPubkeys | undefined> {
    if (!db) {
      // relay op through background process
      // eslint-disable-next-line
      return await BrowserMsg.send.bg.await.db({ f: 'getOneWithAllPubkeys', args: [email] });
    }
    const tx = db.transaction(['emails', 'pubkeys', 'revocations'], 'readonly');
    const pubkeys: Pubkey[] = [];
    const revocations: Revocation[] = [];
    const emailEntity: Email | undefined = await new Promise((resolve, reject) => {
      const req = tx.objectStore('emails').get(email);
      ContactStore.setReqPipe(
        req,
        (email: Email | undefined) => {
          if (!email) {
            resolve(undefined);
            return;
          }
          if (!email.fingerprints || email.fingerprints.length === 0) {
            resolve(email);
            return;
          }
          // fire requests to query pubkeys and revocations
          // when all of them finish, the transaction will complete
          ContactStore.setTxHandlers(
            tx,
            () => {
              resolve(email);
            },
            reject
          );
          // request all pubkeys by fingerprints
          for (const fp of email.fingerprints) {
            const req2 = tx.objectStore('pubkeys').get(fp);
            ContactStore.setReqPipe(req2, (pubkey: Pubkey | undefined) => {
              if (pubkey) {
                pubkeys.push(pubkey);
              }
            });
          }
          // fire requests to collect revocations
          ContactStore.collectRevocations(tx, revocations, email.fingerprints);
        },
        reject
      );
    });
    const sortedPubkeys = await ContactStore.sortKeys(pubkeys, revocations);
    for (const pubkeyInfo of sortedPubkeys) {
      KeyUtil.pack(pubkeyInfo.pubkey);
    }
    return emailEntity
      ? {
          info: { email: emailEntity.email, name: emailEntity.name ?? undefined },
          sortedPubkeys,
        }
      : undefined;
  }

  // todo: return parsed and with applied revocation
  public static async getPubkey(db: IDBDatabase | undefined, { id, family }: KeyIdentity): Promise<string | undefined> {
    if (!db) {
      // relay op through background process
      return (await BrowserMsg.send.bg.await.db({ f: 'getPubkey', args: [{ id, family }] })) as string | undefined;
    }
    const internalFingerprint = ContactStore.getPubkeyId({ id, family });
    const tx = db.transaction(['pubkeys'], 'readonly');
    const pubkeyEntity: Pubkey = await new Promise((resolve, reject) => {
      const req = tx.objectStore('pubkeys').get(internalFingerprint);
      ContactStore.setReqPipe(req, resolve, reject);
    });
    return pubkeyEntity.armoredKey;
  }

  public static async unlinkPubkey(db: IDBDatabase | undefined, email: string, { id, family }: KeyIdentity): Promise<void> {
    if (!db) {
      // relay op through background process
      await BrowserMsg.send.bg.await.db({ f: 'unlinkPubkey', args: [email, { id, family }] });
      return;
    }
    const internalFingerprint = ContactStore.getPubkeyId({ id, family });
    const tx = db.transaction(['emails', 'pubkeys'], 'readwrite');
    await new Promise((resolve, reject) => {
      ContactStore.setTxHandlers(tx, resolve, reject);
      const req = tx.objectStore('emails').index('index_fingerprints').getAll(internalFingerprint);
      ContactStore.setReqPipe(req, (referencingEmails: Email[]) => {
        for (const entity of referencingEmails.filter(e => e.email === email)) {
          entity.fingerprints = entity.fingerprints.filter(fp => fp !== internalFingerprint);
          ContactStore.updateSearchable(entity);
          tx.objectStore('emails').put(entity);
        }
        if (!referencingEmails.some(e => e.email !== email)) {
          tx.objectStore('pubkeys').delete(internalFingerprint);
        }
      });
    });
  }

  public static updateTx(tx: IDBTransaction, email: string, update: ContactUpdateParsed) {
    if (update.pubkey && !update.pubkeyLastCheck) {
      const req = tx.objectStore('pubkeys').get(ContactStore.getPubkeyId(update.pubkey));
      ContactStore.setReqPipe(req, (pubkey: Pubkey) => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const range = ContactStore.createFingerprintRange(update.pubkey!.id);
        const req2 = tx.objectStore('revocations').getAll(range);
        ContactStore.setReqPipe(req2, (revocations: Revocation[]) => {
          ContactStore.updateTxPhase2(tx, email, update, pubkey, revocations);
        });
      });
    } else {
      ContactStore.updateTxPhase2(tx, email, update, undefined, []);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  public static setReqPipe<T>(req: IDBRequest, pipe: (value?: T) => void, reject?: (reason?: unknown) => void) {
    req.onsuccess = () => {
      try {
        pipe(req.result as T);
      } catch (codeErr) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        req.transaction!.dispatchEvent(new ErrorEvent('error'));
        if (reject) {
          reject(codeErr);
        }
        Catch.reportErr(codeErr);
      }
    };
    if (reject) {
      this.setReqOnError(req, reject);
    }
  }

  public static pubkeyObj(pubkey: Key, lastCheck: number | null | undefined): Pubkey {
    const keyAttrs = ContactStore.getKeyAttributes(pubkey);
    return {
      fingerprint: ContactStore.getPubkeyId(pubkey),
      lastCheck: DateUtility.asNumber(lastCheck),
      expiresOn: keyAttrs.expiresOn,
      longids: KeyUtil.getPubkeyLongids(pubkey),
      armoredKey: KeyUtil.armor(pubkey),
    };
  }

  public static revocationObj(pubkey: Key): { fingerprint: string; armoredKey: string } {
    return { fingerprint: ContactStore.getPubkeyId(pubkey), armoredKey: KeyUtil.armor(pubkey) };
    // todo: we can add a timestamp here and/or some other info
  }

  /**
   * Saves only revocation info (to protect against re-importing an older version of OpenPGP key)
   *
   * @param {IDBDatabase} db  (optional) database to use
   * @param {Key} pubkey      a revoked key
   * @returns {Promise<void>}
   *
   * @async
   * @static
   */
  public static async saveRevocation(db: IDBDatabase | undefined, pubkey: Key): Promise<void> {
    if (!pubkey.revoked) {
      throw new Error('Non-revoked key is supplied to save revocation info');
    }
    if (!db) {
      // relay op through background process
      KeyUtil.pack(pubkey);
      await BrowserMsg.send.bg.await.db({ f: 'saveRevocation', args: [pubkey] });
      return;
    }
    const tx = db.transaction(['revocations'], 'readwrite');
    await new Promise((resolve, reject) => {
      ContactStore.setTxHandlers(tx, resolve, reject);
      tx.objectStore('revocations').put(ContactStore.revocationObj(pubkey));
    });
  }

  // construct PubkeyInfo objects out of provided keys and revocation data in the database
  // the keys themselves may not be necessarily present in the database
  public static async getPubkeyInfos(db: IDBDatabase | undefined, keys: string[]): Promise<PubkeyInfo[]> {
    if (!db) {
      // relay op through background process
      return (await BrowserMsg.send.bg.await.db({ f: 'getPubkeyInfos', args: [keys] })) as PubkeyInfo[];
    }
    const parsedKeys = await Promise.all(keys.map(async key => await KeyUtil.asPublicKey(await KeyUtil.parse(key))));
    const unrevokedIds = parsedKeys.filter(key => !key.revoked).map(key => key.id);
    const revocations: Revocation[] = [];
    if (unrevokedIds.length) {
      // need to search for external revocations
      await new Promise((resolve, reject) => {
        const tx = db.transaction(['revocations'], 'readonly');
        ContactStore.setTxHandlers(tx, resolve, reject);
        ContactStore.collectRevocations(tx, revocations, unrevokedIds);
      });
    }
    for (const parsedKey of parsedKeys) {
      KeyUtil.pack(parsedKey);
    }
    return parsedKeys.map(key => {
      return {
        pubkey: key,
        revoked: key.revoked || revocations.some(r => ContactStore.equalFingerprints(key.id, r.fingerprint)),
      };
    });
  }

  public static updateSearchable(emailEntity: Email) {
    const email = emailEntity.email.toLowerCase();
    const name = emailEntity.name ? emailEntity.name.toLowerCase() : '';
    // we only need the longest word if it starts with a shorter one,
    // e.g. we don't need "flowcrypt" if we have "flowcryptcompatibility"
    // also, filter out top level domains from emails
    const emailTokens = Str.splitAlphanumericExtended(email)
      .slice(0, -1)
      .filter(s => !ContactStore.commonDomains.has(ContactStore.normalizeString(s)));
    const nameTokens = Str.splitAlphanumericExtended(name);
    const sortedNormalized = [...emailTokens, ...nameTokens]
      .filter(p => !!p)
      .map(ContactStore.normalizeString)
      .sort((a, b) => b.length - a.length);
    emailEntity.searchable = sortedNormalized
      .filter((value, index, self) => !self.slice(0, index).find(el => el.startsWith(value)))
      .map(normalized => ContactStore.dbIndex(emailEntity.fingerprints.length > 0, normalized));
  }

  private static async sortKeys(pubkeys: Pubkey[], revocations: Revocation[]): Promise<PubkeyInfo[]> {
    // parse the keys
    const pubkeyInfos = await Promise.all(
      pubkeys.map(async pubkey => {
        const pk = await KeyUtil.parse(pubkey.armoredKey);
        const revoked = pk.revoked || revocations.some(r => ContactStore.equalFingerprints(pk.id, r.fingerprint));
        return { lastCheck: pubkey.lastCheck ?? undefined, pubkey: pk, revoked };
      })
    );
    return KeyUtil.sortPubkeyInfos(pubkeyInfos);
  }

  private static getPubkeyId(keyIdentity: KeyIdentity): string {
    return keyIdentity.family === 'x509' ? keyIdentity.id + x509postfix : keyIdentity.id;
  }

  private static stripFingerprint(fp: string): string {
    return fp.endsWith(x509postfix) ? fp.slice(0, -x509postfix.length) : fp;
  }

  private static equalFingerprints(fp1: string, fp2: string): boolean {
    return (fp1.endsWith(x509postfix) ? fp1 : fp1 + x509postfix) === (fp2.endsWith(x509postfix) ? fp2 : fp2 + x509postfix);
  }

  private static createFingerprintRange(fp: string): IDBKeyRange {
    const strippedFp = ContactStore.stripFingerprint(fp);
    return IDBKeyRange.bound(strippedFp, strippedFp + x509postfix, false, false);
  }

  // fire requests to collect revocations
  private static collectRevocations(tx: IDBTransaction, revocations: Revocation[], fingerprints: string[]) {
    for (const fp of Value.arr.unique(fingerprints.map(ContactStore.stripFingerprint))) {
      const range = ContactStore.createFingerprintRange(fp);
      const req = tx.objectStore('revocations').getAll(range);
      ContactStore.setReqPipe(req, (revocation: Revocation[]) => {
        revocations.push(...revocation);
      });
    }
  }

  private static updateTxPhase2(tx: IDBTransaction, email: string, update: ContactUpdateParsed, existingPubkey: Pubkey | undefined, revocations: Revocation[]) {
    let pubkeyEntity: Pubkey | undefined;
    if (update.pubkey) {
      const internalFingerprint = ContactStore.getPubkeyId(update.pubkey);
      if (update.pubkey.family === 'openpgp' && !update.pubkey.revoked && revocations.some(r => r.fingerprint === internalFingerprint)) {
        // we have this fingerprint revoked but the supplied key isn't
        // so let's not save it
        // pubkeyEntity = undefined
      } else {
        pubkeyEntity = ContactStore.pubkeyObj(update.pubkey, update.pubkeyLastCheck ?? existingPubkey?.lastCheck);
      }
      if (update.pubkey.revoked && !revocations.some(r => r.fingerprint === internalFingerprint)) {
        tx.objectStore('revocations').put(ContactStore.revocationObj(update.pubkey));
      }
      // todo: will we benefit anything when not saving pubkey if it isn't modified?
    } else if (update.pubkeyLastCheck) {
      Catch.report(`Wrongly updating pubkeyLastCheck without specifying pubkey for ${email} - ignoring`);
    }
    const req = tx.objectStore('emails').get(email);
    ContactStore.setReqPipe(req, (emailEntity: Email | undefined) => {
      let updatedEmailEntity: Email | undefined;
      if (!emailEntity) {
        updatedEmailEntity = { email, name: null, searchable: [], fingerprints: [], lastUse: null };
      } else if (pubkeyEntity || update.name || update.lastUse) {
        updatedEmailEntity = emailEntity;
      } else {
        updatedEmailEntity = undefined; // not modified
      }
      if (updatedEmailEntity) {
        if (pubkeyEntity) {
          if (!updatedEmailEntity.fingerprints.includes(pubkeyEntity.fingerprint)) {
            updatedEmailEntity.fingerprints.push(pubkeyEntity.fingerprint);
          }
        }
        if (update.name) {
          updatedEmailEntity.name = update.name;
        }
        if (update.lastUse) {
          updatedEmailEntity.lastUse = DateUtility.asNumber(update.lastUse);
        }
        ContactStore.updateSearchable(updatedEmailEntity);
        tx.objectStore('emails').put(updatedEmailEntity);
      }
      if (pubkeyEntity) {
        tx.objectStore('pubkeys').put(pubkeyEntity);
      }
    });
  }

  private static chainExtraction(store: IDBObjectStore, setup: { keys: IDBValidKey[]; values: unknown[] }, req?: IDBRequest): void {
    if (req) {
      ContactStore.setReqPipe(req, (value: unknown) => {
        if (value) {
          setup.values.push(value);
        }
      });
    }
    const key = setup.keys.pop();
    if (key) {
      const reqNext = store.get(key);
      ContactStore.chainExtraction(store, setup, reqNext);
    }
  }

  private static async extractKeyset<T>(db: IDBDatabase, storeName: string, keys: IDBValidKey[], poolSize: number): Promise<T[]> {
    const tx = db.transaction([storeName], 'readonly');
    const setup = { keys, values: [] as T[] };
    await new Promise((resolve, reject) => {
      ContactStore.setTxHandlers(tx, resolve, reject);
      for (let poolCount = 0; poolCount < poolSize; poolCount++) {
        ContactStore.chainExtraction(tx.objectStore(storeName), setup);
      }
    });
    return setup.values;
  }

  private static async extractPubkeys(db: IDBDatabase | undefined, fingerprints: string[]): Promise<Pubkey[]> {
    if (!fingerprints.length) {
      return [];
    }
    if (!db) {
      // relay op through background process
      return (await BrowserMsg.send.bg.await.db({ f: 'extractPubkeys', args: [fingerprints] })) as Pubkey[];
    }
    return await ContactStore.extractKeyset(db, 'pubkeys', fingerprints, 10);
  }

  private static async rawSearch(db: IDBDatabase | undefined, query: DbContactFilter): Promise<Email[]> {
    if (!db) {
      // relay op through background process
      return (await BrowserMsg.send.bg.await.db({ f: 'rawSearch', args: [query] })) as Email[];
    }
    for (const key of Object.keys(query)) {
      if (!ContactStore.dbQueryKeys.includes(key)) {
        throw new Error('ContactStore.rawSearch: unknown key: ' + key);
      }
    }
    query.substring = ContactStore.normalizeString(query.substring || '');
    if (typeof query.hasPgp === 'undefined' && query.substring) {
      const resultsWithPgp = await ContactStore.rawSearch(db, {
        substring: query.substring,
        limit: query.limit,
        hasPgp: true,
      });
      if (query.limit && resultsWithPgp.length === query.limit) {
        return resultsWithPgp;
      } else {
        const limit = query.limit ? query.limit - resultsWithPgp.length : undefined;
        const resultsWithoutPgp = await ContactStore.rawSearch(db, {
          substring: query.substring,
          limit,
          hasPgp: false,
        });
        return resultsWithPgp.concat(resultsWithoutPgp);
      }
    }
    const emails = db.transaction(['emails'], 'readonly').objectStore('emails');
    const raw: Email[] = await new Promise((resolve, reject) => {
      let search: IDBRequest;
      if (typeof query.hasPgp === 'undefined') {
        // any query.hasPgp value
        search = emails.openCursor(); // no substring, already covered in `typeof query.hasPgp === 'undefined' && query.substring` above
      } else {
        // specific query.hasPgp value
        const indexRange = ContactStore.dbIndexRange(query.hasPgp, query.substring ?? '');
        // To find all the index keys starting with a certain sequence of characters (e.g. 'abc')
        // we use a range with inclusive lower boundary and exclusive upper boundary
        // ['t:abc', 't:abd) or ['f:abc', 'f:abd'), so that any key having an arbitrary tail of
        // characters beyond 'abc' falls into this range, and none of the non-matching keys do.
        // Thus we only have to keep complete keywords in the 'search' index.
        const range = IDBKeyRange.bound(indexRange.lowerBound, indexRange.upperBound, false, true);
        search = emails.index('search').openCursor(range);
      }
      const found: Email[] = [];
      ContactStore.setReqPipe(
        search,
        (cursor: IDBCursorWithValue) => {
          if (!cursor) {
            resolve(found);
          } else {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            found.push(cursor.value);
            if (query.limit && found.length >= query.limit) {
              resolve(found);
            } else {
              cursor.continue();
            }
          }
        },
        reject
      );
    });
    // Remove duplicated results
    return raw.filter((value, index, arr) => arr.findIndex(contact => contact.email === value.email) === index);
  }

  private static normalizeString(str: string) {
    return str
      .normalize('NFKD')
      .replace(/[\u0300-\u036F]/g, '')
      .toLowerCase();
  }

  private static dbIndex(hasPgp: boolean, substring: string): string {
    return (hasPgp ? 't:' : 'f:') + substring;
  }

  private static dbIndexRange(hasPgp: boolean, substring: string): { lowerBound: string; upperBound: string } {
    // to find all the keys starting with 'abc', we need to use a range search with exlcusive upper boundary
    // ['t:abc', 't:abd'), that is, we "replace" the last char ('c') with the char having subsequent code ('d')
    // The edge case is when the search string terminates with a certain char X having the max allowed code (65535)
    // or with a sequence of these, e.g. 'abcXXXXX'. In this case, we have to remove the tail of X characters
    // and increase the preceding non-X char, hence, the range would be ['t:abcXXXXX', 't:abd')
    // If the search sequence consists entirely of such symbols, the search range will have
    // the upper boundary of 'f;' or 't;', so this algorithm always works
    const lowerBound = ContactStore.dbIndex(hasPgp, substring);
    let copyLength = lowerBound.length - 1;
    let lastChar = lowerBound.charCodeAt(copyLength);
    while (lastChar >= 65535) {
      lastChar = lowerBound.charCodeAt(--copyLength);
    }
    const upperBound = lowerBound.substring(0, copyLength) + String.fromCharCode(lastChar + 1);
    return { lowerBound, upperBound };
  }

  private static getKeyAttributes(key: Key | undefined): PubkeyAttributes {
    return { fingerprint: key?.id ?? null, expiresOn: DateUtility.asNumber(key?.expiration) };
  }

  private static toContactPreview(result: Email): ContactPreview {
    return {
      email: result.email,
      name: result.name || undefined,
      hasPgp: result.fingerprints.length > 0,
      lastUse: result.lastUse,
    };
  }
}
