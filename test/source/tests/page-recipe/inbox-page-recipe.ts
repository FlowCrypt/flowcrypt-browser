/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { BrowserHandle, ControllableFrame, ControllablePage } from '../../browser';

import { AvaContext } from '../tooling/';
import { PageRecipe } from './abstract-page-recipe';
import { TestMessageAndSession, Util } from '../../util';
import { BrowserRecipe } from '../tooling/browser-recipe';

type CheckDecryptMsg$opt = {
  acctEmail: string;
  threadId: string;
} & TestMessageAndSession;

type CheckSentMsg$opt = {
  acctEmail: string;
  subject: string;
  expectedContent?: string;
  isEncrypted?: boolean;
  isSigned?: boolean;
  sender?: string;
};

export class InboxPageRecipe extends PageRecipe {
  public static checkDecryptMsg = async (t: AvaContext, browser: BrowserHandle, m: CheckDecryptMsg$opt) => {
    const inboxPage = await browser.newExtensionPage(t, `chrome/settings/inbox/inbox.htm?acctEmail=${m.acctEmail}&threadId=${m.threadId}`);
    await BrowserRecipe.checkDecryptMsgOnPage(t, inboxPage, m);
    await inboxPage.close();
  };

  public static checkSentMsg = async (
    t: AvaContext,
    browser: BrowserHandle,
    { acctEmail, subject, expectedContent, isEncrypted, isSigned, sender }: CheckSentMsg$opt
  ) => {
    if (typeof isSigned !== 'undefined') {
      throw new Error('checkSentMsg.isSigned not implemented');
    }
    if (typeof expectedContent !== 'undefined') {
      throw new Error('checkSentMsg.expectedContent not implemented');
    }
    if (typeof isEncrypted !== 'undefined') {
      throw new Error('checkSentMsg.isEncrypted not implemented');
    }
    const inboxPage = await browser.newExtensionPage(t, `chrome/settings/inbox/inbox.htm?acctEmail=${acctEmail}&labelId=SENT`);
    await inboxPage.waitAndClick(`@container-subject(${subject})`, { delay: 1 });
    if (sender) {
      // make sure it was sent from intended addr
      await inboxPage.waitAll(`@container-msg-header(${sender})`);
    }
    await inboxPage.close();
  };

  public static openAndGetComposeFrame = async (inboxPage: ControllablePage): Promise<ControllableFrame> => {
    await inboxPage.waitAndClick('@action-open-secure-compose-window');
    await inboxPage.waitAll('@container-new-message');
    await Util.sleep(0.5);
    const composeFrame = await inboxPage.getFrame(['compose.htm']);
    await composeFrame.waitAll(['@input-body', '@input-subject', '@action-send', '@container-cc-bcc-buttons']);
    await composeFrame.waitForSelTestState('ready');
    return composeFrame;
  };
}
