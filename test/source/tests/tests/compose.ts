import { TestWithNewBrowser, TestWithGlobalBrowser } from '../../test';
import { ComposePageRecipe, SettingsPageRecipe, InboxPageRecipe } from '../page_recipe';
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

    ava.default('compose - standalone - can set and remember default send address', testWithNewBrowser(async (t, browser) => {
      await BrowserRecipe.setUpCommonAcct(t, browser, 'compatibility');
      let composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility');
      await ComposePageRecipe.changeDefSendingAddr(composePage, 'flowcrypt.compatibility@gmail.com');
      await composePage.close();
      composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility');
      let currentlySelectedFrom = await composePage.value('@input-from');
      if (currentlySelectedFrom !== 'flowcrypt.compatibility@gmail.com') {
        throw new Error('did not remember selected from addr: flowcrypt.compatibility@gmail.com');
      }
      await ComposePageRecipe.changeDefSendingAddr(composePage, 'flowcryptcompatibility@gmail.com');
      await composePage.close();
      composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility');
      currentlySelectedFrom = await composePage.value('@input-from');
      if (currentlySelectedFrom !== 'flowcryptcompatibility@gmail.com') {
        throw new Error('did not remember selected from addr: flowcryptcompatibility@gmail.com');
      }
      await ComposePageRecipe.changeDefSendingAddr(composePage, 'flowcrypt.compatibility@gmail.com');
      await composePage.close();
    }));

    ava.default('[standalone] compose - signed with entered pass phrase + will remember pass phrase in session', testWithNewBrowser(async (t, browser) => {
      const k = Config.key('test.ci.compose');
      await BrowserRecipe.setUpCommonAcct(t, browser, 'compose');
      const settingsPage = await browser.newPage(t, Url.extensionSettings('test.ci.compose@org.flowcrypt.com'));
      await SettingsPageRecipe.changePassphraseRequirement(settingsPage, k.passphrase, 'session');
      const composeFrame = await ComposePageRecipe.openInSettings(settingsPage);
      await ComposePageRecipe.fillMsg(composeFrame, { to: 'human@flowcrypt.com' }, 'sign with entered pass phrase');
      await composeFrame.waitAndClick('@action-switch-to-sign', { delay: 0.5 });
      await composeFrame.waitAndClick('@action-send');
      await settingsPage.waitAll('@dialog-passphrase');
      const passphraseDialog = await settingsPage.getFrame(['passphrase.htm']);
      await passphraseDialog.waitAndType('@input-pass-phrase', k.passphrase);
      await passphraseDialog.waitAndClick('@action-confirm-pass-phrase-entry'); // confirming pass phrase will send the message
      await settingsPage.waitTillGone('@dialog'); // however the @dialog would not go away - so that is a (weak but sufficient) telling sign
      // signed - done, now try to see if it remembered pp in session
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
      await ComposePageRecipe.fillMsg(composePage, { to: 'human@flowcrypt.com' }, 'signed message pp in session');
      await composePage.click('@action-switch-to-sign'); // should remember pass phrase in session from previous entry
      await ComposePageRecipe.sendAndClose(composePage);
      await settingsPage.close();
    }));

    ava.default('[standalone] compose - can load contact based on name', testWithNewBrowser(async (t, browser) => {
      await BrowserRecipe.setUpCommonAcct(t, browser, 'compose');
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
      await composePage.click('@action-expand-cc-bcc-fields');
      await composePage.type('@input-to', 'human'); // test loading of contacts
      await composePage.waitAll(['@container-contacts', '@action-select-contact(human@flowcrypt.com)']);
    }));

    ava.default(`[standalone] compose - can choose found contact`, testWithNewBrowser(async (t, browser) => {
      await BrowserRecipe.setUpCommonAcct(t, browser, 'compose');
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
      // composePage.enable_debugging('choose-contact');
      await composePage.click('@action-expand-cc-bcc-fields');
      await composePage.type('@input-to', 'human'); // test loading of contacts
      await composePage.waitAll(['@container-contacts', '@action-select-contact(human@flowcrypt.com)'], { timeout: 30 });
      await composePage.waitAndClick('@action-select-contact(human@flowcrypt.com)', { retryErrs: true, confirmGone: true, delay: 0 });
      // todo - verify that the contact/pubkey is showing in green once clicked
      await composePage.click('@input-subject');
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
      await ComposePageRecipe.fillMsg(composePage, { to: 'human@flowcrypt.com' }, 'signed message');
      await composePage.click('@action-switch-to-sign');
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
      const appendUrl = 'isReplyBox=___cu_true___&skipClickPrompt=___cu_false___&ignoreDraft=___cu_false___' +
        '&to=human%40flowcrypt.com&from=flowcrypt.compatibility%40gmail.com&subject=message%20for%20ci%20reply' +
        '&threadId=16841ce0ce5cb74d&threadMsgId=16841ce0ce5cb74d';
      const replyFrame = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', { appendUrl, hasReplyPrompt: true });
      await replyFrame.waitAndClick('@action-accept-reply-prompt', { delay: 1 });
      await replyFrame.waitAndType('@input-body', `This is an automated puppeteer test: old gmail threadId fmt reply`, { delay: 1 });
      await Util.sleep(3); // todo: should wait until actually loaded
      await ComposePageRecipe.sendAndClose(replyFrame);
    }));

    ava.default('compose[global:compatibility] - reply - thread id does not exist', testWithSemaphoredGlobalBrowser('compatibility', async (t, browser) => {
      const appendUrl = 'isReplyBox=___cu_true___&skipClickPrompt=___cu_false___&ignoreDraft=___cu_false___' +
        '&to=human%40flowcrypt.com&from=flowcrypt.compatibility%40gmail.com&subject=Re%3A%20Automated%20puppeteer%20test%3A%20reply' +
        '&threadId=16804894591b3a4b&threadMsgId=16804894591b3a4b';
      const replyFrame = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', { appendUrl, hasReplyPrompt: true });
      await replyFrame.waitAndClick('@action-accept-reply-prompt', { delay: 1 });
      await replyFrame.waitAndType('@input-body', `This is an automated puppeteer test: thread id does not exist reply`, { delay: 1 });
      await Util.sleep(3); // todo: should wait until actually loaded
      await ComposePageRecipe.sendAndClose(replyFrame);
    }));

    ava.default('compose[global:compose] - standalone - quote - can load quote from encrypted/text email', testWithSemaphoredGlobalBrowser('compatibility', async (t, browser) => {
      const appendUrl = 'isReplyBox=___cu_true___&threadId=16b584ed95837510&skipClickPrompt=___cu_false___&ignoreDraft=___cu_false___' +
        '&threadMsgId=16b584ed95837510&to=flowcrypt.compatibility%40gmail.com&from=flowcrypt.compatibility%40gmail.com' +
        '&subject=Re%3A%20testing%20quotes';
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
      const appendUrl = 'isReplyBox=___cu_true___&threadId=16402d6dc4342e7f&skipClickPrompt=___cu_false___&ignoreDraft=___cu_false___' +
        '&threadMsgId=16402d6dc4342e7f&to=Tom%20James%20Holub%20%3Ccensored%40email.com%3E&from=flowcrypt.compatibility%40gmail.com' +
        '&subject=Re%3A%20received%20MMS%20from%20google%20voice%20should%20not%20get%20FlowCrypt%20confused';
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', { appendUrl, hasReplyPrompt: true });
      await composePage.waitAndClick('@action-accept-reply-prompt', { delay: 1 });
      await baseQuotingTest(composePage, [
        'On 2018-06-15 at 09:46, info@nvimp.com wrote:',
        '> cropping all except for the image below'
      ].join('\n'));
    }));

    ava.default('compose[global:compatibility] - reply - can load quote from plain/html email', testWithSemaphoredGlobalBrowser('compatibility', async (t, browser) => {
      const appendUrl = 'isReplyBox=___cu_true___&threadId=16b36861a890bb26&skipClickPrompt=___cu_false___' +
        '&ignoreDraft=___cu_false___&threadMsgId=16b36861a890bb26&to=Human%20at%20FlowCrypt%20%3Chuman%40flowcrypt.com%3E' +
        '&from=flowcrypt.compatibility%40gmail.com&subject=Re%3A%20Plain%20text%20html%20utf';
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
      const appendUrl = 'isReplyBox=___cu_true___&threadId=1663a65bbd73ce1a&skipClickPrompt=___cu_false___&ignoreDraft=___cu_false___' +
        '&threadMsgId=1663a65bbd73ce1a&to=Henry%20Electrum%20%3Ccensored%40email.com%3E&from=flowcrypt.compatibility%40gmail.com' +
        '&subject=Re%3A%20Encrypted%20Message';
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
      const appendUrl = 'isReplyBox=___cu_true___&threadId=15f7f5face7101db&skipClickPrompt=___cu_false___&ignoreDraft=___cu_false___' +
        '&threadMsgId=15f7f5face7101db&to=censored%40email.com&from=flowcrypt.compatibility%40gmail.com&subject=signed%20utf8%20(inline)';
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', { appendUrl, hasReplyPrompt: true });
      await composePage.waitAndClick('@action-accept-reply-prompt', { delay: 1 });
      await Util.sleep(3);
      const iconSign = await composePage.waitAny('@action-switch-to-sign');
      expect(await composePage.attr(iconSign!, 'className')).to.include('active');
    }));

    ava.default('compose[global:compose] - standalone- hide/show btns after signing', testWithSemaphoredGlobalBrowser('compose', async (t, browser) => {
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
      await ComposePageRecipe.fillMsg(composePage, { to: 'test.no.pgp@test.com' }, 'Signed Message');
      expect(await composePage.isElementPresent('@add-intro')).to.be.true;
      expect(await composePage.isElementPresent('@password-or-pubkey-container')).to.be.true;
      await composePage.waitAndClick('@action-switch-to-sign', { delay: 0.5 });
      await composePage.notPresent('@add-intro');
      await composePage.notPresent('@password-or-pubkey-container');
    }));

    ava.default('compose[global:compose] - standalone - CC&BCC new message', testWithSemaphoredGlobalBrowser('compose', async (t, browser) => {
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
      await ComposePageRecipe.fillMsg(composePage, { to: 'human@flowcrypt.com', cc: 'human@flowcrypt.com', bcc: 'human@flowcrypt.com' }, 'Testing CC And BCC');
      await ComposePageRecipe.sendAndClose(composePage);
    }));

    ava.default('compose[global:compatibility] - standalone - cc & bcc test reply', testWithSemaphoredGlobalBrowser('compatibility', async (t, browser) => {
      const appendUrl = 'isReplyBox=___cu_true___&threadId=16ce2c965c75e5a6&skipClickPrompt=___cu_false___&ignoreDraft=___cu_false___&threadMsgId=16ce2c965c75e5a6';
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', { appendUrl, hasReplyPrompt: true });
      await composePage.waitAndClick('@action-accept-reply-all-prompt', { delay: 3 });
      await ComposePageRecipe.fillMsg(composePage, { bcc: "test@email.com" });
      await expectRecipientElements(composePage, { to: ['censored@email.com'], cc: ['censored@email.com'] });
      await Util.sleep(3);
      await ComposePageRecipe.sendAndClose(composePage, 'test-pass');
    }));

    ava.default('compose[global:compose] - standalone - expired can still send', testWithSemaphoredGlobalBrowser('compose', async (t, browser) => {
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compose');
      await ComposePageRecipe.fillMsg(composePage, { to: 'expired.on.attester@domain.com' }, 'Test Expired Email');
      const expandContainer = await composePage.waitAny('@action-expand-cc-bcc-fields');
      const recipient = await expandContainer.$('.email_preview span');
      expect(await getElementPropertyJson(recipient!, 'className')).to.include('expired');
      await composePage.click('@action-send');
      await Util.sleep(3);
      const modalErrorContent = await composePage.target.$('.ui-modal-confirm .swal2-content');
      expect(await getElementPropertyJson(modalErrorContent!, 'textContent')).to.include('The public key of one of your recipients is expired.');
      await (await composePage.target.$('.swal2-confirm'))!.click();
      await composePage.waitForSelTestState('closed', 20); // succesfully sent
      await composePage.close();
    }));

    ava.default('compose[global:comaptibility] - loading drafts - new message', testWithSemaphoredGlobalBrowser('compatibility', async (t, browser) => {
      const appendUrl = 'draftId=r300954446589633295';
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', { appendUrl });
      await composePage.click('@action-expand-cc-bcc-fields');
      await expectRecipientElements(composePage, { to: ['flowcryptcompatibility@gmail.com'] });
      const subjectElem = await composePage.waitAny('@input-subject');
      expect(await (await subjectElem.getProperty('value')).jsonValue()).to.equal('Test Draft - New Message');
      expect(await composePage.read('@input-body')).to.equal('Testing Drafts (Do not delete)');
    }));

    ava.default('compose[global:compatibility] - loading drafts - reply', testWithNewBrowser(async (t, browser) => {
      await BrowserRecipe.setUpCommonAcct(t, browser, 'compatibility');
      const appendUrl = 'isReplyBox=___cu_true___&threadId=16cfa9001baaac0a&skipClickPrompt=___cu_false___&ignoreDraft=___cu_false___&threadMsgId=16cfa9001baaac0a';
      const initialScript = () => {
        chrome.storage.local.set({ 'cryptup_flowcryptcompatibilitygmailcom_drafts_reply': { '16cfa9001baaac0a': 'r-1543309186581841785' } });
      };
      const composePage = await ComposePageRecipe.openStandalone(t, browser, 'compatibility', { appendUrl, hasReplyPrompt: true, skipClickPropt: true, initialScript });
      await composePage.click('@action-expand-cc-bcc-fields');
      await expectRecipientElements(composePage, { to: ['flowcryptcompatibility@gmail.com'] });
      expect(await composePage.read('@input-body')).to.include('Test Draft Reply (Do not delete, tests is using this draft)');
    }));

    ava.default('key-mismatch[global:compatibility] - standalone - key mismatch loading', testWithSemaphoredGlobalBrowser('compatibility', async (t, browser) => {
      const appendUrl = 'isReplyBox=___cu_true___&threadId=15f7f5630573be2d&skipClickPrompt=___cu_false___&ignoreDraft=___cu_false___' +
        '&threadMsgId=15f7f5630573be2d';
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
  await composePage.click('@action-expand-quoted-text');
  await composePage.waitTillGone(['@action-expand-quoted-text']);
  expect(await composePage.read('@input-body')).to.include(textToInclude);
};

const expectRecipientElements = async (controllable: ControllablePage, expected: { to?: string[], cc?: string[], bcc?: string[] }) => {
  for (const type of ['to', 'cc', 'bcc']) {
    const expectedEmails: string[] = (expected as Dict<string[]>)[type] || []; // tslint:disable-line:no-unsafe-any
    const container = await controllable.waitAny('@container-to', { visible: false });
    const recipientElements = await container.$$('.recipients span');
    expect(recipientElements.length).to.not.equal(expectedEmails.length);
    for (const recipientElement of recipientElements) {
      const textContent = await (await recipientElement.getProperty('textContent')).jsonValue() as string;
      expect(expectedEmails).to.include(textContent.trim());
    }
  }
};

const getElementPropertyJson = async (elem: ElementHandle<Element>, property: string) => await (await elem.getProperty(property)).jsonValue() as string;
