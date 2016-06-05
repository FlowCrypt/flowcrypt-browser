'use strict';

var url_params = get_url_params(['account_email']);

var original_passphrase = get_passphrase(url_params.account_email);
if(original_passphrase === null) {
  display_block('step_0_enter');
} else {
  if(original_passphrase === '') {
    $('h1').text('Set a pass phrase');
  } else {
    $('h1').text('Change your pass phrase');
  }
  display_block('step_1_password');
}

function display_block(name) {
  var blocks = ['step_0_enter', 'step_1_password', 'step_2_confirm', 'step_3_done'];
  $.each(blocks, function(i, block) {
    $('#' + block).css('display', 'none');
  });
  $('#' + name).css('display', 'block');
}

$('.action_enter').click(function() {
  var key = openpgp.key.readArmored(private_storage_get(localStorage, url_params.account_email, 'master_private_key')).keys[0];
  if(key.decrypt($('#original_password').val()) === true) {
    original_passphrase = $('#original_password').val();
    display_block('step_1_password');
  } else {
    alert('Pass phrase did not match, please try again.');
    $('#original_password').val('').focus();
  }
});

$('#password').on('keyup', prevent(spree(), function() {
  evaluate_password_strength('#step_1_password', '#password', '.action_password');
}));

$('.action_password').click(function() {
  if($(this).hasClass('green')) {
    display_block('step_2_confirm');
  } else {
    alert('Please select a stronger pass phrase. Combinations of 4 to 5 uncommon words are the best.');
  }
});

$('.action_reset_password').click(function() {
  $('#password').val('');
  $('#password2').val('');
  display_block('step_1_password');
  evaluate_password_strength();
  $('#password').focus();
});

$('.action_change').click(prevent(doubleclick(), function(self) {
  var new_passphrase = $('#password').val();
  if(new_passphrase !== $('#password2').val()) {
    alert('The two pass phrases do not match, please try again.');
    $('#password2').val('');
    $('#password2').focus();
  } else {
    var prv = openpgp.key.readArmored(private_storage_get(localStorage, url_params.account_email, 'master_private_key')).keys[0];
    prv.decrypt(get_passphrase(url_params.account_email) || original_passphrase);
    openpgp_key_encrypt(prv, new_passphrase);
    var stored_passphrase = private_storage_get(localStorage, url_params.account_email, 'master_passphrase');
    if(typeof stored_passphrase !== 'undefined' && stored_passphrase !== '') {
      private_storage_set(localStorage, url_params.account_email, 'master_passphrase', new_passphrase);
      private_storage_set(sessionStorage, url_params.account_email, 'master_passphrase', undefined);
    } else {
      private_storage_set(localStorage, url_params.account_email, 'master_passphrase', undefined);
      private_storage_set(sessionStorage, url_params.account_email, 'master_passphrase', new_passphrase);
    }
    private_storage_set(localStorage, url_params.account_email, 'master_passphrase_needed', true);
    private_storage_set(localStorage, url_params.account_email, 'master_private_key', prv.armor());
    display_block('step_3_done');
  }
}));
