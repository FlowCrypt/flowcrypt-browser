
function get_url_params(expected_keys) {
  var raw_url_data = window.location.search.replace('?', '').split('&');
  var url_data = {};
  for(var i = 0; i < raw_url_data.length; i++) {
    var pair = raw_url_data[i].split('=');
    if(expected_keys.indexOf(pair[0]) !== -1) {
      url_data[pair[0]] = decodeURIComponent(pair[1]);
    }
  }
  return url_data;
}

function is_email_valid(email) {
  return /[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/i.test(email);
}
