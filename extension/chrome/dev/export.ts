/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch } from '../../js/common/platform/catch.js';
import { Ui, Browser } from '../../js/common/browser.js';
import { Assert } from '../../js/common/assert.js';
import { Api } from '../../js/common/api/api.js';
import { Att } from '../../js/common/core/att.js';
import { Buf } from '../../js/common/core/buf.js';
import { openpgp } from '../../js/common/core/pgp.js';
import { Url } from '../../js/common/core/common.js';
import { Gmail } from '../../js/common/api/email_provider/gmail/gmail.js';
import { GmailRes, GmailParser } from '../../js/common/api/email_provider/gmail/gmail-parser.js';

Catch.try(async () => {

  const uncheckedUrlParams = Url.parse(['acctEmail']);
  const acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
  const gmail = new Gmail(acctEmail);

  if (!confirm('This is page is meant for debugging. It will download messages from your inbox and save them to your device. Continue?')) {
    window.close();
    return;
  }

  const print = (line: string) => $('pre').text($('pre').text() + '\n' + line);

  const censor = (value: string) => {
    value = value.replace(/[a-z0-9.\-_]+@[a-z0-9.\-_]+\.[a-z0-9.\-_]+/g, foundEmail => {
      if (foundEmail !== acctEmail && !foundEmail.includes('@flowcrypt.com')) {
        return 'censored@email.com';
      }
      return foundEmail;
    });
    value = value.replace(/[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+/g, '1.1.1.1');
    return value;
  };

  const save = (data: Uint8Array) => {
    Browser.saveToDownloads(new Att({ data, name: `${acctEmail.replace(/[^a-z0-9+]/g, '')}.json`, type: 'application/pgp-encrypted' }));
  };

  try {
    print('starting');
    const msgMetas: GmailRes.GmailMsgList$message[] = [];
    let nextCyclePageToken: string | undefined;
    while (true) {
      const { messages, resultSizeEstimate, nextPageToken } = await gmail.msgList('is:inbox OR is:sent', false, nextCyclePageToken);
      print(`msgList: ${(messages || []).length} msgs, resultSizeEstimate:${resultSizeEstimate}, nextPageToken: ${nextPageToken}`);
      msgMetas.push(...(messages || []));
      if (!messages || !messages.length || !nextPageToken) {
        break;
      }
      nextCyclePageToken = nextPageToken;
    }
    print(`found in inbox: ${(msgMetas || []).length} msgs`);
    print(`downloading draft list`);
    const draftMetas: GmailRes.GmailDraftMeta[] = [];
    let draftNextPageToken: string | undefined | null;
    do {
      const { drafts, nextPageToken } = await gmail.draftList();
      draftMetas.push(...drafts);
      draftNextPageToken = nextPageToken;
    } while (draftNextPageToken);
    print(`found ${draftMetas.length} drafts`);
    const fullMsgIdsList = (msgMetas || []).map(m => m.id).concat(draftMetas.map(dm => dm.message.id));
    print(`downloading full..`);
    const msgsFull = await gmail.msgsGet(fullMsgIdsList, 'full');
    print(`downloading full done. waiting 5 seconds..`);
    await Ui.time.sleep(5000);
    print(`waiting done. Downloading raw..`);
    const msgsRaw = await gmail.msgsGet(fullMsgIdsList, 'raw');
    print(`downloading raw done. Joining results..`);
    for (const msg of msgsFull) {
      for (const msgRaw of msgsRaw) {
        if (msgRaw.id === msg.id) {
          if (msgRaw.raw!.length < 1024 * 1024 * 7) {
            msg.raw = msgRaw.raw!;
          } else {
            print(`skipping message ${msg.id} raw because too big: ${msgRaw.raw!.length}`);
          }
          break;
        }
      }
    }
    const drafts: GmailRes.GmailDraftGet[] = [];
    for (const draftMeta of draftMetas) {
      const messageIndex = msgsFull.findIndex(m => m.id === draftMeta.message.id);
      if (messageIndex !== -1) {
        drafts.push({ id: draftMeta.id, message: msgsFull[messageIndex] });
        msgsFull.splice(messageIndex, 1); // if not remove msg it will make duplicates
      }
    }
    const messages: GmailRes.GmailMsg[] = [...msgsFull];
    print(`joining done. Downloading labels..`);
    const { labels } = await gmail.labelsGet();
    print('labels done. waiting 5s..');
    await Ui.time.sleep(5000);
    print('waiting done. Downloading attachments..');
    const fetchableAtts: Att[] = [];
    const skippedAtts: Att[] = [];
    for (const msg of messages) {
      for (const att of GmailParser.findAtts(msg)) {
        if (att.length > 1024 * 1024 * 7) { // over 7 mb - attachment too big
          skippedAtts.push(new Att({ data: Buf.fromUtfStr(`MOCK: ATTACHMENT STRIPPED - ORIGINAL SIZE ${att.length}`), id: att.id, msgId: msg.id }));
        } else {
          fetchableAtts.push(att);
        }
      }
    }
    await gmail.fetchAtts(fetchableAtts, percent => print(`Percent atts done: ${percent}`));
    const attachments: { [id: string]: { data: string, size: number } } = {};
    for (const att of fetchableAtts.concat(skippedAtts)) {
      attachments[att.id!] = { data: att.getData().toBase64UrlStr(), size: att.getData().length };
    }
    print(`done. found ${messages.length} messages, ${fetchableAtts.length} downloaded and ${skippedAtts.length} skipped atts, ${labels.length} labels`);
    print('censoring..');
    for (const msg of messages) {
      for (const h of msg.payload!.headers!) {
        h.value = censor(h.value);
      }
    }
    const data = Buf.fromUtfStr(JSON.stringify({ messages, attachments, labels, drafts }));
    print(`export size: ${data.length / (1024 * 1024)} MB`);
    const pwd = prompt('Please enter encryption password');
    if (pwd) {
      print('encrypting..');
      const encrypted = await openpgp.encrypt({ armor: false, message: openpgp.message.fromBinary(data), passwords: [pwd] });
      save(encrypted.message.packets.write());
    } else {
      save(data);
    }
  } catch (e) {
    print(Api.err.eli5(e));
    print(String(e));
    if (e instanceof Error) {
      print(e.stack || 'no stack');
    }
  }

})();
