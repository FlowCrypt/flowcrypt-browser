
var raw_url_data = window.location.search.replace('?', '').split('&');
var url_data = {};
for(var i=0;i<raw_url_data.length;i++){
  var pair = raw_url_data[i].split('=');
  url_data[pair[0]] = decodeURIComponent(pair[1]); //from, to, frame_id
}

$('div#reply_message_prompt, p#reply_links, a#a_reply, a#a_reply_all, a#a_forward').click(function(){
  $('div#reply_message_prompt').css('display', 'none');
  $('div#reply_message_table').css('display', 'block');
});
