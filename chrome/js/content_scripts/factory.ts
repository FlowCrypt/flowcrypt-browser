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
    this.set_params['account_email'] = account_email;
    this.set_params['parent_tab_id'] = parent_tab_id;
  }

  src_img = (relative_path: string) => this.ext_url(`img/${relative_path}`);

  src_logo = (include_header: boolean, size:number=0) => {
    if(size !== 16) {
      return(include_header ? 'data:image/png;base64,' : '') + 'iVBORw0KGgoAAAANSUhEUgAAABMAAAAOCAYAAADNGCeJAAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH4AMdAREakDr07QAAAFFJREFUOMtjVOpWYqAWYGFgYGC4W3L3PwMDA4NyjzIjTAKfGDag3KPMyMRARcBCjiZcrqWqywbem7giYnBFAM1cRjtv4kvhhCKD6jmAkZoZHQBF3hzwjZcuRAAAAABJRU5ErkJggg==';
    } else {
      return(include_header ? 'data:image/png;base64,' : '') + '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';
    }
  };

  private frame_src = (path: string, params:UrlParams={}) => {
    tool.each(this.set_params, (k, v) => { params[k] = v; });
    return tool.env.url_create(path, params);
  };

  src_compose_message = (draft_id?: string) => {
    return this.frame_src(this.ext_url('chrome/elements/compose.htm'), { is_reply_box: false, draft_id, placement: 'gmail' });
  };

  src_passphrase_dialog = (longids:string[]=[], type: PassphraseDialogType) => {
    return this.frame_src(this.ext_url('chrome/elements/passphrase.htm'), { type, longids });
  };

  src_subscribe_dialog = (verification_email_text: string|null, placement: Placement, source: string|null, subscribe_result_tab_id:string|null=null) => {
    return this.frame_src(this.ext_url('chrome/elements/subscribe.htm'), { verification_email_text, placement, source, subscribe_result_tab_id });
  };

  src_verification_dialog = (verification_email_text: string) => {
    return this.frame_src(this.ext_url('chrome/elements/verification.htm'), { verification_email_text });
  };

  src_attest = (attest_packet: string) => {
    return this.frame_src(this.ext_url('chrome/elements/attest.htm'), { attest_packet, });
  };

  src_add_pubkey_dialog = (emails: string[], placement: Placement) => {
    return this.frame_src(this.ext_url('chrome/elements/add_pubkey.htm'), { emails, placement });
  };

  src_add_footer_dialog = (placement: Placement) => {
    return this.frame_src(this.ext_url('chrome/elements/shared/footer.htm'), { placement });
  };

  src_sending_address_dialog = (placement: Placement) => {
    return this.frame_src(this.ext_url('chrome/elements/sending_address.htm'), { placement });
  };

  src_pgp_attachment_iframe = (meta: UrlParams) => {
    return this.frame_src(this.ext_url('chrome/elements/attachment.htm'), { message_id: meta.message_id, name: meta.name, type: meta.type, size: meta.size, attachment_id: meta.id, url: meta.url });
  };

  src_pgp_block_iframe = (message: string, message_id: string|null, is_outgoing: boolean|null, sender_email: string|null, has_password: boolean, signature: string|null|boolean, short: string|null) => {
    return this.frame_src(this.ext_url('chrome/elements/pgp_block.htm'), { frame_id: this.new_id(), message, has_password, message_id, sender_email, is_outgoing, signature, short });
  };

  src_pgp_pubkey_iframe = (armored_pubkey: string, is_outgoing: boolean|null) => {
    return this.frame_src(this.ext_url('chrome/elements/pgp_pubkey.htm'), { frame_id: this.new_id(), armored_pubkey, minimized: Boolean(is_outgoing), });
  };

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
    if(conversation_params.reply_to) { // for gmail and inbox. Outlook gets this from API
      let headers = this.resolve_from_to(conversation_params.addresses as string[], conversation_params.my_email as string, conversation_params.reply_to as string[]);
      params.to = headers.to;
      params.from = headers.from;
      params.subject = 'Re: ' + conversation_params.subject;
    }
    return this.frame_src(this.ext_url('chrome/elements/compose.htm'), params);
  };

  src_stripe_checkout = () => {
    return this.frame_src('https://flowcrypt.com/stripe.htm', {});
  };

  meta_notification_container = () => {
    return `<div class="${this.destroyable_class} webmail_notifications" style="text-align: center;"></div>`;
  };

  meta_stylesheet = (file: string) => {
    return `<link class="${this.destroyable_class}" rel="stylesheet" href="${this.ext_url(`css/${file}.css`)}" />`;
  };

  dialog_passphrase = (longids: string[], type: PassphraseDialogType) => {
    return this.div_dialog(this.iframe(this.src_passphrase_dialog(longids, type), ['medium'], {scrolling: 'no'}));
  };

  dialog_subscribe = (verif_em_txt: string|null, source: string|null, sub_res_tab_id: string|null) => {
    return this.div_dialog(this.iframe(this.src_subscribe_dialog(verif_em_txt, 'dialog', source, sub_res_tab_id), ['mediumtall'], {scrolling: 'no'}));
  };
  
  dialog_add_pubkey = (emails: string[]) => {
    return this.div_dialog(this.iframe(this.src_add_pubkey_dialog(emails, 'gmail'), ['tall'], {scrolling: 'no'}));
  };

  embedded_compose = (draft_id?: string) => {
    return tool.e('div', {id: 'new_message', class: 'new_message', 'data-test': 'container-new-message', html: this.iframe(this.src_compose_message(draft_id), [], {scrolling: 'no'})});
  };

  embedded_subscribe = (verif_email_text: string, source: string) => {
    return this.iframe(this.src_subscribe_dialog(verif_email_text, 'embedded', source), ['short', 'embedded'], {scrolling: 'no'});
  };

  embedded_verification = (verif_email_text: string) => {
    return this.iframe(this.src_verification_dialog(verif_email_text), ['short', 'embedded'], {scrolling: 'no'});
  };

  embedded_attachment = (meta: UrlParams) => {
    return tool.e('span', {class: 'pgp_attachment', html: this.iframe(this.src_pgp_attachment_iframe(meta))});
  };

  embedded_message = (armored: string, message_id: string|null, is_outgoing: boolean|null, sender: string|null, has_password: boolean, signature:string|null|boolean=null, short:string|null=null) => {
    return this.iframe(this.src_pgp_block_iframe(armored, message_id, is_outgoing, sender, has_password, signature, short), ['pgp_block']) + this.hide_gmail_new_message_in_thread_notification;
  };

  embedded_pubkey = (armored_pubkey: string, is_outgoing: boolean|null) => {
    return this.iframe(this.src_pgp_pubkey_iframe(armored_pubkey, is_outgoing), ['pgp_block']);
  };

  embedded_reply = (conversation_params: UrlParams, skip_click_prompt: boolean, ignore_draft:boolean=false) => {
    return this.iframe(this.src_reply_message_iframe(conversation_params, skip_click_prompt, ignore_draft), ['reply_message']);
  };

  embedded_passphrase = (longids: string[]) => {
    return this.div_dialog(this.iframe(this.src_passphrase_dialog(longids, 'embedded'), ['medium'], {scrolling: 'no'}));
  };

  embedded_attachment_status = (content: string) => {
    return tool.e('div', {class: 'attachment_loader', html: content});
  };

  embedded_attest = (attest_packet: string) => {
    return this.iframe(this.src_attest(attest_packet), ['short', 'embedded'], {scrolling: 'no'});
  };

  embedded_stripe_checkout = () => {
    return this.iframe(this.src_stripe_checkout(), [], {sandbox: 'allow-forms allow-scripts allow-same-origin'});
  };

  button_compose = (webmail_name: WebMailName) => {
    if(webmail_name === 'inbox') {
      return `<div class="S ${this.destroyable_class}"><div class="new_message_button y pN oX" tabindex="0" data-test="action-secure-compose"><img src="${this.src_logo(true)}"/></div><label class="bT qV" id="cryptup_compose_button_label"><div class="tv">Secure Compose</div></label></div>`;
    } else if(webmail_name === 'outlook') {
      return `<div class="_fce_c ${this.destroyable_class} cryptup_compose_button_container" role="presentation"><div class="new_message_button" title="New Secure Email"><img src="${this.src_img('logo-19-19.png')}"></div></div>`;
    } else {
      return `<div class="${this.destroyable_class} z0" style="height: 30px;"><div class="new_message_button" role="button" tabindex="0" data-test="action-secure-compose">SECURE COMPOSE</div></div>`;
    }
  };

  button_reply = () => {
    return `<div class="${this.destroyable_class} reply_message_button"><img src="${this.src_img('svgs/reply-icon.svg')}" /></div>`;
  };

  button_without_cryptup = () => {
    return `<span class="hk J-J5-Ji cryptup_convo_button show_original_conversation ${this.destroyable_class}" data-tooltip="Show conversation without FlowCrypt"><span>see original</span></span>`;
  };

  button_with_cryptup = () => {
    return `<span class="hk J-J5-Ji cryptup_convo_button use_secure_reply ${this.destroyable_class}" data-tooltip="Use Secure Reply"><span>secure reply</span></span>`;
  };

  button_recipients_use_encryption = (count: number, webmail_name: WebMailName) => {
    if(webmail_name !== 'gmail') {
      catcher.report('switch_to_secure not implemented for ' + webmail_name);
      return '';
    } else {
      return '<div class="aoD az6 recipients_use_encryption">Your ' + (count > 1 ? 'recipients seem' : 'recipient seems') + ' to have encryption set up! <a href="#">Secure Compose</a></div>';
    }
  };

  private ext_url = (s: string) => chrome.extension.getURL(s);

  private new_id = () => `frame_${tool.str.random(10)}`;

  private resolve_from_to = (secondary_emails: string[], my_email: string, their_emails: string[]) => { //when replaying to email I've sent myself, make sure to send it to the other person, and not myself
    if(their_emails.length === 1 && tool.value(their_emails[0]).in(secondary_emails)) {
      return { from: their_emails[0], to: my_email }; //replying to myself, reverse the values to actually write to them
    }
    return { to: their_emails, from: my_email };
  };

  private iframe = (src: string, classes:string[]=[], additional_attributes:UrlParams={}) => {
    let attributes: Dict<string> = {id: tool.env.url_params(['frame_id'], src).frame_id as string, class: (classes || []).concat(this.reloadable_class).join(' '), src: src};
    tool.each(additional_attributes, (a: string, v: string) => {
      attributes[a] = v;
    });
    return tool.e('iframe', attributes);
  };

  private div_dialog = (content: string) => {
    return tool.e('div', { id: 'cryptup_dialog', html: content });
  };

}