'use strict';

var url_params = get_url_params(['id', 'download_url', 'name', 'type', 'account_email', 'signal_scope']);

$('#type').text(url_params.type);
$('#name').text(url_params.name);

$('#download').click(prevent(doubleclick(), function(self) {
  var original_content = $(self).html();
  $(self).html(get_spinner());
  $.get(url_params.download_url, function(encrypted_file_data) {
    console.log(encrypted_file_data);
  });
}));
