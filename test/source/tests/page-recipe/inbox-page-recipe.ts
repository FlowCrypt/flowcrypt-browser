/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { BrowserHandle, ControllableFrame, ControllablePage } from '../../browser';

import { AvaContext } from '../tooling/';
import { PageRecipe } from './abstract-page-recipe';
import { TestUrls } from '../../browser/test-urls';
import { Util } from '../../util';
import { expect } from 'chai';

type CheckDecryptMsg$opt = {
  acctEmail: string, threadId: string, expectedContent: string, finishCurrentSession?: boolean,
  enterPp?: { passphrase: string, isForgetPpHidden?: boolean, isForgetPpChecked?: boolean }
};
type CheckSentMsg$opt = { acctEmail: string, subject: string, expectedContent?: string, isEncrypted?: boolean, isSigned?: boolean, sender?: string };

export class InboxPageRecipe extends PageRecipe {

  public static checkDecryptMsg = async (t: AvaContext, browser: BrowserHandle,
    { acctEmail, threadId, enterPp, expectedContent, finishCurrentSession }: CheckDecryptMsg$opt) => {
    const inboxPage = await browser.newPage(t, TestUrls.extension(`chrome/settings/inbox/inbox.htm?acctEmail=${acctEmail}&threadId=${threadId}`));
    await inboxPage.waitAll('iframe');
    if (finishCurrentSession) {
      await InboxPageRecipe.finishSessionOnInboxPage(inboxPage);
      await inboxPage.waitAll('iframe');
    }
    const pgpBlockFrame = await inboxPage.getFrame(['pgp_block.htm']);
    await pgpBlockFrame.waitAll('@pgp-block-content');
    await pgpBlockFrame.waitForSelTestState('ready');
    if (enterPp) {
      await inboxPage.notPresent("@action-finish-session");
      await pgpBlockFrame.waitAndClick('@action-show-passphrase-dialog', { delay: 1 });
      await inboxPage.waitAll('@dialog-passphrase');
      const ppFrame = await inboxPage.getFrame(['passphrase.htm']);
      await ppFrame.waitAndType('@input-pass-phrase', enterPp.passphrase);
      if (enterPp.isForgetPpHidden !== undefined) {
        expect(await ppFrame.hasClass('@forget-pass-phrase-label', 'hidden')).to.equal(enterPp.isForgetPpHidden);
      }
      if (enterPp.isForgetPpChecked !== undefined) {
        expect(await ppFrame.isChecked('@forget-pass-phrase-checkbox')).to.equal(enterPp.isForgetPpChecked);
      }
      await ppFrame.waitAndClick('@action-confirm-pass-phrase-entry', { delay: 1 });
      await pgpBlockFrame.waitForSelTestState('ready');
      await inboxPage.waitAll('@action-finish-session');
      await Util.sleep(1);
    }
    const content = await pgpBlockFrame.read('@pgp-block-content');
    if (content.indexOf(expectedContent) === -1) {
      throw new Error(`message did not decrypt`);
    }
    await inboxPage.close();
  }

  public static finishSessionOnInboxPage = async (inboxPage: ControllablePage) => {
    await inboxPage.waitAndClick('@action-finish-session');
    await inboxPage.waitTillGone('@action-finish-session');
    await Util.sleep(3); // give frames time to reload, else we will be manipulating them while reloading -> Error: waitForFunction failed: frame got detached.
  }

  public static checkFinishingSession = async (t: AvaContext, browser: BrowserHandle, acctEmail: string, threadId: string) => {
    const inboxPage = await browser.newPage(t, TestUrls.extension(`chrome/settings/inbox/inbox.htm?acctEmail=${acctEmail}&threadId=${threadId}`));
    await InboxPageRecipe.finishSessionOnInboxPage(inboxPage);
    await inboxPage.waitAll('iframe');
    const pgpBlockFrame = await inboxPage.getFrame(['pgp_block.htm']);
    await pgpBlockFrame.waitAll('@pgp-block-content');
    await pgpBlockFrame.waitForSelTestState('ready');
    await pgpBlockFrame.waitAndClick('@action-show-passphrase-dialog', { delay: 1 });
    await inboxPage.waitAll('@dialog-passphrase');
  }

  public static checkSentMsg = async (t: AvaContext, browser: BrowserHandle, { acctEmail, subject, expectedContent, isEncrypted, isSigned, sender }: CheckSentMsg$opt) => {
    if (typeof isSigned !== 'undefined') {
      throw new Error('checkSentMsg.isSigned not implemented');
    }
    if (typeof expectedContent !== 'undefined') {
      throw new Error('checkSentMsg.expectedContent not implemented');
    }
    if (typeof isEncrypted !== 'undefined') {
      throw new Error('checkSentMsg.isEncrypted not implemented');
    }
    const inboxPage = await browser.newPage(t, TestUrls.extension(`chrome/settings/inbox/inbox.htm?acctEmail=${acctEmail}&labelId=SENT`));
    await inboxPage.waitAndClick(`@container-subject(${subject})`, { delay: 1 });
    if (sender) { // make sure it was sent from intended addr
      await inboxPage.waitAll(`@container-msg-header(${sender})`);
    }
    await inboxPage.close();
  }

  public static openAndGetComposeFrame = async (inboxPage: ControllablePage): Promise<ControllableFrame> => {
    await inboxPage.waitAndClick('@action-open-secure-compose-window');
    await inboxPage.waitAll('@container-new-message');
    await Util.sleep(0.5);
    const composeFrame = await inboxPage.getFrame(['compose.htm']);
    await composeFrame.waitAll(['@input-body', '@input-subject', '@action-send', '@container-cc-bcc-buttons']);
    await composeFrame.waitForSelTestState('ready');
    return composeFrame;
  }

}
