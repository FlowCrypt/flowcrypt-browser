/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import * as ava from 'ava';

// import { BrowserRecipe } from '../browser-recipe';
// import { ComposePageRecipe } from '../page-recipe/compose-page-recipe';
// import { FlowCryptApi } from '../api';
// import { GmailPageRecipe } from '../page-recipe/gmail-page-recipe';
// import { PageRecipe } from '../page-recipe/abstract-page-recipe';
// import { SetupPageRecipe } from '../page-recipe/setup-page-recipe';
import { TestVariant } from '../util';
// import { Util } from '../../util';

// tslint:disable:no-blank-lines-func

export const defineConsumerAcctTests = (testVariant: TestVariant) => {

  if (testVariant === 'CONSUMER-LIVE-GMAIL') {

    ava.todo('settings will recognize expired subscription');

    ava.todo('settings will recognize / sync subscription');

  }

};
