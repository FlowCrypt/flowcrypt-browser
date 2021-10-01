/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { expect } from "chai";
import { ControllableFrame, ControllablePage } from "../browser";
import { Util } from "../util";
import { PageRecipe } from "./page-recipe/abstract-page-recipe";

export const expectContactsResultEqual = async (composePage: ControllablePage | ControllableFrame, emails: string[]) => {
  const contacts = await composePage.waitAny('@container-contacts');
  const contactsList = await contacts.$$('li');
  for (const index in contactsList) { // tslint:disable-line:forin
    expect(await PageRecipe.getElementPropertyJson(contactsList[index], 'textContent')).to.equal(emails[index]);
  }
};

export const pastePublicKeyManually = async (composeFrame: ControllableFrame, inboxPage: ControllablePage,
  recipient: string, pub: string) => {
  await pastePublicKeyManuallyNoClose(composeFrame, inboxPage, recipient, pub);
  await inboxPage.waitTillGone('@dialog-add-pubkey');
};

export const pastePublicKeyManuallyNoClose = async (composeFrame: ControllableFrame, inboxPage: ControllablePage, recipient: string, pub: string) => {
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
