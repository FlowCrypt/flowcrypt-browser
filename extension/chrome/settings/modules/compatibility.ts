/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Buf } from '../../../js/common/core/buf.js';
import { PgpKey } from '../../../js/common/core/pgp-key.js';
import { PgpMsg } from '../../../js/common/core/pgp-msg.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { View } from '../../../js/common/view.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { opgp } from '../../../js/common/core/pgp.js';
import { Str } from '../../../js/common/core/common.js';

View.run(class CompatibilityView extends View {

  private readonly encryptionText = 'This is the text we are encrypting!';
  private testIndex = 0;

  constructor() {
    super();
  }

  public render = async () => {
    // No need
  }

  public setHandlers = () => {
    $('.action_test_key').click(this.setHandlerPrevent('double', this.actionTestKeyHandler));
    $('#input_passphrase').keydown(this.setEnterHandlerThatClicks('.action_test_key'));
  }

  private performKeyCompatibilityTests = async (keyString: string) => {
    $('pre').text('').css('display', 'block');
    try {
      this.testIndex = 1;
      const { keys, errs } = await PgpKey.readMany(Buf.fromUtfStr(keyString));
      for (const err of errs) {
        this.appendResult(`Error parsing input: ${String(err)}`);
      }
      await this.outputKeyResults(await Promise.all(keys.map(key => PgpKey.readAsOpenPGP(PgpKey.serializeToString(key)))));
    } catch (err) {
      this.appendResult(`Exception: ${String(err)}`);
    }
  }

  private appendResult = (str: string, err?: Error) => {
    Xss.sanitizeAppend('pre', `(${Xss.escape(`${this.testIndex++}`)}) ${Xss.escape(str)} ${err ? Xss.escape(` !! ${err.message}`) : Xss.escape('')} \n`);
  }

  private outputKeyResults = async (keys: OpenPGP.key.Key[]) => {
    this.appendResult(`Primary keys found: ${keys.length}`);
    for (let keyIndex = 0; keyIndex < keys.length; keyIndex++) {
      this.appendResult(`----- Testing key ${keyIndex} -----`);
      const key = keys[keyIndex];
      const kn = `PK ${keyIndex} >`;
      if (!key.isPrivate() && !key.isPublic()) {
        this.appendResult(`${kn} key is neither public or private!!`);
        return;
      }
      this.appendResult(`${kn} Is Private? ${await this.test(async () => key.isPrivate())}`);
      for (let i = 0; i < key.users.length; i++) {
        this.appendResult(`${kn} User id ${i}: ${await this.test(async () => key.users[i].userId!.userid)}`);
      }
      this.appendResult(`${kn} Primary User: ${await this.test(async () => {
        const user = await key.getPrimaryUser();
        return user?.user?.userId?.userid || 'No primary user';
      })}`);
      this.appendResult(`${kn} Fingerprint: ${await this.test(async () => Str.spaced(await PgpKey.fingerprint(key) || 'err'))}`);
      this.appendResult(`${kn} Subkeys: ${await this.test(async () => key.subKeys ? key.subKeys.length : key.subKeys)}`);
      this.appendResult(`${kn} Primary key algo: ${await this.test(async () => key.primaryKey.algorithm)}`);
      if (key.isPrivate()) {
        const pubkey = await PgpKey.parse(key.armor());
        this.appendResult(`${kn} key decrypt: ${await this.test(async () => PgpKey.decrypt(pubkey, String($('.input_passphrase').val())))}`);
        this.appendResult(`${kn} isFullyDecrypted: ${await this.test(async () => key.isFullyDecrypted())}`);
        this.appendResult(`${kn} isFullyEncrypted: ${await this.test(async () => key.isFullyEncrypted())}`);
      }
      this.appendResult(`${kn} Primary key verify: ${await this.test(async () => {
        await key.verifyPrimaryKey(); // throws
        return `valid`;
      })}`);
      this.appendResult(`${kn} Primary key creation? ${await this.test(async () => this.formatDate(await key.getCreationTime()))}`);
      this.appendResult(`${kn} Primary key expiration? ${await this.test(async () => this.formatDate(await key.getExpirationTime()))}`);
      const encryptResult = await this.testEncryptDecrypt(key);
      encryptResult.map(msg => this.appendResult(`${kn} Encrypt/Decrypt test: ${msg}`));
      if (key.isPrivate()) {
        this.appendResult(`${kn} Sign/Verify test: ${await this.test(async () => await this.testSignVerify(key))}`);
      }
      for (let subKeyIndex = 0; subKeyIndex < key.subKeys.length; subKeyIndex++) {
        const subKey = key.subKeys[subKeyIndex];
        const skn = `${kn} SK ${subKeyIndex} >`;
        this.appendResult(`${skn} LongId: ${await this.test(async () => PgpKey.longid(subKey.getKeyId().bytes))}`);
        this.appendResult(`${skn} Created: ${await this.test(async () => this.formatDate(subKey.keyPacket.created))}`);
        this.appendResult(`${skn} Algo: ${await this.test(async () => `${subKey.getAlgorithmInfo().algorithm}`)}`);
        this.appendResult(`${skn} Verify: ${await this.test(async () => {
          const verifyResNum = await subKey.verify(key.primaryKey);
          const veryfyResWord = opgp.enums.read(opgp.enums.keyStatus, 1);
          return `${verifyResNum}: ${veryfyResWord}`;
        })}`);
        this.appendResult(`${skn} Subkey tag: ${await this.test(async () => subKey.keyPacket.tag)}`);
        this.appendResult(`${skn} Subkey getBitSize: ${await this.test(async () => subKey.getAlgorithmInfo().bits)}`);       // No longer exists on object
        this.appendResult(`${skn} Subkey decrypted: ${await this.test(async () => subKey.isDecrypted())}`);
        this.appendResult(`${skn} Binding signature length: ${await this.test(async () => subKey.bindingSignatures.length)}`);
        for (let sigIndex = 0; sigIndex < subKey.bindingSignatures.length; sigIndex++) {
          const sig = subKey.bindingSignatures[sigIndex];
          const sgn = `${skn} SIG ${sigIndex} >`;
          this.appendResult(`${sgn} Key flags: ${await this.test(async () => sig.keyFlags)}`);
          this.appendResult(`${sgn} Tag: ${await this.test(async () => sig.tag)}`);
          this.appendResult(`${sgn} Version: ${await this.test(async () => sig.version)}`);
          this.appendResult(`${sgn} Public key algorithm: ${await this.test(async () => sig.publicKeyAlgorithm)}`);
          this.appendResult(`${sgn} Sig creation time: ${await this.test(async () => this.formatDate(sig.created))}`);
          this.appendResult(`${sgn} Sig expiration time: ${await this.test(async () => {
            if (!subKey.keyPacket.created) {
              return 'unknown key creation time';
            }
            return this.formatDate(subKey.keyPacket.created, sig.keyExpirationTime);
          })}`);
          this.appendResult(`${sgn} Verified: ${await this.test(async () => sig.verified)}`);
        }
      }
      const pubKey = await PgpKey.parse(key.armor());
      this.appendResult(`${kn} expiration: ${await this.test(async () => pubKey.expiration)}`);
      this.appendResult(`${kn} internal dateBeforeExpiration: ${await this.test(async () => PgpKey.dateBeforeExpirationIfAlreadyExpired(pubKey))}`);
      this.appendResult(`${kn} internal usableButExpired: ${await this.test(async () => pubKey.usableButExpired)}`);
    }
  }

  private test = async (f: () => Promise<unknown>) => {
    try {
      return `[-] ${String(await f())}`;
    } catch (e) {
      return `[${String(e)}]`;
    }
  }

  private formatDate = (date: Date | number | null, expiresInSecondsFromDate?: number | null) => {
    if (date === Infinity) {
      return '-';
    }
    if (typeof date === 'number') {
      return `UNEXPECTED FORMAT: ${date}`;
    }
    if (date === null) {
      return `null (not applicable)`;
    }
    if (typeof expiresInSecondsFromDate === 'undefined') {
      return `${date.getTime() / 1000} or ${date.toISOString()}`;
    }
    if (expiresInSecondsFromDate === null) {
      return '-'; // no expiration
    }
    const expDate = new Date(date.getTime() + (expiresInSecondsFromDate * 1000));
    return `${date.getTime() / 1000} + ${expiresInSecondsFromDate} seconds, which is: ${expDate.getTime() / 1000} or ${expDate.toISOString()}`;
  }

  private testEncryptDecrypt = async (key: OpenPGP.key.Key): Promise<string[]> => {
    const output: string[] = [];
    try {
      const encryptedMsg = await opgp.encrypt({ message: opgp.message.fromText(this.encryptionText), publicKeys: key.toPublic(), armor: true });
      output.push(`Encryption with key was successful`);
      if (key.isPrivate() && key.isFullyDecrypted()) {
        const decryptedMsg = await opgp.decrypt({ message: await opgp.message.readArmored(encryptedMsg.data), privateKeys: key });
        output.push(`Decryption with key ${decryptedMsg.data === this.encryptionText ? 'succeeded' : 'failed!'}`);
      } else {
        output.push(`Skipping decryption because isPrivate:${key.isPrivate()} isFullyDecrypted:${key.isFullyDecrypted()}`);
      }
    } catch (err) {
      output.push(`Got error performing encryption/decryption test: ${err}`);
    }
    return output;
  }

  private testSignVerify = async (key: OpenPGP.key.Key): Promise<string> => {
    const output: string[] = [];
    try {
      if (!key.isFullyDecrypted()) {
        return 'skiped, not fully decrypted';
      }
      const signedMessage = await opgp.message.fromText(this.encryptionText).sign([key]);
      output.push('sign msg ok');
      const verifyResult = await PgpMsg.verify(signedMessage, [key]);
      if (verifyResult.error !== null && typeof verifyResult.error !== 'undefined') {
        output.push(`verify failed: ${verifyResult.error}`);
      } else {
        if (verifyResult.match && verifyResult.signer === (await PgpKey.longid(key))) {
          output.push('verify ok');
        } else {
          output.push(`verify mismatch: match[${verifyResult.match}] signer[${verifyResult.signer}]`);
        }
      }
    } catch (e) {
      output.push(`Exception: ${String(e)}`);
    }
    return output.join('|');
  }

  private actionTestKeyHandler = async (submitBtn: HTMLElement) => {
    const keyString = String($('.input_key').val());
    if (!keyString) {
      await Ui.modal.warning('Please paste an OpenPGP in the input box');
      return;
    }
    const origBtnContent = $(submitBtn).html();
    Xss.sanitizeRender(submitBtn, 'Evaluating.. ' + Ui.spinner('white'));
    await this.performKeyCompatibilityTests(keyString);
    Xss.sanitizeRender(submitBtn, origBtnContent);
  }

});
