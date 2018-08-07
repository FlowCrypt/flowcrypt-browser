/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

class Factory {

  private set_params: UrlParams;
  private reloadable_class: string;
  private destroyable_class: string;
  private hide_gmail_new_message_in_thread_notification = '<style>.ata-asE { display: none !important; visibility: hidden !important; }</style>';

  constructor(account_email: string, parent_tab_id: string, reloadable_class:string='', destroyable_class:string='', set_params:UrlParams={}) {
    this.reloadable_class = reloadable_class;
    this.destroyable_class = destroyable_class;
    this.set_params = set_params;
    this.set_params.account_email = account_email;
    this.set_params.parent_tab_id = parent_tab_id;
  }

  src_img = (relative_path: string) => this.ext_url(`img/${relative_path}`);

  private frame_src = (path: string, params:UrlParams={}) => {
    for (let k of Object.keys(this.set_params)) {
      params[k] = this.set_params[k];
    }
    return tool.env.url_create(path, params);
  }

  src_compose_message = (draft_id?: string) => {
    return this.frame_src(this.ext_url('chrome/elements/compose.htm'), { is_reply_box: false, draft_id, placement: 'gmail' });
  }

  src_passphrase_dialog = (longids:string[]=[], type: PassphraseDialogType) => {
    return this.frame_src(this.ext_url('chrome/elements/passphrase.htm'), { type, longids });
  }

  src_subscribe_dialog = (verification_email_text: string|null, placement: Placement, source: string|null, subscribe_result_tab_id:string|null=null) => {
    return this.frame_src(this.ext_url('chrome/elements/subscribe.htm'), { verification_email_text, placement, source, subscribe_result_tab_id });
  }

  src_verification_dialog = (verification_email_text: string) => {
    return this.frame_src(this.ext_url('chrome/elements/verification.htm'), { verification_email_text });
  }

  src_attest = (attest_packet: string) => {
    return this.frame_src(this.ext_url('chrome/elements/attest.htm'), { attest_packet, });
  }

  src_add_pubkey_dialog = (emails: string[], placement: Placement) => {
    return this.frame_src(this.ext_url('chrome/elements/add_pubkey.htm'), { emails, placement });
  }

  src_add_footer_dialog = (placement: Placement) => {
    return this.frame_src(this.ext_url('chrome/elements/shared/footer.htm'), { placement });
  }

  src_sending_address_dialog = (placement: Placement) => {
    return this.frame_src(this.ext_url('chrome/elements/sending_address.htm'), { placement });
  }

  src_pgp_attachment_iframe = (a: Attachment) => {
    return this.frame_src(this.ext_url('chrome/elements/attachment.htm'), {frame_id: this.new_id(), message_id: a.message_id, name: a.name, type: a.type, size: a.length, attachment_id: a.id, url: a.url });
  }

  src_pgp_block_iframe = (message: string, message_id: string|null, is_outgoing: boolean|null, sender_email: string|null, has_password: boolean, signature: string|null|boolean, short: string|null) => {
    return this.frame_src(this.ext_url('chrome/elements/pgp_block.htm'), { frame_id: this.new_id(), message, has_password, message_id, sender_email, is_outgoing, signature, short });
  }

  src_pgp_pubkey_iframe = (armored_pubkey: string, is_outgoing: boolean|null) => {
    return this.frame_src(this.ext_url('chrome/elements/pgp_pubkey.htm'), { frame_id: this.new_id(), armored_pubkey, minimized: Boolean(is_outgoing), });
  }

  src_reply_message_iframe = (conversation_params: UrlParams, skip_click_prompt: boolean, ignore_draft: boolean) => {
    let params: UrlParams = {
      is_reply_box: true,
      frame_id: 'frame_' + tool.str.random(10),
      placement: 'gmail',
      thread_id: conversation_params.thread_id,
      skip_click_prompt: Boolean(skip_click_prompt),
      ignore_draft: Boolean(ignore_draft),
      thread_message_id: conversation_params.thread_message_id,
    };
    if (conversation_params.reply_to) { // for gmail and inbox. Outlook gets this from API
      let headers = this.resolve_from_to(conversation_params.addresses as string[], conversation_params.my_email as string, conversation_params.reply_to as string[]);
      params.to = headers.to;
      params.from = headers.from;
      params.subject = 'Re: ' + conversation_params.subject;
    }
    return this.frame_src(this.ext_url('chrome/elements/compose.htm'), params);
  }

  src_stripe_checkout = () => {
    return this.frame_src('https://flowcrypt.com/stripe.htm', {});
  }

  meta_notification_container = () => {
    return `<div class="${this.destroyable_class} webmail_notifications" style="text-align: center;"></div>`;
  }

  meta_stylesheet = (file: string) => {
    return `<link class="${this.destroyable_class}" rel="stylesheet" href="${this.ext_url(`css/${file}.css`)}" />`;
  }

  dialog_passphrase = (longids: string[], type: PassphraseDialogType) => {
    return this.div_dialog(this.iframe(this.src_passphrase_dialog(longids, type), ['medium'], {scrolling: 'no'}));
  }

  dialog_subscribe = (verif_em_txt: string|null, source: string|null, sub_res_tab_id: string|null) => {
    return this.div_dialog(this.iframe(this.src_subscribe_dialog(verif_em_txt, 'dialog', source, sub_res_tab_id), ['mediumtall'], {scrolling: 'no'}));
  }

  dialog_add_pubkey = (emails: string[]) => {
    return this.div_dialog(this.iframe(this.src_add_pubkey_dialog(emails, 'gmail'), ['tall'], {scrolling: 'no'}));
  }

  embedded_compose = (draft_id?: string) => {
    return tool.e('div', {id: 'new_message', class: 'new_message', 'data-test': 'container-new-message', html: this.iframe(this.src_compose_message(draft_id), [], {scrolling: 'no'})});
  }

  embedded_subscribe = (verif_email_text: string, source: string) => {
    return this.iframe(this.src_subscribe_dialog(verif_email_text, 'embedded', source), ['short', 'embedded'], {scrolling: 'no'});
  }

  embedded_verification = (verif_email_text: string) => {
    return this.iframe(this.src_verification_dialog(verif_email_text), ['short', 'embedded'], {scrolling: 'no'});
  }

  embedded_attachment = (meta: Attachment) => {
    return tool.e('span', {class: 'pgp_attachment', html: this.iframe(this.src_pgp_attachment_iframe(meta))});
  }

  embedded_message = (armored: string, message_id: string|null, is_outgoing: boolean|null, sender: string|null, has_password: boolean, signature:string|null|boolean=null, short:string|null=null) => {
    return this.iframe(this.src_pgp_block_iframe(armored, message_id, is_outgoing, sender, has_password, signature, short), ['pgp_block']) + this.hide_gmail_new_message_in_thread_notification;
  }

  embedded_pubkey = (armored_pubkey: string, is_outgoing: boolean|null) => {
    return this.iframe(this.src_pgp_pubkey_iframe(armored_pubkey, is_outgoing), ['pgp_block']);
  }

  embedded_reply = (conversation_params: UrlParams, skip_click_prompt: boolean, ignore_draft:boolean=false) => {
    return this.iframe(this.src_reply_message_iframe(conversation_params, skip_click_prompt, ignore_draft), ['reply_message']);
  }

  embedded_passphrase = (longids: string[]) => {
    return this.div_dialog(this.iframe(this.src_passphrase_dialog(longids, 'embedded'), ['medium'], {scrolling: 'no'}));
  }

  embedded_attachment_status = (content: string) => {
    return tool.e('div', {class: 'attachment_loader', html: content});
  }

  embedded_attest = (attest_packet: string) => {
    return this.iframe(this.src_attest(attest_packet), ['short', 'embedded'], {scrolling: 'no'});
  }

  embedded_stripe_checkout = () => {
    return this.iframe(this.src_stripe_checkout(), [], {sandbox: 'allow-forms allow-scripts allow-same-origin'});
  }

  button_compose = (webmail_name: WebMailName) => {
    if (webmail_name === 'inbox') {
      return `<div class="S ${this.destroyable_class}"><div class="new_message_button y pN oX" tabindex="0" data-test="action-secure-compose"><img src="${this.src_img('logo/logo.svg')}"/></div><label class="bT qV" id="cryptup_compose_button_label"><div class="tv">Secure Compose</div></label></div>`;
    } else if (webmail_name === 'outlook') {
      return `<div class="_fce_c ${this.destroyable_class} cryptup_compose_button_container" role="presentation"><div class="new_message_button" title="New Secure Email"><img src="${this.src_img('logo-19-19.png')}"></div></div>`;
    } else {
      return `<div class="${this.destroyable_class} z0"><div class="new_message_button T-I J-J5-Ji T-I-KE L3" id="flowcrypt_new_message_button" role="button" tabindex="0" data-test="action-secure-compose">Secure Compose</div></div>`;
    }
  }

  button_reply = () => {
    return `<div class="${this.destroyable_class} reply_message_button"><img src="${this.src_img('svgs/reply-icon.svg')}" /></div>`;
  }

  button_without_cryptup = () => {
    return `<span class="hk J-J5-Ji cryptup_convo_button show_original_conversation ${this.destroyable_class}" data-tooltip="Show conversation without FlowCrypt"><span>see original</span></span>`;
  }

  button_with_cryptup = () => {
    return `<span class="hk J-J5-Ji cryptup_convo_button use_secure_reply ${this.destroyable_class}" data-tooltip="Use Secure Reply"><span>secure reply</span></span>`;
  }

  button_recipients_use_encryption = (webmail_name: WebMailName) => {
    if (webmail_name !== 'gmail') {
      tool.catch.report('switch_to_secure not implemented for ' + webmail_name);
      return '';
    } else {
      return '<div class="aoD az6 recipients_use_encryption">Your recipients seem to have encryption set up! <a href="#">Secure Compose</a></div>';
    }
  }

  private ext_url = (s: string) => chrome.extension.getURL(s);

  private new_id = () => `frame_${tool.str.random(10)}`;

  private resolve_from_to = (secondary_emails: string[], my_email: string, their_emails: string[]) => { // when replaying to email I've sent myself, make sure to send it to the other person, and not myself
    if (their_emails.length === 1 && tool.value(their_emails[0]).in(secondary_emails)) {
      return { from: their_emails[0], to: my_email }; // replying to myself, reverse the values to actually write to them
    }
    return { to: their_emails, from: my_email };
  }

  private iframe = (src: string, classes:string[]=[], additional_attributes:UrlParams={}) => {
    let attributes: Dict<string> = {id: tool.env.url_params(['frame_id'], src).frame_id as string, class: (classes || []).concat(this.reloadable_class).join(' '), src};
    for (let name of Object.keys(additional_attributes)) {
      attributes[name] = String(additional_attributes[name]);
    }
    return tool.e('iframe', attributes);
  }

  private div_dialog = (content: string) => {
    return tool.e('div', { id: 'cryptup_dialog', html: content });
  }

}
