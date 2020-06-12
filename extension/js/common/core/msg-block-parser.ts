/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { MsgBlock, ReplaceableMsgBlockType } from './msg-block.js';
import { SanitizeImgHandling, Xss } from '../platform/xss.js';

import { Buf } from './buf.js';
import { Catch } from '../platform/catch.js';
import { Mime } from './mime.js';
import { PgpArmor } from './crypto/pgp/pgp-armor.js';
import { PgpKey } from './crypto/pgp/pgp-key.js';
import { Str } from './common.js';
import { FcAttLinkData } from './att.js';

type SanitizedBlocks = { blocks: MsgBlock[], subject: string | undefined, isRichText: boolean, webReplyToken: any | undefined };

export class MsgBlockParser {

  private static ARMOR_HEADER_MAX_LENGTH = 50;

  public static detectBlocks = (origText: string) => {
    const blocks: MsgBlock[] = [];
    const normalized = Str.normalize(origText);
    let startAt = 0;
    while (true) { // eslint-disable-line no-constant-condition
      const { found, continueAt } = MsgBlockParser.detectBlockNext(normalized, startAt);
      if (found) {
        blocks.push(...found);
      }
      if (typeof continueAt === 'undefined') {
        return { blocks, normalized };
      } else {
        if (continueAt <= startAt) {
          Catch.report(`MsgBlockParser.detectBlocks likely infinite loop: r.continueAt(${continueAt}) <= startAt(${startAt})`);
          return { blocks, normalized }; // prevent infinite loop
        }
        startAt = continueAt;
      }
    }
  }

  public static fmtDecryptedAsSanitizedHtmlBlocks = async (decryptedContent: Uint8Array, imgHandling: SanitizeImgHandling = 'IMG-TO-LINK'): Promise<SanitizedBlocks> => {
    const blocks: MsgBlock[] = [];
    let isRichText = false;
    let webReplyToken: any | undefined;
    if (!Mime.resemblesMsg(decryptedContent)) {
      let plain = Buf.fromUint8(decryptedContent).toUtfStr();
      plain = MsgBlockParser.extractFcAtts(plain, blocks);
      webReplyToken = MsgBlockParser.extractFcReplyToken(plain);
      if (webReplyToken) {
        plain = MsgBlockParser.stripFcTeplyToken(plain);
      }
      const armoredPubKeys: string[] = [];
      plain = MsgBlockParser.stripPublicKeys(plain, armoredPubKeys);
      blocks.push(MsgBlock.fromContent('decryptedHtml', Str.escapeTextAsRenderableHtml(plain))); // escaped text as html
      await MsgBlockParser.pushArmoredPubkeysToBlocks(armoredPubKeys, blocks);
      return { blocks, subject: undefined, isRichText, webReplyToken };
    }
    const decoded = await Mime.decode(decryptedContent);
    if (typeof decoded.html !== 'undefined') {
      webReplyToken = MsgBlockParser.extractFcReplyToken(decoded.html);
      if (webReplyToken) {
        decoded.html = MsgBlockParser.stripFcTeplyToken(decoded.html);
      }
      blocks.push(MsgBlock.fromContent('decryptedHtml', Xss.htmlSanitizeKeepBasicTags(decoded.html, imgHandling))); // sanitized html
      isRichText = true;
    } else if (typeof decoded.text !== 'undefined') {
      webReplyToken = MsgBlockParser.extractFcReplyToken(decoded.text);
      if (webReplyToken) {
        decoded.text = MsgBlockParser.stripFcTeplyToken(decoded.text);
      }
      blocks.push(MsgBlock.fromContent('decryptedHtml', Str.escapeTextAsRenderableHtml(decoded.text))); // escaped text as html
    } else {
      blocks.push(MsgBlock.fromContent('decryptedHtml', Str.escapeTextAsRenderableHtml(Buf.with(decryptedContent).toUtfStr()))); // escaped mime text as html
    }
    for (const att of decoded.atts) {
      if (att.treatAs() === 'publicKey') {
        await MsgBlockParser.pushArmoredPubkeysToBlocks([att.getData().toUtfStr()], blocks);
      } else {
        blocks.push(MsgBlock.fromAtt('decryptedAtt', '', { name: att.name, data: att.getData(), length: att.length, type: att.type }));
      }
    }
    return { blocks, subject: decoded.subject, isRichText, webReplyToken };
  }

  public static extractFcAtts = (decryptedContent: string, blocks: MsgBlock[]) => {
    // these tags were created by FlowCrypt exclusively, so the structure is rigid (not arbitrary html)
    // `<a href="${att.url}" class="cryptup_file" cryptup-data="${fcData}">${linkText}</a>\n`
    // thus we use RegEx so that it works on both browser and node
    if (decryptedContent.includes('class="cryptup_file"')) {
      decryptedContent = decryptedContent.replace(/<a\s+href="([^"]+)"\s+class="cryptup_file"\s+cryptup-data="([^"]+)"\s*>[^<]+<\/a>\n?/gm, (_, url, fcData) => {
        const a = Str.htmlAttrDecode(String(fcData));
        if (MsgBlockParser.isFcAttLinkData(a)) {
          blocks.push(MsgBlock.fromAtt('encryptedAttLink', '', { type: a.type, name: a.name, length: a.size, url: String(url) }));
        }
        return '';
      });
    }
    return decryptedContent;
  }

  public static stripPublicKeys = (decryptedContent: string, foundPublicKeys: string[]) => {
    let { blocks, normalized } = MsgBlockParser.detectBlocks(decryptedContent); // tslint:disable-line:prefer-const
    for (const block of blocks) {
      if (block.type === 'publicKey') {
        const armored = block.content.toString();
        foundPublicKeys.push(armored);
        normalized = normalized.replace(armored, '');
      }
    }
    return normalized;
  }

  public static extractFcReplyToken = (decryptedContent: string): undefined | any => {
    const fcTokenElement = $(`<div>${decryptedContent}</div>`).find('.cryptup_reply');
    if (fcTokenElement.length) {
      const fcData = fcTokenElement.attr('cryptup-data');
      if (fcData) {
        return Str.htmlAttrDecode(fcData);
      }
    }
  }

  public static stripFcTeplyToken = (decryptedContent: string) => {
    return decryptedContent.replace(/<div[^>]+class="cryptup_reply"[^>]+><\/div>/, '');
  }

  private static isFcAttLinkData = (o: any): o is FcAttLinkData => {
    return o && typeof o === 'object' && typeof (o as FcAttLinkData).name !== 'undefined'
      && typeof (o as FcAttLinkData).size !== 'undefined' && typeof (o as FcAttLinkData).type !== 'undefined';
  }

  private static detectBlockNext = (origText: string, startAt: number) => {
    const armorHdrTypes = Object.keys(PgpArmor.ARMOR_HEADER_DICT) as ReplaceableMsgBlockType[];
    const result: { found: MsgBlock[], continueAt?: number } = { found: [] as MsgBlock[] };
    const begin = origText.indexOf(PgpArmor.headers('null').begin, startAt);
    if (begin !== -1) { // found
      const potentialBeginHeader = origText.substr(begin, MsgBlockParser.ARMOR_HEADER_MAX_LENGTH);
      for (const armorHdrType of armorHdrTypes) {
        const blockHeaderDef = PgpArmor.ARMOR_HEADER_DICT[armorHdrType];
        if (blockHeaderDef.replace) {
          const indexOfConfirmedBegin = potentialBeginHeader.indexOf(blockHeaderDef.begin);
          if (indexOfConfirmedBegin === 0) {
            if (begin > startAt) {
              let potentialTextBeforeBlockBegun = origText.substring(startAt, begin);
              if (!potentialTextBeforeBlockBegun.endsWith('\n')) {
                // only replace blocks if they begin on their own line
                // contains deliberate block: `-----BEGIN PGP PUBLIC KEY BLOCK-----\n...`
                // contains deliberate block: `Hello\n-----BEGIN PGP PUBLIC KEY BLOCK-----\n...`
                // just plaintext (accidental block): `Hello -----BEGIN PGP PUBLIC KEY BLOCK-----\n...`
                continue; // block treated as plaintext, not on dedicated line - considered accidental
                // this will actually cause potential deliberate blocks that follow accidental block to be ignored
                // but if the message already contains accidental (not on dedicated line) blocks, it's probably a good thing to ignore the rest
              }
              potentialTextBeforeBlockBegun = potentialTextBeforeBlockBegun.trim();
              if (potentialTextBeforeBlockBegun) {
                result.found.push(MsgBlock.fromContent('plainText', potentialTextBeforeBlockBegun));
              }
            }
            let endIndex: number = -1;
            let foundBlockEndHeaderLength = 0;
            if (typeof blockHeaderDef.end === 'string') {
              endIndex = origText.indexOf(blockHeaderDef.end, begin + blockHeaderDef.begin.length);
              foundBlockEndHeaderLength = blockHeaderDef.end.length;
            } else { // regexp
              const origTextAfterBeginIndex = origText.substring(begin);
              const matchEnd = origTextAfterBeginIndex.match(blockHeaderDef.end);
              if (matchEnd) {
                endIndex = matchEnd.index ? begin + matchEnd.index : -1;
                foundBlockEndHeaderLength = matchEnd[0].length;
              }
            }
            if (endIndex !== -1) { // identified end of the same block
              result.found.push(MsgBlock.fromContent(armorHdrType, origText.substring(begin, endIndex + foundBlockEndHeaderLength).trim()));
              result.continueAt = endIndex + foundBlockEndHeaderLength;
            } else { // corresponding end not found
              result.found.push(MsgBlock.fromContent(armorHdrType, origText.substr(begin), true));
            }
            break;
          }
        }
      }
    }
    if (origText && !result.found.length) { // didn't find any blocks, but input is non-empty
      const potentialText = origText.substr(startAt).trim();
      if (potentialText) {
        result.found.push(MsgBlock.fromContent('plainText', potentialText));
      }
    }
    return result;
  }

  private static pushArmoredPubkeysToBlocks = async (armoredPubkeys: string[], blocks: MsgBlock[]): Promise<void> => {
    for (const armoredPubkey of armoredPubkeys) {
      const { keys } = await PgpKey.parseDetails(armoredPubkey);
      for (const keyDetails of keys) {
        blocks.push(MsgBlock.fromKeyDetails('publicKey', PgpKey.armor(keyDetails.public), keyDetails));
      }
    }
  }

}
