/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { GmailParser, GmailRes } from '../../js/common/api/email-provider/gmail/gmail-parser.js';

import { ApiErr } from '../../js/common/api/shared/api-error.js';
import { Assert } from '../../js/common/assert.js';
import { Attachment } from '../../js/common/core/attachment.js';
import { Browser } from '../../js/common/browser/browser.js';
import { Buf } from '../../js/common/core/buf.js';
import { Catch } from '../../js/common/platform/catch.js';
import { Gmail } from '../../js/common/api/email-provider/gmail/gmail.js';
import { Time } from '../../js/common/browser/time.js';
import { Url } from '../../js/common/core/common.js';
import { opgp } from '../../js/common/core/crypto/pgp/openpgpjs-custom.js';

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
    Browser.saveToDownloads(new Attachment({ data, name: `${acctEmail.replace(/[^a-z0-9+]/g, '')}.json`, type: 'application/pgp-encrypted' }));
  };

  try {
    print('starting');
    const msgMetas: GmailRes.GmailMsgList$message[] = [];
    let nextCyclePageToken: string | undefined;
    while (true) {
      const { messages, resultSizeEstimate, nextPageToken } = await gmail.msgList('is:inbox OR is:sent', false, nextCyclePageToken);
      print(`msgList: ${(messages || []).length} msgs, resultSizeEstimate:${resultSizeEstimate}, nextPageToken: ${nextPageToken}`);
      msgMetas.push(...(messages || []));
      if (!messages?.length || !nextPageToken) {
        break;
      }
      nextCyclePageToken = nextPageToken;
    }
    print(`found in inbox: ${(msgMetas || []).length} msgs`);
    const fullMsgIdsList = (msgMetas || []).map(m => m.id);
    print(`downloading full..`);
    const msgsFull = await gmail.msgsGet(fullMsgIdsList, 'full');
    print(`downloading full done. waiting 5 seconds..`);
    await Time.sleep(5000);
    print(`waiting done. Downloading raw..`);
    const msgsRaw = await gmail.msgsGet(fullMsgIdsList, 'raw');
    print(`downloading raw done. Joining results..`);
    for (const msg of msgsFull) {
      for (const msgRaw of msgsRaw) {
        if (msgRaw.id === msg.id) {
          /* eslint-disable @typescript-eslint/no-non-null-assertion */
          if (msgRaw.raw!.length < 1024 * 1024 * 7) {
            msg.raw = msgRaw.raw!;
          } else {
            print(`skipping message ${msg.id} raw because too big: ${msgRaw.raw!.length}`);
          }
          /* eslint-enable @typescript-eslint/no-non-null-assertion */
          break;
        }
      }
    }
    const messages: GmailRes.GmailMsg[] = [...msgsFull];
    print(`joining done. Downloading labels..`);
    const { labels } = await gmail.labelsGet();
    print('labels done. waiting 5s..');
    await Time.sleep(5000);
    print('waiting done. Downloading attachments..');
    const fetchableAttachments: Attachment[] = [];
    const skippedAttachments: Attachment[] = [];
    for (const msg of messages) {
      for (const attachment of GmailParser.findAttachments(msg, msg.id)) {
        if (attachment.length > 1024 * 1024 * 7) {
          // over 7 mb - attachment too big
          skippedAttachments.push(
            new Attachment({
              data: Buf.fromUtfStr(`MOCK: ATTACHMENT STRIPPED - ORIGINAL SIZE ${attachment.length}`),
              id: attachment.id,
              msgId: msg.id,
            })
          );
        } else {
          fetchableAttachments.push(attachment);
        }
      }
    }
    await gmail.fetchAttachmentsMissingData(fetchableAttachments, percent => print(`Percent attachments done: ${percent}`));
    const attachments: Record<string, { data: string; size: number }> = {};
    for (const attachment of fetchableAttachments.concat(skippedAttachments)) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      attachments[attachment.id!] = { data: attachment.getData().toBase64UrlStr(), size: attachment.getData().length };
    }
    print(
      `done. found ${messages.length} messages, ${fetchableAttachments.length} downloaded and ${skippedAttachments.length} skipped attachments, ${labels.length} labels`
    );
    print('censoring..');
    for (const msg of messages) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      for (const h of msg.payload!.headers!) {
        h.value = censor(h.value);
      }
    }
    const data = Buf.fromUtfStr(JSON.stringify({ messages, attachments, labels }));
    print(`export size: ${data.length / (1024 * 1024)} MB`);
    const pwd = prompt('Please enter encryption password');
    if (pwd) {
      print('encrypting..');
      const encrypted = await opgp.encrypt({ format: 'binary', message: await opgp.createMessage({ binary: data }), passwords: [pwd] });
      save(encrypted); // todo: test
    } else {
      save(data);
    }
  } catch (e) {
    print(ApiErr.eli5(e));
    print(String(e));
    if (e instanceof Error) {
      print(e.stack || 'no stack');
    }
  }
})();
