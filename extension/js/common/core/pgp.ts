/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { requireOpenpgp } from '../platform/require.js';
import { VERSION } from './const.js';
import { PgpKey, PrvPacket, KeyDetails } from './pgp-key.js';
import { MsgBlockType, MsgBlock } from './mime.js';
import { AttMeta } from './att.js';

export const openpgp = requireOpenpgp();

if (typeof openpgp !== 'undefined') { // in certain environments, eg browser content scripts, openpgp is not included (not all functions below need it)
  openpgp.config.versionstring = `FlowCrypt ${VERSION} Gmail Encryption`;
  openpgp.config.commentstring = 'Seamlessly send and receive encrypted email';
  openpgp.config.ignore_mdc_error = true; // we manually check for missing MDC and show loud warning to user (no auto-decrypt)
  // openpgp.config.require_uid_self_cert = false;
  const getPrvPackets = (k: OpenPGP.key.Key) => {
    if (!k.isPrivate()) {
      throw new Error("Cannot check encryption status of secret keys in a Public Key");
    }
    const prvPackets = k.getKeys().map(k => k.keyPacket).filter(PgpKey.isPacketPrivate) as PrvPacket[];
    if (!prvPackets.length) {
      throw new Error("This key has no private packets. Is it a Private Key?");
    }
    // only encrypted keys have s2k (decrypted keys don't needed, already decrypted)
    // if s2k is present and it indicates it's a dummy key, filter it out
    // if s2k is not present, it's a decrypted real key (not dummy)
    const nonDummyPrvPackets = prvPackets.filter(p => !p.s2k || p.s2k.type !== 'gnu-dummy');
    if (!nonDummyPrvPackets.length) {
      throw new Error("This key only has a gnu-dummy private packet, with no actual secret keys.");
    }
    return nonDummyPrvPackets;
  };
  openpgp.key.Key.prototype.isFullyDecrypted = function () {
    return getPrvPackets(this).every(p => p.isDecrypted() === true);
  };
  openpgp.key.Key.prototype.isFullyEncrypted = function () {
    return getPrvPackets(this).every(p => p.isDecrypted() === false);
  };
  openpgp.key.Key.prototype.isPacketDecrypted = function (keyId: OpenPGP.Keyid) {
    if (!this.isPrivate()) {
      throw new Error("Cannot check packet encryption status of secret key in a Public Key");
    }
    if (!keyId) {
      throw new Error("No Keyid provided to isPacketDecrypted");
    }
    const [key] = this.getKeys(keyId);
    if (!key) {
      throw new Error("Keyid not found in Private Key");
    }
    return key.keyPacket.isDecrypted() === true;
  };
}

export class Pgp {

  static readonly FRIENDLY_BLOCK_TYPE_NAMES: { [type in MsgBlockType]: string } = { // todo - remove this, almost useless
    privateKey: 'Private Key',
    publicKey: 'Public Key',
    decryptErr: 'Decrypt Error',
    decryptedAtt: 'Decrypted Attachment',
    decryptedHtml: 'Decrypted HTML',
    decryptedText: 'Decrypted Text',
    encryptedAtt: 'Encrypted Attachment',
    encryptedAttLink: 'Encrypted Attachment Link',
    encryptedMsg: 'Encrypted Message',
    encryptedMsgLink: 'Encrypted Message Link',
    plainAtt: 'Plain Attachment',
    plainHtml: 'Plain HTML',
    plainText: 'Plain Text',
    signedHtml: 'Signed HTML',
    signedMsg: 'Signed Message',
    verifiedMsg: 'Verified Message'
  };
  public static friendlyMsgBlockTypeName = (type: MsgBlockType) => { // todo - remove this, just use the block type string
    return Pgp.FRIENDLY_BLOCK_TYPE_NAMES[type];
  }

  public static internal = {
    msgBlockAttObj: (type: MsgBlockType, content: string, attMeta: AttMeta): MsgBlock => ({ type, content, complete: true, attMeta }),
    msgBlockKeyObj: (type: MsgBlockType, content: string, keyDetails: KeyDetails): MsgBlock => ({ type, content, complete: true, keyDetails }),
  };

}
