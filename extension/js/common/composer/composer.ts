/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Ui } from '../browser.js';
import { ComposerAppFunctionsInterface } from './interfaces/composer-app-functions.js';
import { ComposerUrlParams } from './interfaces/composer-types.js';
import { ComposerDraft } from './composer-draft.js';
import { ComposerQuote } from './composer-quote.js';
import { ComposerContacts } from './composer-contacts.js';
import { ComposerSendBtn } from './composer-send-btn.js';
import { ComposerPwdOrPubkeyContainer } from './composer-pwd-or-pubkey-container.js';
import { ComposerWindowSize } from './composer-window-size.js';
import { ComposerSender } from './composer-sender.js';
import { ComposerAtts } from './composer-atts.js';
import { ComposerErrs } from './composer-errs.js';
import { ComposerTextInput } from './composer-text-input.js';
import { ComposerRender } from './composer-render.js';
import { Catch } from '../platform/catch.js';

export class Composer {

  public S = Ui.buildJquerySels({
    body: 'body',
    compose_table: 'table#compose',
    header: '#section_header',
    subject: '#section_subject',
    title: 'table#compose th h1',
    input_text: 'div#input_text',
    input_to: '#input_to',
    input_from: '#input_from',
    input_subject: '#input_subject',
    input_password: '#input_password',
    input_intro: '.input_intro',
    recipients_placeholder: '#recipients_placeholder',
    all_cells_except_text: 'table#compose > tbody > tr > :not(.text)',
    add_intro: '.action_add_intro',
    add_their_pubkey: '.add_pubkey',
    intro_container: '.intro_container',
    password_or_pubkey: '#password_or_pubkey_container',
    password_label: '.label_password',
    send_btn_note: '#send_btn_note',
    send_btn_i: '#send_btn i',
    send_btn: '#send_btn',
    send_btn_text: '#send_btn_text',
    toggle_send_options: '#toggle_send_options',
    icon_pubkey: '.icon.action_include_pubkey',
    icon_help: '.action_feedback',
    icon_popout: '.popout img',
    icon_show_prev_msg: '.action_show_prev_msg',
    prompt: 'div#initial_prompt',
    reply_msg_successful: '#reply_message_successful_container',
    replied_body: '.replied_body',
    replied_attachments: '#attachments',
    recipients: 'span.recipients',
    contacts: '#contacts',
    input_addresses_container_outer: '#input_addresses_container',
    input_addresses_container_inner: '#input_addresses_container > div:first',
    recipients_inputs: '#input_addresses_container input',
    attached_files: 'table#compose #fineuploader .qq-upload-list li',
    email_copy_actions: '#input_addresses_container .email-copy-actions',
    cc: '#cc',
    bcc: '#bcc',
    sending_options_container: '#sending-options-container'
  });

  public composerQuote: ComposerQuote;
  public composerSendBtn: ComposerSendBtn;
  public composerDraft: ComposerDraft;
  public composerContacts: ComposerContacts;
  public composerPwdOrPubkeyContainer: ComposerPwdOrPubkeyContainer;
  public composerWindowSize: ComposerWindowSize;
  public composerSender: ComposerSender;
  public composerAtts: ComposerAtts;
  public composerErrs: ComposerErrs;
  public composerTextInput: ComposerTextInput;
  public composerRender: ComposerRender;

  public app: ComposerAppFunctionsInterface;
  public urlParams: ComposerUrlParams;
  public canReadEmails: boolean;
  public initPromise: Promise<void>;

  constructor(appFunctions: ComposerAppFunctionsInterface, urlParams: ComposerUrlParams) {
    this.app = appFunctions;
    this.urlParams = urlParams;
    this.urlParams.subject = this.urlParams.subject.replace(/^((Re|Fwd): )+/g, '');
    this.composerDraft = new ComposerDraft(this);
    this.composerQuote = new ComposerQuote(this);
    this.composerContacts = new ComposerContacts(this);
    this.composerSendBtn = new ComposerSendBtn(this);
    this.composerPwdOrPubkeyContainer = new ComposerPwdOrPubkeyContainer(this);
    this.composerWindowSize = new ComposerWindowSize(this);
    this.composerSender = new ComposerSender(this);
    this.composerAtts = new ComposerAtts(this);
    this.composerErrs = new ComposerErrs(this);
    this.composerTextInput = new ComposerTextInput(this);
    this.composerRender = new ComposerRender(this);
    const scopes = this.app.getScopes();
    this.canReadEmails = scopes.read || scopes.modify;
    this.initPromise = this.composerRender.initActions().catch(Catch.reportErr);
  }

}
