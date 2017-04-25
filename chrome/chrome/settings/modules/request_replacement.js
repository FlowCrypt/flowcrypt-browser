/* Business Source License 1.0 © 2016 Tom James Holub (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/tomholub/cryptup-chrome/tree/master/src/LICENCE */

'use strict';

var url_params = tool.env.url_params(['account_email']);

$('#status').html('Loading from keyserver<br/><br/><br/>' + tool.ui.spinner('green'));

var my_pubkey = private_storage_get('local', url_params.account_email, 'master_public_key');
var prv_headers = tool.crypto.armor.headers('private_key');

tool.api.attester.lookup_email(url_params.account_email, function (success, keyserver_result) {
  if(!success) {
    $('#status').html('Internet connection dropped. <div class="button long green reload">load again</div>');
    $('.reload').click(function () {
      window.location.reload();
    });
  } else if(!keyserver_result.pubkey || !keyserver_result.attested || tool.crypto.key.fingerprint(my_pubkey) === tool.crypto.key.fingerprint(keyserver_result.pubkey)) {
    show_settings_page('/chrome/settings/modules/keyserver.htm');
  } else { // email previously attested, and there indeed is a pubkey mismatch
    $('#status').html('Original key KeyWords:<br/><span class="good">' + mnemonic(tool.crypto.key.longid(keyserver_result.pubkey)) + '<br/>' + tool.crypto.key.fingerprint(keyserver_result.pubkey, 'spaced') + '</span>');
    $('#step_2b_manual_enter').css('display', 'block');
    $('.action_request_replacement').click(tool.ui.event.prevent(tool.ui.event.double(), function () {
      var old_key = openpgp.key.readArmored($('#step_2b_manual_enter .input_private_key').val()).keys[0];
      if(typeof old_key === 'undefined') {
        alert('Private key is not correctly formated. Please insert complete key, including "' + prv_headers.begin + '" and "' + prv_headers.end + '"\n\nEnter the private key you previously used. The corresponding public key is registered with your email, and the private key is needed to confirm this change.\n\nIf you chose to download your backup as a file, you should find it inside that file. If you backed up your key on Gmail, you will find there it by searching your inbox.');
      } else if(old_key.isPublic()) {
        alert('This was a public key. Please insert a private key instead. It\'s a block of text starting with "' + prv_headers.begin + '"');
      } else if(tool.crypto.key.fingerprint(old_key) === tool.crypto.key.fingerprint(my_pubkey)) {
        alert('This is your current key. Look for an older one. It will look very similar.');
      } else if(tool.crypto.key.fingerprint(old_key) !== tool.crypto.key.fingerprint(keyserver_result.pubkey)) {
        alert('Key does not match. Please try another key if you have multiple.');
      } else if(!tool.crypto.key.decrypt(old_key, $('.input_passphrase').val()).success) {
        alert('This is the right key! However, the pass phrase does not match. Please try a different pass phrase. Your original pass phrase might have been different then what you use now.');
      } else {
        var request_replacement = {
          'ATT': 'CRYPTUP', //todo - should be the original attester
          'ACT': 'REQUEST_REPLACEMENT',
          'ADD': tool.crypto.hash.double_sha1_upper(url_params.account_email),
          'OLD': tool.crypto.key.fingerprint(old_key),
          'PUB': tool.crypto.key.fingerprint(my_pubkey),
        };
        tool.api.attester.packet.create_sign(request_replacement, old_key, function (sign_success, sign_result) {
          if(sign_success) {
            tool.api.attester.replace_request(url_params.account_email, sign_result, my_pubkey, function (request_success, request_result) {
              if(request_success && request_result.saved) {
                save_attest_request(url_params.account_email, 'CRYPTUP', function () { //todo - should be the original attester
                  alert('Successfully requested Re-Attestation. It should get processed within a few minutes. You will also receive attestation email shortly. No further actions needed.');
                  show_settings_page('/chrome/settings/modules/keyserver.htm');
                });
              } else {
                alert('Error requesting Re-Attestation. If this happens repeatedly, write me at tom@cryptup.org. Error message:\n\n' + JSON.stringify(request_result));
              }
            });
          } else {
            catcher.log('Error signing REQUEST_REPLACEMENT:' + sign_result);
            alert('Error signing request. If this happens repeatedly, write me at tom@cryptup.org. Error message:\n\n' + JSON.stringify(sign_result));
          }
        });
      }
    }));
  }
});
