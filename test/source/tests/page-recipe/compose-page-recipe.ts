/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { BrowserHandle, Controllable, ControllableFrame, ControllablePage } from '../../browser';

import { AvaContext } from '../tooling/';
import { CommonAcct } from '../../test';
import { EvaluateFunc } from 'puppeteer';
import { PageRecipe } from './abstract-page-recipe';
import { Util } from '../../util';
import { expect } from 'chai';

type RecipientType = 'to' | 'cc' | 'bcc';
type Recipients = {
  [key in RecipientType]?: string;
};

type PopoverOpt = 'encrypt' | 'sign' | 'richtext';

export class ComposePageRecipe extends PageRecipe {
  public static async openStandalone(
    t: AvaContext,
    browser: BrowserHandle,
    group: CommonAcct | string,
    options: {
      appendUrl?: string;
      hasReplyPrompt?: boolean;
      skipClickPropt?: boolean;
      skipValidation?: boolean;
      initialScript?: EvaluateFunc<unknown[]>;
    } = {}
  ): Promise<ControllablePage> {
    if (group === 'compatibility') {
      // More common accounts
      group = 'flowcrypt.compatibility@gmail.com';
    } else if (group === 'compose') {
      group = 'ci.tests.gmail@flowcrypt.test';
    }
    const email = encodeURIComponent(group);
    const composePage = await browser.newPage(
      t,
      `chrome/elements/compose.htm?account_email=${email}&parent_tab_id=0&debug=___cu_true___&frameId=none&${options.appendUrl || ''}`,
      options.initialScript
    );
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

  public static async selectFromOption(composePageOrFrame: Controllable, choice: string) {
    // Show recipient input first
    await this.showRecipientInput(composePageOrFrame);
    await composePageOrFrame.selectOption('@input-from', choice);
  }

  public static async showRecipientInput(composePageOrFrame: Controllable) {
    // Show recipient input by clicking recipient preview label if it's present
    if (await composePageOrFrame.isElementVisible('@action-show-container-cc-bcc-buttons')) {
      await composePageOrFrame.click('@action-show-container-cc-bcc-buttons');
    }
  }

  public static async fillMsg(
    composePageOrFrame: Controllable,
    recipients: Recipients,
    subject?: string | undefined,
    body?: string | undefined,
    sendingOpt: { encrypt?: boolean; sign?: boolean; richtext?: boolean } = {} // undefined means leave default
  ) {
    const sendingOpts = sendingOpt as { [key: string]: boolean | undefined };
    const keys = ['richtext', 'encrypt', 'sign'];
    for (const opt of keys) {
      const shouldBeTicked = sendingOpts[opt];
      if (typeof shouldBeTicked !== 'undefined') {
        await ComposePageRecipe.setPopoverToggle(composePageOrFrame, opt as PopoverOpt, shouldBeTicked);
      }
    }
    await Util.sleep(0.5); // todo: should we wait only if we didn't modify any sendingOpts?
    await ComposePageRecipe.fillRecipients(composePageOrFrame, recipients);
    if (subject) {
      await composePageOrFrame.click('@input-subject');
      await Util.sleep(1);
      await composePageOrFrame.type('@input-subject', subject?.match(/RTL/) ? subject : `Automated puppeteer test: ${subject}`);
    }
    await composePageOrFrame.click('@input-body');
    // bring cursor to the beginning of the multiline contenteditable
    const keyboard = composePageOrFrame.keyboard();
    await keyboard.down('Control');
    await keyboard.press('Home');
    await keyboard.up('Control');
    await composePageOrFrame.type('@input-body', body || subject || ''); // fall back to subject if body is not provided
    return { subject, body };
  }

  public static setPopoverToggle = async (composePageOrFrame: Controllable, opt: PopoverOpt, shouldBeTicked: boolean) => {
    await composePageOrFrame.waitAndClick('@action-show-options-popover');
    await composePageOrFrame.waitAll('@container-sending-options');
    const isCurrentlyTicked = await composePageOrFrame.isElementPresent(`@icon-toggle-${opt}-tick`);
    if ((!isCurrentlyTicked && shouldBeTicked) || (isCurrentlyTicked && !shouldBeTicked)) {
      // not in desired state
      await composePageOrFrame.waitAndClick(`@action-toggle-${opt}`); // toggling should set it to desired state
    } else {
      // in desired state
      await composePageOrFrame.waitAndClick('@input-body'); // close popover
    }
    await composePageOrFrame.waitTillGone('@container-sending-options');
  };

  public static fillRecipients = async (composePageOrFrame: Controllable, recipients: Recipients) => {
    await this.showRecipientInput(composePageOrFrame);
    await composePageOrFrame.waitAll('@container-cc-bcc-buttons');
    for (const key of Object.keys(recipients)) {
      const sendingType = key as RecipientType;
      const email = recipients[sendingType] as string | undefined;
      if (email) {
        if (sendingType !== 'to') {
          // input-to is always visible
          await composePageOrFrame.waitAndClick(`@action-show-${sendingType}`);
        }
        await composePageOrFrame.waitAndType(`@input-${sendingType}`, email + '\n');
        await composePageOrFrame.waitTillGone('@spinner');
      }
    }
    await composePageOrFrame.target.evaluate(() => {
      $('#input_text').trigger('focus');
    });
    await Util.sleep(1);
  };

  public static waitWhenDraftIsSaved = async (composePageOrFrame: Controllable) => {
    await composePageOrFrame.verifyContentIsPresentContinuously('@send-btn-note', 'Saved');
  };

  public static waitWhenDraftIsSavedLocally = async (composePageOrFrame: Controllable) => {
    await composePageOrFrame.verifyContentIsPresentContinuously('@send-btn-note', 'Draft saved locally (offline)');
  };

  public static sendAndClose = async (
    composePage: ControllablePage,
    { password, timeout, expectProgress }: { password?: string; timeout?: number; expectProgress?: boolean } = {
      timeout: 60,
    }
  ) => {
    if (password) {
      await composePage.waitAndType('@input-password', password);
    }
    await composePage.waitAndClick('@action-send', { delay: 1 });
    if (expectProgress) {
      await composePage.waitForContent('@action-send', '%', 20, 10);
    }
    await ComposePageRecipe.closed(composePage, timeout);
  };

  public static closed = async (composePage: ControllablePage, timeout = 60) => {
    await Promise.race([
      composePage.waitForSelTestState('closed', timeout), // in case this was a new message compose
      composePage.waitAny('@container-reply-msg-successful', { timeout }), // in case of reply
    ]);
    await composePage.close();
  };

  public static expectContactsResultEqual = async (composePage: ControllablePage | ControllableFrame, emails: string[]) => {
    await Util.sleep(5);
    const contacts = await composePage.waitAny('@container-contacts');
    const contactsList = await contacts.$$('li');
    // eslint-disable-next-line guard-for-in
    for (const index in contactsList) {
      expect(await PageRecipe.getElementPropertyJson(contactsList[index], 'textContent')).to.equal(emails[index]);
    }
  };

  public static pastePublicKeyManuallyNoClose = async (composeFrame: ControllableFrame, inboxPage: ControllablePage, recipient: string, pub: string) => {
    await Util.sleep(1); // todo: should wait until recipient actually loaded
    // await Util.sleep(6000); // >>>> debug
    await composeFrame.waitForContent('.email_address.no_pgp', recipient);
    await composeFrame.waitAndClick('@action-open-add-pubkey-dialog', { delay: 1 });
    await inboxPage.waitAll('@dialog-add-pubkey');
    const addPubkeyDialog = await inboxPage.getFrame(['add_pubkey.htm']);
    await addPubkeyDialog.waitAndType('@input-pubkey', pub);
    await Util.sleep(1);
    await addPubkeyDialog.waitAndClick('@action-add-pubkey');
    return addPubkeyDialog;
  };

  public static pastePublicKeyManually = async (composeFrame: ControllableFrame, inboxPage: ControllablePage, recipient: string, pub: string) => {
    await ComposePageRecipe.pastePublicKeyManuallyNoClose(composeFrame, inboxPage, recipient, pub);
    await inboxPage.waitTillGone('@dialog-add-pubkey');
  };

  public static cancelPassphraseDialog = async (page: ControllablePage, inputMethod: 'mouse' | 'keyboard' | string) => {
    const passPhraseFrame = await page.getFrame(['passphrase.htm']);
    if (inputMethod === 'mouse') {
      await passPhraseFrame.waitAndClick('@action-cancel-pass-phrase-entry');
    } else if (inputMethod === 'keyboard') {
      await page.press('Escape');
    }
    await page.waitTillGone('@dialog-passphrase');
    expect(passPhraseFrame.frame.isDetached()).to.equal(true);
  };
}
