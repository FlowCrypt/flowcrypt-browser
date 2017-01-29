/* Business Source License 1.0 © 2016 Tom James Holub (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/tomholub/cryptup-chrome/tree/master/src/LICENCE */

'use strict';

var url_params = get_url_params(['account_email', 'parent_tab_id']);

$('.action_open_decrypt').click(function () {
  show_settings_page('/chrome/settings/modules/decrypt.htm');
});
