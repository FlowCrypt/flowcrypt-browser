/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { KeyInfo, PgpKey } from '../../js/common/core/pgp-key.js';
import { StorageType, Store } from '../../js/common/platform/store.js';

import { Assert } from '../../js/common/assert.js';
import { BrowserMsg } from '../../js/common/browser/browser-msg.js';
import { Catch } from '../../js/common/platform/catch.js';
import { Ui } from '../../js/common/browser/ui.js';
import { Url, Str } from '../../js/common/core/common.js';
import { View } from '../../js/common/view.js';
import { Xss } from '../../js/common/platform/xss.js';
import { initPassphraseToggle } from '../../js/common/ui/passphrase-ui.js';
import { openpgp } from '../../js/common/core/pgp.js';

View.run(class PassphraseView extends View {
  private readonly acctEmail: string;
  private readonly parentTabId: string;
  private readonly longids: string[];
  private readonly type: string;
  private myPrivateKeys: KeyInfo[] | undefined;

  constructor() {
    super();
    const uncheckedUrlParams = Url.parse(['acctEmail', 'parentTabId', 'longids', 'type']);
    this.acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
    this.parentTabId = Assert.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');
    this.longids = Assert.urlParamRequire.string(uncheckedUrlParams, 'longids').split(',');
    this.type = Assert.urlParamRequire.oneof(uncheckedUrlParams, 'type', ['embedded', 'sign', 'message', 'draft', 'attachment', 'quote', 'backup']);
  }

  public render = async () => {
    Ui.event.protect();
    await initPassphraseToggle(['passphrase']);
    const allPrivateKeys = await Store.keysGet(this.acctEmail);
    this.myPrivateKeys = allPrivateKeys.filter(ki => this.longids.includes(ki.longid) || (ki.primary && this.longids.includes('primary')));
    if (this.type === 'embedded') {
      $('h1').parent().css('display', 'none');
      $('div.separator').css('display', 'none');
      $('body#settings > div#content.dialog').css({ width: 'inherit', background: '#fafafa', });
      $('.line.which_key').css({ display: 'none', position: 'absolute', visibility: 'hidden', left: '5000px', });
    } else if (this.type === 'sign') {
      $('h1').text('Enter your pass phrase to sign email');
    } else if (this.type === 'draft') {
      $('h1').text('Enter your pass phrase to load a draft');
    } else if (this.type === 'attachment') {
      $('h1').text('Enter your pass phrase to decrypt a file');
    } else if (this.type === 'quote') {
      $('h1').text('Enter your pass phrase to load quoted content');
    } else if (this.type === 'backup') {
      $('h1').text('Enter your pass phrase to back up');
    }
    $('#passphrase').focus();
    if (allPrivateKeys.length > 1) {
      let html: string;
      if (this.myPrivateKeys.length === 1) {
        html = `For key Longid: <span class="good">${Xss.escape(Str.spaced(this.myPrivateKeys[0].longid || ''))}</span>`;
      } else {
        html = 'Pass phrase needed for any of the following keys:';
        for (const i of this.myPrivateKeys.keys()) {
          html += `<div>Longid ${String(i + 1)}: <span class="good">${Xss.escape(Str.spaced(this.myPrivateKeys[i].longid) || '')}</span></div>`;
        }
      }
      Xss.sanitizeRender('.which_key', html);
      $('.which_key').css('display', 'block');
    }
  }

  public setHandlers = () => {
    $('#passphrase').keyup(this.setHandler(() => this.renderNormalPpPrompt()));
    $('.action_close').click(this.setHandler(() => this.closeDialog()));
    $('.action_ok').click(this.setHandler(() => this.submitHandler()));
    $('#passphrase').keydown(this.setHandler((el, ev) => {
      if (ev.which === 13) {
        $('.action_ok').click();
      }
    }));
    $('body').on('keydown', this.setHandler((el, ev) => {
      if (ev.which === 27) { // If 'ESC' key
        this.closeDialog();
      }
    }));
  }

  private renderNormalPpPrompt = () => {
    $('#passphrase').css('border-color', '');
    $('#passphrase').css('color', 'black');
    $('#passphrase').focus();
  }

  private renderFailedEntryPpPrompt = () => {
    $('#passphrase').val('');
    $('#passphrase').css('border-color', 'red');
    $('#passphrase').css('color', 'red');
    $('#passphrase').attr('placeholder', 'Please try again');
  }

  private closeDialog = (entered: boolean = false) => {
    BrowserMsg.send.passphraseEntry('broadcast', { entered });
    BrowserMsg.send.closeDialog(this.parentTabId);
  }

  private submitHandler = async () => {
    const pass = String($('#passphrase').val());
    const storageType: StorageType = $('.forget').prop('checked') ? 'session' : 'local';
    let atLeastOneMatched = false;
    for (const keyinfo of this.myPrivateKeys!) { // if passphrase matches more keys, it will save the pass phrase for all keys
      const { keys: [prv] } = await openpgp.key.readArmored(keyinfo.private);
      try {
        if (await PgpKey.decrypt(prv, pass) === true) {
          await Store.passphraseSave(storageType, this.acctEmail, keyinfo.longid, pass);
          atLeastOneMatched = true;
          if (storageType === 'session') {
            // TODO: change to 'broadcast' when issue with 'broadcast' is fixed
            BrowserMsg.send.addEndSessionBtn(this.parentTabId);
          }
        }
      } catch (e) {
        if (e instanceof Error && e.message === 'Unknown s2k type.') {
          await Ui.modal.error(`One of your keys ${keyinfo.longid} is not supported yet (${String(e)}).\n\nPlease write human@flowcrypt.com with details about how was this key created.`);
        } else {
          throw e;
        }
      }
    }
    if (atLeastOneMatched) {
      this.closeDialog(true);
    } else {
      this.renderFailedEntryPpPrompt();
      Catch.setHandledTimeout(() => this.renderNormalPpPrompt(), 1500);
    }
  }
});
