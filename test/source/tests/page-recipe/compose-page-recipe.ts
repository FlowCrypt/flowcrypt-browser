/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { BrowserHandle, Controllable, ControllableFrame, ControllablePage } from '../../browser';

import { AvaContext } from '../tooling/';
import { CommonAcct } from '../../test';
import { EvaluateFn } from 'puppeteer';
import { PageRecipe } from './abstract-page-recipe';
import { Util } from '../../util';

type RecipientType = "to" | "cc" | "bcc";
type Recipients = {
  [key in RecipientType]?: string;
};

type PopoverOpt = 'encrypt' | 'sign' | 'richtext';

export class ComposePageRecipe extends PageRecipe {

  public static async openStandalone(
    t: AvaContext, browser: BrowserHandle, group: CommonAcct | string, options:
      { appendUrl?: string, hasReplyPrompt?: boolean, skipClickPropt?: boolean, skipValidation?: boolean, initialScript?: EvaluateFn } = {}
  ): Promise<ControllablePage> {
    if (group === 'compatibility') { // More common accounts
      group = 'flowcrypt.compatibility@gmail.com';
    } else if (group === 'compose') {
      group = 'ci.tests.gmail@flowcrypt.dev';
    }
    const email = encodeURIComponent(group);
    const composePage = await browser.newPage(t, `chrome/elements/compose.htm?account_email=${email}&parent_tab_id=0&debug=___cu_true___&frameId=none&${options.appendUrl || ''}`,
      options.initialScript);
    // await composePage.page.on('console', msg => console.log(`compose-dbg:${msg.text()}`));
    if (!options.skipValidation) {
      if (!options.hasReplyPrompt) {
        await composePage.waitAll(['@input-body', '@input-subject', '@action-send']);
        await composePage.waitAny(['@action-show-container-cc-bcc-buttons', '@container-cc-bcc-buttons']);
      } else {
        if (options.skipClickPropt) {
          await Util.sleep(2);
        } else {
          await composePage.waitAll(['@action-accept-reply-prompt']);
        }
      }
      await composePage.waitForSelTestState('ready');
    }
    return composePage;
  }

  public static async fillMsg(
    composePageOrFrame: Controllable,
    recipients: Recipients,
    subject?: string | undefined,
    sendingOpt: { encrypt?: boolean, sign?: boolean, richtext?: boolean } = {}, // undefined means leave default
    windowType: 'new' | 'reply' = 'new'
  ) {
    await Util.sleep(0.5);
    await ComposePageRecipe.fillRecipients(composePageOrFrame, recipients, windowType);
    if (subject) {
      await composePageOrFrame.click('@input-subject');
      await Util.sleep(1);
      await composePageOrFrame.type('@input-subject', subject?.match(/RTL/) ? subject : `Automated puppeteer test: ${subject}`);
    }
    const sendingOpts = sendingOpt as { [key: string]: boolean | undefined };
    for (const opt of Object.keys(sendingOpts)) {
      const shouldBeTicked = sendingOpts[opt];
      if (typeof shouldBeTicked !== 'undefined') {
        await ComposePageRecipe.setPopoverToggle(composePageOrFrame, opt as PopoverOpt, shouldBeTicked);
      }
    }
    const body = subject?.match(/RTL/) ? 'مرحبا' : `This is an automated puppeteer test: ${subject || '(no-subject)'}`;
    await composePageOrFrame.type('@input-body', body);
    return { subject, body };
  }

  public static setPopoverToggle = async (composePageOrFrame: Controllable, opt: PopoverOpt, shouldBeTicked: boolean) => {
    await composePageOrFrame.waitAndClick('@action-show-options-popover');
    await composePageOrFrame.waitAll('@container-sending-options');
    const isCurrentlyTicked = await composePageOrFrame.isElementPresent(`@icon-toggle-${opt}-tick`);
    if ((!isCurrentlyTicked && shouldBeTicked) || (isCurrentlyTicked && !shouldBeTicked)) { // not in desired state
      await composePageOrFrame.waitAndClick(`@action-toggle-${opt}`); // toggling should set it to desired state
    } else { // in desired state
      await composePageOrFrame.waitAndClick('@input-body'); // close popover
    }
    await composePageOrFrame.waitTillGone('@container-sending-options');
  }

  public static fillRecipients = async (composePageOrFrame: Controllable, recipients: Recipients, windowType: 'new' | 'reply' | 'forward') => {
    if (windowType === 'reply') { // new messages should already have cc/bcc buttons visible, because they should have recipients in focus
      await composePageOrFrame.waitAndClick('@action-show-container-cc-bcc-buttons');
    }
    await composePageOrFrame.waitAll('@container-cc-bcc-buttons');
    for (const key of Object.keys(recipients)) {
      const sendingType = key as RecipientType;
      const email = recipients[sendingType] as string | undefined;
      if (email) {
        if (sendingType !== 'to') { // input-to is always visible
          await composePageOrFrame.waitAndClick(`@action-show-${sendingType}`);
        }
        await composePageOrFrame.waitAndType(`@input-${sendingType}`, email);
        await Util.sleep(1);
      }
    }
    await composePageOrFrame.target.evaluate(() => { $('#input_text').focus(); });
    await Util.sleep(1);
  }

  public static waitWhenDraftIsSaved = async (composePageOrFrame: Controllable) => {
    await composePageOrFrame.verifyContentIsPresentContinuously('@send-btn-note', 'Saved');
  }

  public static waitWhenDraftIsSavedLocally = async (composePageOrFrame: Controllable) => {
    await composePageOrFrame.verifyContentIsPresentContinuously('@send-btn-note', 'Draft saved locally (offline)');
  }

  public static sendAndClose = async (
    composePage: ControllablePage,
    { password, timeout, expectProgress }: { password?: string, timeout?: number, expectProgress?: boolean } = { timeout: 60 }
  ) => {
    if (password) {
      await composePage.waitAndType('@input-password', password);
    }
    await composePage.waitAndClick('@action-send', { delay: 1 });
    if (expectProgress) {
      await composePage.waitForContent('@action-send', '%', 20, 10);
    }
    await ComposePageRecipe.closed(composePage, timeout);
  }

  public static closed = async (composePage: ControllablePage, timeout = 60) => {
    await Promise.race([
      composePage.waitForSelTestState('closed', timeout), // in case this was a new message compose
      composePage.waitAny('@container-reply-msg-successful', { timeout }) // in case of reply
    ]);
    await composePage.close();
  }

}
