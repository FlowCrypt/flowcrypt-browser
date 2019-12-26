/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Backend, BackendRes, FcUuidAuth } from '../../../js/common/api/backend.js';
import { Dict, Str, Url, Value } from '../../../js/common/core/common.js';
import { SelCache, Ui } from '../../../js/common/browser/ui.js';
import { Serializable, Store } from '../../../js/common/platform/store.js';

import { ApiErr } from '../../../js/common/api/error/api-error.js';
import { Assert } from '../../../js/common/assert.js';
import { Att } from '../../../js/common/core/att.js';
import { AttUI } from '../../../js/common/ui/att_ui.js';
import { BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { Catch } from '../../../js/common/platform/catch.js';
import { Settings } from '../../../js/common/settings.js';
import { View } from '../../../js/common/view.js';
import { Xss } from '../../../js/common/platform/xss.js';

View.run(class ContactPageView extends View {
  private readonly acctEmail: string;
  private readonly parentTabId: string;
  private readonly attachJs = new AttUI(() => Promise.resolve({ size_mb: 5, size: 5 * 1024 * 1024, count: 1 }));
  private readonly authInfoPromise: Promise<FcUuidAuth>;
  private newPhotoFile: Att | undefined;

  private S: SelCache;

  constructor() {
    super();
    const uncheckedUrlParams = Url.parse(['acctEmail', 'parentTabId']);
    this.acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
    this.parentTabId = Assert.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');
    this.authInfoPromise = Store.authInfo(this.acctEmail);
    this.S = Ui.buildJquerySels({
      'status': '.status',
      'subscribe': '.action_subscribe',
      'hide_if_active': '.hide_if_active',
      'show_if_active': '.show_if_active',
      'input_email': '.input_email',
      'input_name': '.input_name',
      'input_intro': '.input_intro',
      'input_alias': '.input_alias',
      'action_enable': '.action_enable',
      'action_update': '.action_update',
      'action_close': '.action_close',
      'management_account': '.management_account',
      'photo': '.profile_photo img',
    });
  }

  render = async () => {
    Xss.sanitizeRender(this.S.cached('status'), 'Loading..' + Ui.spinner('green'));
    try {
      const response = await Backend.accountGetAndUpdateLocalStore(await this.authInfoPromise);
      this.renderFields(response.account);
    } catch (e) {
      if (ApiErr.isAuthErr(e)) {
        Settings.offerToLoginWithPopupShowModalOnErr(this.acctEmail, () => window.location.reload());
      } else {
        this.S.cached('status').text(`Failed to load your Contact Page settings. Please try to reload this page. Let us know at human@flowcrypt.com if this persists.\n${ApiErr.eli5(e)}`);
      }
    }
  }

  setHandlers = () => {
    this.S.cached('action_update').click(this.setHandlerPrevent('double', () => this.onUpdateHandler()));
    this.S.cached('action_close').click(this.setHandler(() => this.onCloseHandler()));
  }

  private renderFields = (result: BackendRes.FcAccount$info) => {
    if (result.alias) {
      const me = Backend.url('me', result.alias);
      const meEscaped = Xss.escape(me);
      const meEscapedDisplay = Xss.escape(me.replace('https://', ''));
      Xss.sanitizeRender(this.S.cached('status'), `Your contact page is currently <b class="good">enabled</b> at <a href="${meEscaped}" target="_blank">${meEscapedDisplay}</a></span>`);
      this.S.cached('hide_if_active').css('display', 'none');
      this.S.cached('show_if_active').css('display', 'inline-block');
      this.S.cached('input_email').val(result.email);
      this.S.cached('input_intro').val(result.intro);
      this.S.cached('input_alias').val(result.alias);
      this.S.cached('input_name').val(result.name);
      if (result.photo) {
        this.S.cached('photo').attr('src', result.photo);
      }
      this.attachJs.initAttDialog('fineuploader', 'select_photo', {
        attAdded: async file => {
          this.newPhotoFile = file;
          Xss.sanitizeReplace('#select_photo', Ui.e('span', { text: file.name }));
        }
      });
    } else {
      this.S.cached('management_account').text(result.email).parent().removeClass('display_none');
      Xss.sanitizeRender(this.S.cached('status'), 'Your contact page is currently <b class="bad">disabled</b>. <a href="#" class="action_enable">Enable contact page</a>');
      this.S.now('action_enable').click(this.setHandlerPrevent('double', () => this.enableContactPage()));
    }
  }

  private findAvailableAlias = async (email: string): Promise<string> => {
    let alias = email.split('@')[0].replace(/[^a-z0-9]/g, '');
    while (alias.length < 3) {
      alias += Str.sloppyRandom(1).toLowerCase();
    }
    let i = 0;
    while (true) {
      alias += (i || '');
      const response = await Backend.linkMe(alias);
      if (!response.profile) {
        return alias;
      }
      i += Value.int.lousyRandom(1, 9);
    }
  }

  private onUpdateHandler = async () => {
    if (!this.S.cached('input_name').val()) {
      await Ui.modal.warning('Please add your name');
    } else if (!this.S.cached('input_intro').val()) {
      await Ui.modal.warning('Please add intro text');
    } else {
      this.S.cached('show_if_active').css('display', 'none');
      Xss.sanitizeRender(this.S.cached('status'), 'Updating ' + Ui.spinner('green'));
      const update: Dict<Serializable> = { name: this.S.cached('input_name').val(), intro: this.S.cached('input_intro').val() };
      if (this.newPhotoFile) {
        update.photo_content = this.newPhotoFile.getData().toBase64Str();
      }
      try {
        await Backend.accountUpdate(await this.authInfoPromise, update);
      } catch (e) {
        if (ApiErr.isNetErr(e)) {
          await Ui.modal.error('No internet connection, please try again');
        } else if (ApiErr.isReqTooLarge(e)) {
          await Ui.modal.warning('Error: the image is too large, please choose a smaller one');
        } else {
          if (!ApiErr.isServerErr(e) && !ApiErr.isAuthErr(e)) {
            Catch.reportErr(e);
          }
          await Ui.modal.error('Error happened, please try again');
        }
      }
      await Ui.time.sleep(100);
      window.location.reload();
    }
  }

  private enableContactPage = async () => {
    Xss.sanitizeRender(this.S.cached('status'), 'Enabling..' + Ui.spinner('green'));
    const storage = await Store.getAcct(this.acctEmail, ['full_name']);
    try {
      const alias = await this.findAvailableAlias(this.acctEmail);
      const initial = { alias, name: storage.full_name || Str.capitalize(this.acctEmail!.split('@')[0]), intro: 'Use this contact page to send me encrypted messages and files.' };
      const response = await Backend.accountUpdate(await this.authInfoPromise, initial);
      if (!response.updated) {
        await Ui.modal.error('Failed to enable your Contact Page. Please try again');
      }
      await Ui.time.sleep(100);
      window.location.reload();
    } catch (e) {
      Catch.reportErr(e);
      await Ui.modal.error(`Failed to create account, possibly a network issue. Please try again.\n\n${String(e)}`);
      await Ui.time.sleep(100);
      window.location.reload();
    }
  }

  private onCloseHandler = () => {
    BrowserMsg.send.closePage(this.parentTabId);
    BrowserMsg.send.reload(this.parentTabId, {});
  }
});
