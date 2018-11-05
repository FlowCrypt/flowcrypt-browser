/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store, KeyInfo, KeyBackupMethod } from '../../../js/common/store.js';
import { Value, EmailProvider } from '../../../js/common/common.js';
import { Att } from '../../../js/common/att.js';
import { Xss, Ui, Env, Browser } from '../../../js/common/browser.js';
import { BrowserMsg } from '../../../js/common/extension.js';
import { Rules } from '../../../js/common/rules.js';
import { Lang } from '../../../js/common/lang.js';
import { Settings } from '../../../js/common/settings.js';
import { Api } from '../../../js/common/api.js';
import { Pgp } from '../../../js/common/pgp.js';
import { Catch, UnreportableError } from '../../../js/common/catch.js';

declare const openpgp: typeof OpenPGP;

Catch.try(async () => {

  let urlParams = Env.urlParams(['acctEmail', 'action', 'parentTabId']);
  let acctEmail = Env.urlParamRequire.string(urlParams, 'acctEmail');
  let parentTabId: string | null = null;
  if (urlParams.action !== 'setup') {
    parentTabId = Env.urlParamRequire.string(urlParams, 'parentTabId');
  }

  let emailProvider: EmailProvider;

  await Ui.passphraseToggle(['password', 'password2']);

  let storage = await Store.getAcct(acctEmail, ['setup_simple', 'email_provider']);
  emailProvider = storage.email_provider || 'gmail';

  let rules = new Rules(acctEmail);
  if (!rules.canBackupKeys()) {
    Xss.sanitizeRender('body', `<div class="line" style="margin-top: 100px;">${Lang.setup.keyBackupsNotAllowed}</div>`);
    return;
  }

  let displayBlock = (name: string) => {
    let blocks = ['loading', 'step_0_status', 'step_1_password', 'step_2_confirm', 'step_3_automatic_backup_retry', 'step_3_manual'];
    for (let block of blocks) {
      $('#' + block).css('display', 'none');
    }
    $('#' + name).css('display', 'block');
  };

  $('#password').on('keyup', Ui.event.prevent('spree', () => Settings.renderPasswordStrength('#step_1_password', '#password', '.action_password')));

  let showStatus = async () => {
    $('.hide_if_backup_done').css('display', 'none');
    $('h1').text('Key Backups');
    displayBlock('loading');
    let storage = await Store.getAcct(acctEmail, ['setup_simple', 'key_backup_method', 'google_token_scopes', 'email_provider', 'microsoft_auth']);
    if (emailProvider === 'gmail' && Api.gmail.hasScope(storage.google_token_scopes || [], 'read')) {
      let keys;
      try {
        keys = await Api.gmail.fetchKeyBackups(acctEmail);
      } catch (e) {
        if (Api.err.isNetErr(e)) {
          Xss.sanitizeRender('#content', `Could not check for backups: no internet. ${Ui.retryLink()}`);
        } else if (Api.err.isAuthPopupNeeded(e)) {
          BrowserMsg.send(parentTabId, 'notification_show_auth_popup_needed', { acctEmail });
          Xss.sanitizeRender('#content', `Could not check for backups: account needs to be re-connected. ${Ui.retryLink()}`);
        } else {
          Catch.handleException(e);
          Xss.sanitizeRender('#content', `Could not check for backups: unknown error. ${Ui.retryLink()}`);
        }
        return;
      }
      displayBlock('step_0_status');
      if (keys && keys.length) {
        $('.status_summary').text('Backups found: ' + keys.length + '. Your account is backed up correctly in your email inbox.');
        Xss.sanitizeRender('#step_0_status .container', '<div class="button long green action_go_manual">SEE MORE BACKUP OPTIONS</div>');
        $('.action_go_manual').click(Ui.event.handle(() => {
          displayBlock('step_3_manual');
          $('h1').text('Back up your private key');
        }));
      } else if (storage.key_backup_method) {
        if (storage.key_backup_method === 'file') {
          $('.status_summary').text('You have previously backed up your key into a file.');
          Xss.sanitizeRender('#step_0_status .container', '<div class="button long green action_go_manual">SEE OTHER BACKUP OPTIONS</div>');
          $('.action_go_manual').click(Ui.event.handle(() => {
            displayBlock('step_3_manual');
            $('h1').text('Back up your private key');
          }));
        } else if (storage.key_backup_method === 'print') {
          $('.status_summary').text('You have previously backed up your key by printing it.');
          Xss.sanitizeRender('#step_0_status .container', '<div class="button long green action_go_manual">SEE OTHER BACKUP OPTIONS</div>');
          $('.action_go_manual').click(Ui.event.handle(() => {
            displayBlock('step_3_manual');
            $('h1').text('Back up your private key');
          }));
        } else { // inbox or other methods
          $('.status_summary').text('There are no backups on this account. If you lose your device, or it stops working, you will not be able to read your encrypted email.');
          Xss.sanitizeRender('#step_0_status .container', '<div class="button long green action_go_manual">SEE BACKUP OPTIONS</div>');
          $('.action_go_manual').click(Ui.event.handle(() => {
            displayBlock('step_3_manual');
            $('h1').text('Back up your private key');
          }));
        }
      } else {
        if (storage.setup_simple) {
          $('.status_summary').text('No backups found on this account. You can store a backup of your key in email inbox. Your key will be protected by a pass phrase of your choice.');
          Xss.sanitizeRender(
            '#step_0_status .container',
            '<div class="button long green action_go_backup">BACK UP MY KEY</div><br><br><br><a href="#" class="action_go_manual">See more advanced backup options</a>'
          );
          $('.action_go_backup').click(Ui.event.handle(() => {
            displayBlock('step_1_password');
            $('h1').text('Set Backup Pass Phrase');
          }));
          $('.action_go_manual').click(Ui.event.handle(() => {
            displayBlock('step_3_manual');
            $('h1').text('Back up your private key');
          }));
        } else {
          $('.status_summary').text('No backups found on this account. If you lose your device, or it stops working, you will not be able to read your encrypted email.');
          Xss.sanitizeRender('#step_0_status .container', '<div class="button long green action_go_manual">BACK UP MY KEY</div>');
          $('.action_go_manual').click(Ui.event.handle(() => {
            displayBlock('step_3_manual');
            $('h1').text('Back up your private key');
          }));
        }
      }
    } else { // gmail read permission not granted - cannot check for backups
      displayBlock('step_0_status');
      $('.status_summary').text('FlowCrypt cannot check your backups.');
      let pemissionsBtnIfGmail = emailProvider === 'gmail' ? '<div class="button long green action_go_auth_denied">SEE PERMISSIONS</div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;' : '';
      Xss.sanitizeRender('#step_0_status .container', `${pemissionsBtnIfGmail}<div class="button long gray action_go_manual">SEE BACKUP OPTIONS</div>`);
      $('.action_go_manual').click(Ui.event.handle(() => {
        displayBlock('step_3_manual');
        $('h1').text('Back up your private key');
      }));
      $('.action_go_auth_denied').click(Ui.event.handle(() => BrowserMsg.send(null, 'settings', { acctEmail, page: '/chrome/settings/modules/auth_denied.htm' })));
    }
  };

  $('.action_password').click(Ui.event.handle(target => {
    if ($(target).hasClass('green')) {
      displayBlock('step_2_confirm');
    } else {
      alert('Please select a stronger pass phrase. Combinations of 4 to 5 uncommon words are the best.');
    }
  }));

  $('.action_reset_password').click(Ui.event.handle(() => {
    $('#password').val('');
    $('#password2').val('');
    displayBlock('step_1_password');
    Settings.renderPasswordStrength('#step_1_password', '#password', '.action_password');
    $('#password').focus();
  }));

  $('.action_backup').click(Ui.event.prevent('double', async (target) => {
    let newPassphrase = $('#password').val() as string; // text input
    if (newPassphrase !== $('#password2').val()) {
      alert('The two pass phrases do not match, please try again.');
      $('#password2').val('');
      $('#password2').focus();
    } else {
      let btnText = $(target).text();
      Xss.sanitizeRender(target, Ui.spinner('white'));
      let [primaryKi] = await Store.keysGet(acctEmail, ['primary']);
      Settings.abortAndRenderErrorIfKeyinfoEmpty(primaryKi);
      let prv = openpgp.key.readArmored(primaryKi.private).keys[0];
      await Settings.openpgpKeyEncrypt(prv, newPassphrase);
      await Store.passphraseSave('local', acctEmail, primaryKi.longid, newPassphrase);
      await Store.keysAdd(acctEmail, prv.armor());
      try {
        await doBackupOnEmailProvider(acctEmail, prv.armor());
      } catch (e) {
        if (Api.err.isNetErr(e)) {
          alert('Need internet connection to finish. Please click the button again to retry.');
        } else if (parentTabId && Api.err.isAuthPopupNeeded(e)) {
          BrowserMsg.send(parentTabId, 'notification_show_auth_popup_needed', { acctEmail });
          alert('Account needs to be re-connected first. Please try later.');
        } else {
          Catch.handleException(e);
          alert(`Error happened, please try again (${e.message})`);
        }
        $(target).text(btnText);
        return;
      }
      await writeBackupDoneAndRender(false, 'inbox');
    }
  }));

  let isMasterPrivateKeyEncrypted = async (ki: KeyInfo) => {
    let k = openpgp.key.readArmored(ki.private).keys[0];
    if (k.primaryKey.isDecrypted()) {
      return false;
    }
    for (let packet of k.getKeys()) {
      if (packet.isDecrypted() === true) {
        return false;
      }
    }
    if (await Pgp.key.decrypt(k, ['']) === true) {
      return false;
    }
    return true;
  };

  let asBackupFile = (acctEmail: string, armoredKey: string) => {
    return new Att({ name: `cryptup-backup-${acctEmail.replace(/[^A-Za-z0-9]+/g, '')}.key`, type: 'text/plain', data: armoredKey });
  };

  let doBackupOnEmailProvider = async (acctEmail: string, armoredKey: string) => {
    let emailMsg = await $.get({ url: '/chrome/emails/email_intro.template.htm', dataType: 'html' });
    let emailAtts = [asBackupFile(acctEmail, armoredKey)];
    let msg = await Api.common.msg(acctEmail, acctEmail, [acctEmail], Api.GMAIL_RECOVERY_EMAIL_SUBJECTS[0], { 'text/html': emailMsg }, emailAtts);
    if (emailProvider === 'gmail') {
      return await Api.gmail.msgSend(acctEmail, msg);
    } else {
      throw Error(`Backup method not implemented for ${emailProvider}`);
    }
  };

  let backupOnEmailProviderAndUpdateUi = async (primaryKi: KeyInfo) => {
    let pp = await Store.passphraseGet(acctEmail, primaryKi.longid);
    if (!pp || !await isPassPhraseStrongEnough(primaryKi, pp)) {
      alert('Your key is not protected with a strong pass phrase, skipping');
      return;
    }
    let btn = $('.action_manual_backup');
    let origBtnText = btn.text();
    Xss.sanitizeRender(btn, Ui.spinner('white'));
    try {
      await doBackupOnEmailProvider(acctEmail, primaryKi.private);
    } catch (e) {
      if (Api.err.isNetErr(e)) {
        return alert('Need internet connection to finish. Please click the button again to retry.');
      } else if (parentTabId && Api.err.isAuthPopupNeeded(e)) {
        BrowserMsg.send(parentTabId, 'notification_show_auth_popup_needed', { acctEmail });
        return alert('Account needs to be re-connected first. Please try later.');
      } else {
        Catch.handleException(e);
        return alert(`Error happened: ${e.message}`);
      }
    } finally {
      btn.text(origBtnText);
    }
    await writeBackupDoneAndRender(false, 'inbox');
  };

  let backupAsFile = async (primaryKi: KeyInfo) => { // todo - add a non-encrypted download option
    let attachment = asBackupFile(acctEmail, primaryKi.private);
    if (Catch.browser().name !== 'firefox') {
      Browser.saveToDownloads(attachment);
      await writeBackupDoneAndRender(false, 'file');
    } else {
      Browser.saveToDownloads(attachment, $('.backup_action_buttons_container'));
    }
  };

  let backupByBrint = async (primaryKi: KeyInfo) => { // todo - implement + add a non-encrypted print option
    throw new Error('not implemented');
  };

  let backupRefused = async (ki: KeyInfo) => {
    await writeBackupDoneAndRender(Value.int.getFutureTimestampInMonths(3), 'none');
  };

  let writeBackupDoneAndRender = async (prompt: number | false, method: KeyBackupMethod) => {
    await Store.set(acctEmail, { key_backup_prompt: prompt, key_backup_method: method });
    if (urlParams.action === 'setup') {
      window.location.href = Env.urlCreate('/chrome/settings/setup.htm', { acctEmail: urlParams.acctEmail, action: 'finalize' });
    } else {
      await showStatus();
    }
  };

  $('.action_manual_backup').click(Ui.event.prevent('double', async (target) => {
    let selected = $('input[type=radio][name=input_backup_choice]:checked').val();
    let [primaryKi] = await Store.keysGet(acctEmail, ['primary']);
    Settings.abortAndRenderErrorIfKeyinfoEmpty(primaryKi);
    if (!await isMasterPrivateKeyEncrypted(primaryKi)) {
      alert('Sorry, cannot back up private key because it\'s not protected with a pass phrase.');
      return;
    }
    if (selected === 'inbox') {
      await backupOnEmailProviderAndUpdateUi(primaryKi);
    } else if (selected === 'file') {
      await backupAsFile(primaryKi);
    } else if (selected === 'print') {
      await backupByBrint(primaryKi);
    } else {
      await backupRefused(primaryKi);
    }
  }));

  let isPassPhraseStrongEnough = async (ki: KeyInfo, passphrase: string) => {
    let k = Pgp.key.read(ki.private);
    if (k.isDecrypted()) {
      return false;
    }
    if (!passphrase) {
      let pp = prompt('Please enter your pass phrase:');
      if (!pp) {
        return false;
      }
      if (await Pgp.key.decrypt(k, [pp]) !== true) {
        alert('Pass phrase did not match, please try again.');
        return false;
      }
      passphrase = pp;
    }
    if (Settings.evalPasswordStrength(passphrase).word.pass === true) {
      return true;
    }
    alert('Please change your pass phrase first.\n\nIt\'s too weak for this backup method.');
    return false;
  };

  let setupCreateSimpleAutomaticInboxBackup = async () => {
    let [primaryKi] = await Store.keysGet(acctEmail, ['primary']);
    if (Pgp.key.read(primaryKi.private).isDecrypted()) {
      alert('Key not protected with a pass phrase, skipping');
      throw new UnreportableError('Key not protected with a pass phrase, skipping');
    }
    Settings.abortAndRenderErrorIfKeyinfoEmpty(primaryKi);
    await doBackupOnEmailProvider(acctEmail, primaryKi.private);
    await writeBackupDoneAndRender(false, 'inbox');
  };

  $('.action_skip_backup').click(Ui.event.prevent('double', async () => {
    if (urlParams.action === 'setup') {
      await Store.set(acctEmail, { key_backup_prompt: false });
      window.location.href = Env.urlCreate('/chrome/settings/setup.htm', { acctEmail: urlParams.acctEmail });
    } else {
      BrowserMsg.send(parentTabId, 'close_page');
    }
  }));

  $('#step_3_manual input[name=input_backup_choice]').click(Ui.event.handle(target => {
    if ($(target).val() === 'inbox') {
      $('.action_manual_backup').text('back up as email');
      $('.action_manual_backup').removeClass('red').addClass('green');
    } else if ($(target).val() === 'file') {
      $('.action_manual_backup').text('back up as a file');
      $('.action_manual_backup').removeClass('red').addClass('green');
    } else if ($(target).val() === 'print') {
      $('.action_manual_backup').text('back up on paper');
      $('.action_manual_backup').removeClass('red').addClass('green');
    } else {
      $('.action_manual_backup').text('try my luck');
      $('.action_manual_backup').removeClass('green').addClass('red');
    }
  }));

  if (urlParams.action === 'setup') {
    $('.back').css('display', 'none');
    $('.action_skip_backup').parent().css('display', 'none');
    if (storage.setup_simple) {
      try {
        await setupCreateSimpleAutomaticInboxBackup();
      } catch (e) {
        return await Settings.promptToRetry('REQUIRED', e, 'Failed to back up your key, probably due to internet connection.', setupCreateSimpleAutomaticInboxBackup);
      }
    } else {
      displayBlock('step_3_manual');
      $('h1').text('Back up your private key');
    }
  } else if (urlParams.action === 'passphrase_change_gmail_backup') {
    if (storage.setup_simple) {
      displayBlock('loading');
      let [primaryKi] = await Store.keysGet(acctEmail, ['primary']);
      Settings.abortAndRenderErrorIfKeyinfoEmpty(primaryKi);
      try {
        await doBackupOnEmailProvider(acctEmail, primaryKi.private);
        $('#content').text('Pass phrase changed. You will find a new backup in your inbox.');
      } catch (e) {
        Xss.sanitizeRender('#content', 'Connection failed, please <a href="#" class="reload">try again</a>.');
        $('.reload').click(() => window.location.reload());
      }
    } else { // should never happen on this action. Just in case.
      displayBlock('step_3_manual');
      $('h1').text('Back up your private key');
    }
  } else if (urlParams.action === 'options') {
    displayBlock('step_3_manual');
    $('h1').text('Back up your private key');
  } else {
    await showStatus();
  }

})();
