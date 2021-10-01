/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { expect } from "chai";
import { ControllableFrame, ControllablePage } from "../browser";
import { PageRecipe } from "./page-recipe/abstract-page-recipe";

export const expectContactsResultEqual = async (composePage: ControllablePage | ControllableFrame, emails: string[]) => {
  const contacts = await composePage.waitAny('@container-contacts');
  const contactsList = await contacts.$$('li');
  for (const index in contactsList) { // tslint:disable-line:forin
    expect(await PageRecipe.getElementPropertyJson(contactsList[index], 'textContent')).to.equal(emails[index]);
  }
};
