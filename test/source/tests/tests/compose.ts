import { TestWithNewBrowser, TestWithGlobalBrowser } from '../../test';
import { ComposePageRecipe, SettingsPageRecipe, InboxPageRecipe, PageRecipe, OauthPageRecipe } from '../page_recipe';
import { BrowserRecipe } from '../browser_recipe';
import { Url, Controllable, BrowserHandle, ControllablePage } from '../../browser';
import * as ava from 'ava';
import { Util, Config } from '../../util';
import { TestVariant } from '../../util';
import { expect } from "chai";
import { AvaContext } from '..';
import { ElementHandle } from 'puppeteer';
import { Dict } from '../../core/common';

// tslint:disable:no-blank-lines-func

export const defineComposeTests = (testVariant: TestVariant, testWithNewBrowser: TestWithNewBrowser, testWithSemaphoredGlobalBrowser: TestWithGlobalBrowser) => {

  if (testVariant !== 'CONSUMER-LIVE-GMAIL') {

    ava.default('[standalone] compose - signed with entered pass phrase + will remember pass phrase in session', testWithNewBrowser(async (t, browser) => {
      const k = Config.key('test.ci.compose');
      await BrowserRecipe.setUpCommonAcct(t, browser, 'compose');
      const settingsPage = await browser.newPage(t, Url.extensionSettings('test.ci.compose@org.flowcrypt.com'));
      await SettingsPageRecipe.changePassphraseRequirement(settingsPage, k.passphrase, 'session');
      const composeFrame = await ComposePageRecipe.openInSettings(settingsPage);
      await ComposePageRecipe.fillMsg(composeFrame, { to: 'human@flowcrypt.com' }, 'sign with entered pass phrase', 'signed');
      await composeFrame.waitAndClick('@action-send');
      await settingsPage.waitAll('@dialog-passphrase');
      const passphraseDialog = await settingsPage.getFrame(['passphrase.htm']);
      await passphraseDialog.waitAndType('@input-pass-phrase', k.passphrase);
      await passphraseDialog.waitAndClick('@action-confirm-pass-phrase-entry'); // confirming pass phrase will send the message
      await settingsPage.waitTillGone('@dialog'); // however the @dialog would not go away - so that is a (weak but sufficient) telling sign
      // signed - done, now try to see if it remembered pp in session
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
      await ComposePageRecipe.fillMsg(composePage, { to: 'human@flowcrypt.com' }, 'signed message pp in session', 'signed');
      await ComposePageRecipe.sendAndClose(composePage);
      await settingsPage.close();
    }));

    ava.default('[standalone] compose - can load contact based on name', testWithNewBrowser(async (t, browser) => {
      await BrowserRecipe.setUpCommonAcct(t, browser, 'compose');
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
      await composePage.type('@input-to', 'human'); // test loading of contacts
      await composePage.waitAll(['@container-contacts', '@action-select-contact(human@flowcrypt.com)']);
    }));

    ava.default(`[standalone] compose - can choose found contact`, testWithNewBrowser(async (t, browser) => {
      await BrowserRecipe.setUpCommonAcct(t, browser, 'compose');
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
      // composePage.enable_debugging('choose-contact');
      await composePage.type('@input-to', 'human'); // test loading of contacts
      await composePage.waitAll(['@container-contacts', '@action-select-contact(human@flowcrypt.com)'], { timeout: 30 });
      await composePage.waitAndClick('@action-select-contact(human@flowcrypt.com)', { retryErrs: true, confirmGone: true, delay: 0 });
      // todo - verify that the contact/pubkey is showing in green once clicked
      await composePage.waitAndClick('@input-subject');
      await composePage.type('@input-subject', `Automated puppeteer test: pubkey chosen by clicking found contact`);
      await composePage.type('@input-body', `This is an automated puppeteer test: pubkey chosen by clicking found contact`);
      await ComposePageRecipe.sendAndClose(composePage);
    }));

    ava.default(`[standalone] compose - freshly loaded pubkey`, testWithNewBrowser(async (t, browser) => {
      await BrowserRecipe.setUpCommonAcct(t, browser, 'compose');
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
      await ComposePageRecipe.fillMsg(composePage, { to: 'human@flowcrypt.com' }, 'freshly loaded pubkey');
      await ComposePageRecipe.sendAndClose(composePage);
    }));

    ava.default('[standalone] compose - recipient pasted including name', testWithNewBrowser(async (t, browser) => {
      await BrowserRecipe.setUpCommonAcct(t, browser, 'compose');
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
      await ComposePageRecipe.fillMsg(composePage, { to: 'Human at Flowcrypt <Human@FlowCrypt.com>' }, 'recipient pasted including name');
      await ComposePageRecipe.sendAndClose(composePage);
    }));

    ava.default('compose[global:compose] - standalone - nopgp', testWithSemaphoredGlobalBrowser('compose', async (t, browser) => {
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
      await ComposePageRecipe.fillMsg(composePage, { to: 'human+nopgp@flowcrypt.com' }, 'unknown pubkey');
      await ComposePageRecipe.sendAndClose(composePage, 'test-pass');
    }));

    ava.default('compose[global:compatibility] - standalone - from alias', testWithSemaphoredGlobalBrowser('compatibility', async (t, browser) => {
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility');
      await composePage.selectOption('@input-from', 'flowcryptcompatibility@gmail.com');
      await ComposePageRecipe.fillMsg(composePage, { to: 'human@flowcrypt.com' }, 'from alias');
      await ComposePageRecipe.sendAndClose(composePage);
    }));

    ava.default('compose[global:compose] - standalone - with attachments', testWithSemaphoredGlobalBrowser('compose', async (t, browser) => {
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
      await ComposePageRecipe.fillMsg(composePage, { to: 'human@flowcrypt.com' }, 'with files');
      const fileInput = await composePage.target.$('input[type=file]');
      await fileInput!.uploadFile('test/samples/small.txt', 'test/samples/small.png', 'test/samples/small.pdf');
      await ComposePageRecipe.sendAndClose(composePage);
    }));

    ava.default('compose[global:compose] - standalone - with attachments + nopgp', testWithSemaphoredGlobalBrowser('compose', async (t, browser) => {
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
      await ComposePageRecipe.fillMsg(composePage, { to: 'human+nopgp@flowcrypt.com' }, 'with files + nonppg');
      const fileInput = await composePage.target.$('input[type=file]');
      await fileInput!.uploadFile('test/samples/small.txt', 'test/samples/small.png', 'test/samples/small.pdf');
      await ComposePageRecipe.sendAndClose(composePage, 'test-pass', 90);
    }));

    ava.default('compose[global:compose] - signed message', testWithSemaphoredGlobalBrowser('compose', async (t, browser) => {
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
      await ComposePageRecipe.fillMsg(composePage, { to: 'human@flowcrypt.com' }, 'signed message', 'signed');
      await ComposePageRecipe.sendAndClose(composePage);
    }));

    ava.default('compose[global:compose] - settings - manually copied pubkey', testWithSemaphoredGlobalBrowser('compose', async (t, browser) => {
      let settingsPage = await browser.newPage(t, Url.extensionSettings('test.ci.compose@org.flowcrypt.com'));
      let composeFrame = await ComposePageRecipe.openInSettings(settingsPage);
      await ComposePageRecipe.fillMsg(composeFrame, { to: 'human@flowcrypt.com' }, 'just to load - will close this page');
      await Util.sleep(1); // todo: should wait until actually loaded
      await settingsPage.close();
      settingsPage = await browser.newPage(t, Url.extensionSettings('test.ci.compose@org.flowcrypt.com'));
      composeFrame = await ComposePageRecipe.openInSettings(settingsPage);
      await ComposePageRecipe.fillMsg(composeFrame, { to: 'human+manualcopypgp@flowcrypt.com' }, 'manual copied key');
      await composeFrame.waitAndClick('@action-open-add-pubkey-dialog', { delay: 1 });
      await composeFrame.waitAll('@dialog');
      const addPubkeyDialog = await composeFrame.getFrame(['add_pubkey.htm']);
      await addPubkeyDialog.waitAll('@input-select-copy-from');
      await addPubkeyDialog.selectOption('@input-select-copy-from', 'human@flowcrypt.com');
      await addPubkeyDialog.waitAndClick('@action-add-pubkey');
      await composeFrame.waitTillGone('@dialog');
      await composeFrame.waitAndClick('@action-send', { delay: 2 });
      await settingsPage.waitTillGone('@dialog');
    }));

    ava.default('compose[global:compatibility] - reply - old gmail threadId fmt', testWithSemaphoredGlobalBrowser('compatibility', async (t, browser) => {
      const appendUrl = 'skipClickPrompt=___cu_false___&ignoreDraft=___cu_false___&threadId=16841ce0ce5cb74d&threadMsgId=16841ce0ce5cb74d';
      const replyFrame = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', { appendUrl, skipValidation: true });
      await Util.sleep(1);
      // tslint:disable-next-line: no-unused-expression
      expect(await replyFrame.isElementPresent('.action_retry')).to.be.true;
      expect(await PageRecipe.getElementPropertyJson(await replyFrame.waitAny('#new_message'), 'textContent')).to.include('Cannot get reply data for the message you are replying to.');
    }));

    ava.default('compose[global:compatibility] - reply - thread id does not exist', testWithSemaphoredGlobalBrowser('compatibility', async (t, browser) => {
      const appendUrl = 'skipClickPrompt=___cu_false___&ignoreDraft=___cu_false___&threadId=16804894591b3a4b&threadMsgId=16804894591b3a4b';
      const replyFrame = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', { appendUrl, skipValidation: true, });
      await Util.sleep(1);
      // tslint:disable-next-line: no-unused-expression
      expect(await replyFrame.isElementPresent('.action_retry')).to.be.true;
      expect(await PageRecipe.getElementPropertyJson(await replyFrame.waitAny('#new_message'), 'textContent')).to.include('Cannot get reply data for the message you are replying to.');
    }));

    ava.default('compose[global:compose] - standalone - quote - can load quote from encrypted/text email', testWithSemaphoredGlobalBrowser('compatibility', async (t, browser) => {
      const appendUrl = 'threadId=16b584ed95837510&skipClickPrompt=___cu_false___&ignoreDraft=___cu_false___&threadMsgId=16b584ed95837510';
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', { appendUrl, hasReplyPrompt: true });
      await composePage.waitAndClick('@action-accept-reply-prompt', { delay: 5 });
      await baseQuotingTest(composePage, [
        'On 2019-06-14 at 23:24, flowcrypt.compatibility@gmail.com wrote:',
        '> This is some message',
        '>',
        '> and below is the quote',
        '>',
        '> > this is the quote',
        '> > still the quote',
        '> > third line',
        '> >> double quote',
        '> >> again double quote'
      ].join('\n'));
      await ComposePageRecipe.sendAndClose(composePage);
    }));

    ava.default('compose[global:compatibility] - standalone - quote - can load quote from plain/text email', testWithSemaphoredGlobalBrowser('compatibility', async (t, browser) => {
      const appendUrl = 'threadId=16402d6dc4342e7f&skipClickPrompt=___cu_false___&ignoreDraft=___cu_false___' +
        '&threadMsgId=16402d6dc4342e7f';
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', { appendUrl, hasReplyPrompt: true });
      await composePage.waitAndClick('@action-accept-reply-prompt', { delay: 1 });
      await baseQuotingTest(composePage, [
        'On 2018-06-15 at 09:46, info@nvimp.com wrote:',
        '> cropping all except for the image below'
      ].join('\n'));
    }));

    ava.default('compose[global:compatibility] - reply - can load quote from plain/html email', testWithSemaphoredGlobalBrowser('compatibility', async (t, browser) => {
      const appendUrl = 'threadId=16b36861a890bb26&skipClickPrompt=___cu_false___' +
        '&ignoreDraft=___cu_false___&threadMsgId=16b36861a890bb26';
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', { appendUrl, hasReplyPrompt: true });
      await composePage.waitAndClick('@action-accept-reply-prompt', { delay: 1 });
      await baseQuotingTest(composePage, [
        'On 2019-06-08 at 09:57, human@flowcrypt.com wrote:',
        '> Used to fail on Android app',
        '>',
        '> ---------- Forwarded message ---------',
        '> From: Mozilla <Mozilla@e.mozilla.org>',
        '> Date: Thu, 6 Jun 2019, 17:22',
        '> Subject: Your misinformation questions ... answered.',
        '> To: <tom@cryptup.org>'
      ].join('\n'));
    }));

    ava.default('compose[global:compatibility] - reply - can load quote from encrypted/html email', testWithSemaphoredGlobalBrowser('compatibility', async (t, browser) => {
      const appendUrl = 'threadId=1663a65bbd73ce1a&skipClickPrompt=___cu_false___&ignoreDraft=___cu_false___&threadMsgId=1663a65bbd73ce1a';
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', { appendUrl, hasReplyPrompt: true });
      await composePage.waitAndClick('@action-accept-reply-prompt', { delay: 1 });
      await baseQuotingTest(composePage, [
        'On 2018-10-03 at 14:47, henry.electrum@gmail.com wrote:',
        '> The following text is bold: this is bold',
        '>',
        '> The following text is red: this text is red'
      ].join('\n'));
    }));

    ava.default('compose[global:compatibility] - reply - pass phrase dialog - dialog ok', testWithNewBrowser(async (t, browser) => {
      const pp = Config.key('flowcrypt.compatibility.1pp1').passphrase;
      await BrowserRecipe.setUpCommonAcct(t, browser, 'compatibility');
      const { inboxPage, replyFrame } = await setRequirePassPhraseAndOpenRepliedMessage(t, browser, pp);
      // Get Passphrase dialog and write confirm passphrase
      await inboxPage.waitAll('@dialog-passphrase');
      const passPhraseFrame = await inboxPage.getFrame(['passphrase.htm']);
      await passPhraseFrame.waitAndType('@input-pass-phrase', pp);
      await passPhraseFrame.waitAndClick('@action-confirm-pass-phrase-entry');
      await inboxPage.waitTillGone('@dialog');
      // Then we can try to run base test
      await baseQuotingTest(replyFrame, [
        'On 2019-06-14 at 23:24, flowcrypt.compatibility@gmail.com wrote:',
        '> This is some message',
        '>',
        '> and below is the quote',
        '>',
        '> > this is the quote',
        '> > still the quote',
        '> > third line',
        '> >> double quote',
        '> >> again double quote'
      ].join('\n'));
    }));

    ava.default('compose[global:compatibility] - reply - pass phrase dialog - dialog cancel', testWithNewBrowser(async (t, browser) => {
      const pp = Config.key('flowcrypt.compatibility.1pp1').passphrase;
      await BrowserRecipe.setUpCommonAcct(t, browser, 'compatibility');
      const { inboxPage, replyFrame } = await setRequirePassPhraseAndOpenRepliedMessage(t, browser, pp);
      // Get Passphrase dialog and cancel confirm passphrase
      await inboxPage.waitAll('@dialog-passphrase');
      const passPhraseFrame = await inboxPage.getFrame(['passphrase.htm']);
      await passPhraseFrame.waitAndClick('@action-cancel-pass-phrase-entry');
      await inboxPage.waitTillGone('@dialog');
      await replyFrame.waitAll(['@action-expand-quoted-text']);
      // tslint:disable: no-unused-expression
      expect(await replyFrame.read('@input-body')).to.be.empty;
      await baseQuotingTest(replyFrame, [
        'On 2019-06-14 at 23:24, flowcrypt.compatibility@gmail.com wrote:',
        '> (Skipping previous message quote)'
      ].join('\n'));
    }));

    ava.default('compose[global:compatibility] - reply - signed message', testWithSemaphoredGlobalBrowser('compatibility', async (t, browser) => {
      const appendUrl = 'threadId=15f7f5face7101db&skipClickPrompt=___cu_false___&ignoreDraft=___cu_false___&threadMsgId=15f7f5face7101db';
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', { appendUrl, hasReplyPrompt: true });
      await composePage.waitAndClick('@action-accept-reply-prompt', { delay: 1 });
      expect(await PageRecipe.getElementPropertyJson((await composePage.waitAny('@action-send'))!, 'textContent')).to.eq('Sign and Send');
      await composePage.waitAndClick('@action-show-options-popover');
      const sendingOptionSigned = (await composePage.waitAny('@action-choose-signed'))!;
      expect(await PageRecipe.getElementPropertyJson(sendingOptionSigned, 'className')).to.include('active');
      await ComposePageRecipe.fillMsg(composePage, {}, undefined, 'signed', 'reply');
      await ComposePageRecipe.sendAndClose(composePage);
    }));

    ava.default('compose[global:compatibility] - forward - pgp/mime signed-only', testWithSemaphoredGlobalBrowser('compatibility', async (t, browser) => {
      const appendUrl = 'threadId=15f7fc2919788f03&skipClickPrompt=___cu_false___&ignoreDraft=___cu_false___&threadMsgId=15f7fc2919788f03';
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', { appendUrl, hasReplyPrompt: true });
      await composePage.waitAndClick('@action-forward');
      await ComposePageRecipe.fillRecipients(composePage, { to: 'human@flowcrypt.com' }, 'reply');
      expect(await composePage.read('@input-body')).to.include('> This message will contain a separately attached file + signature.');
      await composePage.waitAny('.qq-file-id-0');
    }));

    ava.default('compose[global:compose] - standalone- hide/show btns after signing', testWithSemaphoredGlobalBrowser('compose', async (t, browser) => {
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
      await ComposePageRecipe.fillMsg(composePage, { to: 'test.no.pgp@test.com' }, 'Signed Message', 'signed');
      expect(await composePage.isElementPresent('@add-intro')).to.be.true;
      expect(await composePage.isElementPresent('@password-or-pubkey-container')).to.be.true;
      await composePage.notPresent('@add-intro');
      await composePage.notPresent('@password-or-pubkey-container');
    }));

    ava.default('compose[global:compose] - standalone - CC&BCC new message', testWithSemaphoredGlobalBrowser('compose', async (t, browser) => {
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
      await ComposePageRecipe.fillMsg(composePage, { to: 'human@flowcrypt.com', cc: 'human@flowcrypt.com', bcc: 'human@flowcrypt.com' }, 'Testing CC And BCC');
      await ComposePageRecipe.sendAndClose(composePage);
    }));

    ava.default('compose[global:compatibility] - reply - CC&BCC test reply', testWithSemaphoredGlobalBrowser('compatibility', async (t, browser) => {
      const appendUrl = 'threadId=16ce2c965c75e5a6&skipClickPrompt=___cu_false___&ignoreDraft=___cu_false___&threadMsgId=16ce2c965c75e5a6';
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', { appendUrl, hasReplyPrompt: true });
      await composePage.waitAndClick('@action-accept-reply-all-prompt', { delay: 2 });
      await ComposePageRecipe.fillMsg(composePage, { bcc: "test@email.com" }, undefined, undefined, 'reply');
      await expectRecipientElements(composePage, { to: ['censored@email.com'], cc: ['censored@email.com'] });
      await Util.sleep(3);
      await ComposePageRecipe.sendAndClose(composePage, 'test-pass');
    }));

    ava.default('compose[global:compatibility] - reply - CC&BCC test forward', testWithSemaphoredGlobalBrowser('compatibility', async (t, browser) => {
      const appendUrl = 'threadId=16ce2c965c75e5a6&skipClickPrompt=___cu_false___&ignoreDraft=___cu_false___&threadMsgId=16ce2c965c75e5a6';
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', { appendUrl, hasReplyPrompt: true });
      await composePage.waitAndClick('@action-forward', { delay: 2 });
      await composePage.waitAny('@input-to'); // if this element is present then the elemenent should be focused
      await expectRecipientElements(composePage, { to: [], cc: [], bcc: [] });
    }));

    ava.default('compose[global:compose] - standalone - expired can still send', testWithSemaphoredGlobalBrowser('compose', async (t, browser) => {
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
      await ComposePageRecipe.fillMsg(composePage, { to: 'expired.on.attester@domain.com' }, 'Test Expired Email');
      const expandContainer = await composePage.waitAny('@action-show-container-cc-bcc-buttons');
      const recipient = await expandContainer.$('.email_preview span');
      expect(await PageRecipe.getElementPropertyJson(recipient!, 'className')).to.include('expired');
      await composePage.waitAndClick('@action-send');
      await PageRecipe.waitForModalAndRespond(composePage, 'confirm', { contentToCheck: 'The public key of one of your recipients is expired.', clickOn: 'confirm' });
      await composePage.waitForSelTestState('closed', 20); // succesfully sent
      await composePage.close();
    }));

    ava.default('compose[global:comaptibility] - loading drafts - new message, rendering cc/bcc and check if cc/bcc btns are hidden',
      testWithSemaphoredGlobalBrowser('compatibility', async (t, browser) => {
        const appendUrl = 'draftId=r-8909860425873898730';
        const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', { appendUrl });
        await expectRecipientElements(composePage, { to: ['flowcryptcompatibility@gmail.com'], cc: ['flowcrypt.compatibility@gmail.com'], bcc: ['human@flowcrypt.com'] });
        const subjectElem = await composePage.waitAny('@input-subject');
        expect(await (await subjectElem.getProperty('value')).jsonValue()).to.equal('Test Draft - New Message');
        expect(await composePage.read('@input-body')).to.equal('Testing Drafts (Do not delete)');
        for (const elem of await composePage.target.$$('.email-copy-actions > span')) {
          expect(await PageRecipe.getElementPropertyJson(elem, 'offsetHeight')).to.equal(0); // CC/BCC btn isn't visible
        }
      }));

    ava.default('compose[global:compatibility] - loading drafts - reply', testWithNewBrowser(async (t, browser) => {
      await BrowserRecipe.setUpCommonAcct(t, browser, 'compatibility');
      const appendUrl = 'threadId=16cfa9001baaac0a&skipClickPrompt=___cu_false___&ignoreDraft=___cu_false___&threadMsgId=16cfa9001baaac0a';
      const initialScript = () => {
        chrome.storage.local.set({ 'cryptup_flowcryptcompatibilitygmailcom_drafts_reply': { '16cfa9001baaac0a': 'r-1543309186581841785' } });
      };
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', { appendUrl, hasReplyPrompt: true, skipClickPropt: true, initialScript });
      await composePage.waitAndClick('@action-show-container-cc-bcc-buttons');
      await expectRecipientElements(composePage, { to: ['flowcryptcompatibility@gmail.com'] });
      expect(await composePage.read('@input-body')).to.include('Test Draft Reply (Do not delete, tests is using this draft)');
    }));

    ava.default('key-mismatch[global:compatibility] - standalone - key mismatch loading', testWithSemaphoredGlobalBrowser('compatibility', async (t, browser) => {
      const appendUrl = 'threadId=15f7f5630573be2d&skipClickPrompt=___cu_false___&ignoreDraft=___cu_false___&threadMsgId=15f7f5630573be2d';
      const replyMismatchPage = await ComposePageRecipe.openReplyKeyMismatch(t, browser, 'compatibility', appendUrl);
      await Util.sleep(3);
      const emailsPreview = await replyMismatchPage.waitAny('@email-preview');
      const recipients = await emailsPreview.$$('span');
      expect(recipients.length).to.equal(1);
      const recipientEmail = await (await recipients[0].getProperty('textContent')).jsonValue() as string;
      expect(recipientEmail).to.equal('censored@email.com');
      const text = await replyMismatchPage.read('@input-body');
      expect(text).to.include('I was not able to read your encrypted message because it was encrypted for a wrong key.');
      expect(await replyMismatchPage.isElementPresent('@attachment')).to.be.true;
      await ComposePageRecipe.sendAndClose(replyMismatchPage);
    }));

    ava.default('compose[global:flowcrypt.test.key.new.manual@gmail.com] - standalone - own key expired', testWithNewBrowser(async (t, browser) => {
      const expiredKey = "-----BEGIN PGP PRIVATE KEY BLOCK-----\nVersion: FlowCrypt 7.0.1 Gmail Encryption\nComment: Seamlessly send and receive encrypted email\n\n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\n+gib+vSxHvLhC6oDBA==\n=RIPF\n-----END PGP PRIVATE KEY BLOCK-----"; // tslint:disable: max-line-length
      const validKey = "-----BEGIN PGP PRIVATE KEY BLOCK-----\nVersion: FlowCrypt 7.0.1 Gmail Encryption\nComment: Seamlessly send and receive encrypted email\n\n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\nGw==\n=18AI\n-----END PGP PRIVATE KEY BLOCK-----"; // tslint:disable: max-line-length
      // Setup Expired key
      const settingsPage = await BrowserRecipe.openSettingsLoginApprove(t, browser, 'flowcrypt.test.key.new.manual@gmail.com');
      await settingsPage.waitAndClick('@action-step0foundkey-choose-manual-enter');
      await settingsPage.waitAndClick('@input-step2bmanualenter-source-paste');
      await settingsPage.type('@input-step2bmanualenter-ascii-key', expiredKey);
      await settingsPage.type('@input-step2bmanualenter-passphrase', "qweasd");
      await settingsPage.waitAndClick('@input-step2bmanualenter-save');
      await SettingsPageRecipe.waitForModalAndRespond(settingsPage, 'confirm', { contentToCheck: 'You are importing a key that is expired.', clickOn: 'confirm' });
      await settingsPage.close();
      // Try To send message with expired key
      let composePage = await ComposePageRecipe.openStandalone(t, browser, 'flowcrypt.test.key.new.manual@gmail.com');
      await ComposePageRecipe.fillMsg(composePage, { to: 'human@flowcrypt.com' }, 'Own Key Expired');
      await composePage.waitAndClick('@action-send');
      await ComposePageRecipe.waitForModalAndRespond(composePage, 'error', { contentToCheck: 'your own Private Key is expired' });
      const settingsWithUpdatePrvForm = await browser.newPageTriggeredBy(t, () => composePage.waitAndClick('#action_update_prv'));
      const urls = await settingsWithUpdatePrvForm.getFramesUrls(['my_key_update.htm']);
      await composePage.close();
      await settingsWithUpdatePrvForm.close();
      // Updating the key to valid one
      const updatePrvPage = await browser.newPage(t, urls[0]);
      await updatePrvPage.waitAndType('@input-prv-key', validKey);
      await updatePrvPage.type('@input-passphrase', 'qweasd');
      await updatePrvPage.waitAndClick('@action-update-key');
      await PageRecipe.waitForModalAndRespond(updatePrvPage, 'confirm', { clickOn: 'confirm' });
      await updatePrvPage.close();
      // Try send message again
      composePage = await ComposePageRecipe.openStandalone(t, browser, 'flowcrypt.test.key.new.manual@gmail.com');
      await ComposePageRecipe.fillMsg(composePage, { to: 'human@flowcrypt.com' }, 'Own Key Expired');
      await ComposePageRecipe.sendAndClose(composePage);
    }));

    ava.default('compose[global:compatibility] - reply all - TO/CC/BCC when replying all', testWithSemaphoredGlobalBrowser('compatibility', async (t, browser) => {
      const appendUrl = `threadId=16d6a6c2d6ae618f&skipClickPrompt=___cu_false___&ignoreDraft=___cu_false___&threadMsgId=16d6a6c2d6ae618f`;
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', { appendUrl, hasReplyPrompt: true });
      await composePage.waitAndClick('@action-accept-reply-all-prompt');
      await composePage.waitForSelTestState('ready'); // continue when all recipients get evaluated
      await composePage.waitAndClick('@action-show-container-cc-bcc-buttons');
      for (const type of ['to', 'cc', 'bcc']) {
        const container = (await composePage.waitAny(`@container-${type}`))!;
        const recipients = await container.$$('.recipients > span');
        expect(recipients.length).to.equal(2);
        for (const recipient of recipients) {
          const textContent = await PageRecipe.getElementPropertyJson(recipient, 'textContent');
          expect(textContent.trim()).to.include('@flowcrypt.com');
        }
      }
    }));

    ava.default('compose[global:compose] - standalone - send new plain message', testWithSemaphoredGlobalBrowser('compose', async (t, browser) => {
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
      await ComposePageRecipe.fillMsg(composePage, { to: 'human@flowcrypt.com' }, 'New Plain Message', 'plain');
      await ComposePageRecipe.sendAndClose(composePage);
    }));

    ava.default('compose[global:compose] - standalone - testing sending options popover', testWithSemaphoredGlobalBrowser('compose', async (t, browser) => {
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
      await composePage.waitAndClick('@action-show-options-popover');
      for (const element of await composePage.target.$$('.sending-options-container')) {
        if (!element) {
          throw new Error('Error: option cannot be empty');
        }
        const optionName = (await element.$('.option-name'))!;
        const elementText = await PageRecipe.getElementPropertyJson(optionName, 'textContent');
        expect(elementText).not.to.be.empty;
        expect(await element!.$('.option-name img')!).not.to.be.empty;
        await optionName.click();
        expect(elementText).to.include(await PageRecipe.getElementPropertyJson(await composePage.waitAny('@action-send'), 'textContent'));
        await composePage.waitAndClick('@action-show-options-popover');
        expect(await element.$('img.icon-tick')).to.not.be.empty;
      }
    }));

    ava.default('compose[global:compose] - standalone - load contacts through API', testWithNewBrowser(async (t, browser) => {
      await BrowserRecipe.setUpCommonAcct(t, browser, 'compose');
      let composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
      await composePage.waitAndClick('@action-show-container-cc-bcc-buttons');
      // first search, did not yet receive contacts scope
      await composePage.type('@input-to', 'contact');
      let contacts = await composePage.waitAny('@container-contacts');
      expect(await PageRecipe.getElementPropertyJson((await contacts.$('ul li:first-child'))!, 'textContent')).to.eq('No Contacts Found');
      // allow contacts scope, and expect that it will find a contact
      const oauthPopup = await browser.newPageTriggeredBy(t, () => composePage.waitAndClick('@action-auth-with-contacts-scope'), 'test.ci.compose@org.flowcrypt.com');
      await OauthPageRecipe.google(t, oauthPopup, 'test.ci.compose@org.flowcrypt.com', 'approve');
      contacts = await composePage.waitAny('@container-contacts');
      expect(await PageRecipe.getElementPropertyJson((await contacts.$('ul li:first-child'))!, 'textContent')).to.eq('contact.test@flowcrypt.com');
      // re-load the compose window, expect that it remembers scope was connected, and remembers the contact
      composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
      await composePage.waitAndClick('@action-show-container-cc-bcc-buttons');
      await composePage.type('@input-to', 'contact');
      contacts = await composePage.waitAny('@container-contacts');
      await composePage.notPresent('@action-auth-with-contacts-scope');
      expect(await PageRecipe.getElementPropertyJson((await contacts.$('ul li:first-child'))!, 'textContent')).to.eq('contact.test@flowcrypt.com');
    }));

    ava.todo('compose[global:compose] - reply - new gmail threadId fmt');

    ava.todo('compose[global:compose] - reply - skip click prompt');

  }

};

const setRequirePassPhraseAndOpenRepliedMessage = async (t: AvaContext, browser: BrowserHandle, passpharase: string) => {
  const settingsPage = await browser.newPage(t, Url.extensionSettings());
  await SettingsPageRecipe.changePassphraseRequirement(settingsPage, passpharase, 'session');
  // Open Message Page
  const inboxPage = await browser.newPage(t, Url.extension(`chrome/settings/inbox/inbox.htm?acctEmail=flowcrypt.compatibility@gmail.com&threadId=16b584ed95837510`));
  await inboxPage.waitAll('iframe');
  // Get Reply Window (Composer) and click on reply button.
  const replyFrame = await inboxPage.getFrame(['compose.htm']);
  await replyFrame.waitAndClick('@action-accept-reply-prompt');

  return { inboxPage, replyFrame };
};

const baseQuotingTest = async (composePage: Controllable, textToInclude: string) => {
  await composePage.waitAll(['@action-expand-quoted-text']);
  await Util.sleep(2); // wait for quote to be loaded and button activated
  expect(await composePage.read('@input-body')).to.not.include(textToInclude);
  await composePage.waitAndClick('@action-expand-quoted-text');
  await composePage.waitTillGone(['@action-expand-quoted-text']);
  expect(await composePage.read('@input-body')).to.include(textToInclude);
};

const expectRecipientElements = async (controllable: ControllablePage, expected: { to?: string[], cc?: string[], bcc?: string[] }) => {
  for (const type of ['to', 'cc', 'bcc']) {
    const expectedEmails: string[] = (expected as Dict<string[]>)[type] || []; // tslint:disable-line:no-unsafe-any
    const container = await controllable.waitAny(`@container-${type}`, { visible: false });
    const recipientElements = await container.$$('.recipients > span');
    expect(recipientElements.length).to.equal(expectedEmails.length);
    for (const recipientElement of recipientElements) {
      const textContent = await (await recipientElement.getProperty('textContent')).jsonValue() as string;
      expect(expectedEmails).to.include(textContent.trim());
    }
  }
};
