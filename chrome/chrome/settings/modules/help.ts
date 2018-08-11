/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

tool.catch.try(async () => {

  let url_params = tool.env.url_params(['account_email', 'parent_tab_id', 'bug_report']);
  let account_email = url_params.account_email as string|undefined;
  let parent_tab_id = tool.env.url_param_require.string(url_params, 'parent_tab_id');
  let bug_report = url_params.bug_report as string|undefined;

  if(account_email) {
    $('#input_email').val(account_email).attr('disabled', 'disabled');
  }

  if(bug_report) {
    $('h2').text('Submit Bug Report to FlowCrypt');
    $('.line.info').text('Please describe in detail what were you doing. Does this happen repeatedly?');
    $('#input_text').val(`\n\n\n--------- BUG REPORT ----------\n${bug_report}`);
  }

  $('.action_send_feedback').click(tool.ui.event.handle(async target => {
    let my_email = account_email;
    if(!my_email) {
      if(tool.str.is_email_valid($('#input_email').val() as string)) {
        my_email = $('#input_email').val() as string;
      } else {
        alert('Please enter valid email - so that we can get back to you.');
        return;
      }
    }
    let original_button_text = $(target).text();
    let button = this;
    $(target).html(tool.ui.spinner('white'));
    await tool.ui.delay(50); // give spinner time to load
    let msg = $('#input_text').val() + '\n\n\nFlowCrypt ' + tool.env.browser().name +  ' ' +  tool.catch.version();
    try {
      let r = await tool.api.cryptup.help_feedback(my_email, msg);
      if (r.sent) {
        $(button).text('sent!');
        alert(`Message sent! You will find your response in ${my_email}, check your email later. Thanks!`);
        tool.browser.message.send(parent_tab_id, 'close_page');
      } else {
        $(button).text(original_button_text);
        alert('There was an error sending message. Our direct email is human@flowcrypt.com');
      }
    } catch (e) {
      if(!tool.api.error.is_network_error(e)) {
        tool.catch.handle_exception(e);
      }
      $(button).text(original_button_text);
      alert('There was an error sending message. Our direct email is human@flowcrypt.com');
    }
  }));

})();
