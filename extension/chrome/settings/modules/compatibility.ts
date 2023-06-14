/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Buf } from '../../../js/common/core/buf.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { View } from '../../../js/common/view.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { KeyUtil, Key } from '../../../js/common/core/crypto/key.js';
import { Str, Url } from '../../../js/common/core/common.js';
import { PubLookup } from '../../../js/common/api/pub-lookup.js';
import { ClientConfiguration } from '../../../js/common/client-configuration.js';
import { Assert } from '../../../js/common/assert.js';

View.run(
  class CompatibilityView extends View {
    public readonly acctEmail: string;
    public clientConfiguration!: ClientConfiguration;
    public pubLookup!: PubLookup;
    private testIndex = 0;

    public constructor() {
      super();
      Ui.event.protect();
      const uncheckedUrlParams = Url.parse(['acctEmail']);
      this.acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
    }

    public render = async () => {
      this.clientConfiguration = await ClientConfiguration.newInstance(this.acctEmail);
      this.pubLookup = new PubLookup(this.clientConfiguration);
    };

    public setHandlers = () => {
      $('.action_load_public_key').on('click', this.setHandlerPrevent('double', this.actionLoadPublicKey));
      $('.action_test_key').on('click', this.setHandlerPrevent('double', this.actionTestKeyHandler));
      $('#input_passphrase').keydown(this.setEnterHandlerThatClicks('.action_test_key'));
    };

    private performKeyCompatibilityTests = async (keyString: string) => {
      $('pre').text('').css('display', 'block');
      try {
        this.testIndex = 1;
        const { keys, errs } = await KeyUtil.readMany(Buf.fromUtfStr(keyString));
        for (const err of errs) {
          this.appendResult(`Error parsing input: ${String(err)}`);
        }
        await this.outputKeyResults(keys);
      } catch (err) {
        this.appendResult(`Exception: ${String(err)}`);
      }
    };

    private appendResult = (str: string, err?: Error) => {
      Xss.sanitizeAppend('pre', `(${Xss.escape(`${this.testIndex++}`)}) ${Xss.escape(str)} ${err ? Xss.escape(` !! ${err.message}`) : Xss.escape('')} \n`);
    };

    private outputKeyResults = async (keys: Key[]) => {
      this.appendResult(`Primary keys found: ${keys.length}`);
      for (let keyIndex = 0; keyIndex < keys.length; keyIndex++) {
        this.appendResult(`----- Testing key ${keyIndex} -----`);
        const key = keys[keyIndex];
        const kn = `PK ${keyIndex} >`;
        const results = await KeyUtil.diagnose(key, String($('.input_passphrase').val()));
        for (const entry of results) {
          this.appendResult(`${kn} ${entry[0]}: ${entry[1]}`);
        }
      }
    };

    private actionLoadPublicKey = async () => {
      const emailString = String($('.input_email').val());
      if (Str.isEmailValid(emailString)) {
        const { pubkeys } = await this.pubLookup.lookupEmail(emailString);
        if (!pubkeys.length) {
          await Ui.modal.info(`No public key found for: ${emailString}`);
          return;
        }
        $('.input_key').val(pubkeys[0]);
      } else {
        await Ui.modal.error('This email is invalid, please check for typos.');
        $('.input_email').focus();
      }
    };

    private actionTestKeyHandler = async (submitBtn: HTMLElement) => {
      const keyString = String($('.input_key').val());
      if (!keyString) {
        await Ui.modal.warning('Please paste an OpenPGP in the input box');
        return;
      }
      const origBtnContent = $(submitBtn).html();
      Xss.sanitizeRender(submitBtn, 'Evaluating.. ' + Ui.spinner('white'));
      await this.performKeyCompatibilityTests(keyString);
      Xss.sanitizeRender(submitBtn, origBtnContent);
    };
  }
);
