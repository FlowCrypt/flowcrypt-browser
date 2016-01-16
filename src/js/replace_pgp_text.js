
function find_and_replace_pgp_messages(){
  // <div id=":30" class="ii gt m15241dbd879bdfb4 adP adO"><div id=":2z" class="a3s" style="overflow: hidden;">-----BEGIN PGP MESSAGE-----<br>
  $("div.nH.hx.aHo div.adP.adO div.a3s:contains('-----BEGIN PGP MESSAGE-----'):contains('-----END PGP MESSAGE-----')").each(function(){
    var text = $(this).html();
    var text_with_iframes = text;
    var re_pgp_blocks = /-----BEGIN PGP MESSAGE-----(.|[\r\n])+?-----END PGP MESSAGE-----/gm;
    var re_first_pgp_block = /-----BEGIN PGP MESSAGE-----(.|[\r\n])+?-----END PGP MESSAGE-----/m;
    $(this).addClass('has_known_pgp_blocks');
    var matches;
    while ((matches = re_pgp_blocks.exec(text)) != null) {
      var valid_pgp_block = strip_tags_from_pgp_message(matches[0]);
      text_with_iframes = text_with_iframes.replace(re_first_pgp_block, pgp_block_iframe(this, valid_pgp_block));
    }
    $(this).html(text_with_iframes);
  });
}

function match_frame_size_to_content() {

}

function strip_tags_from_pgp_message(pgp_block_text){
  // console.log(pgp_block_text);
  var newline = [/<div><br><\/div>/g, /<\/div><div>/g, /<br ?\/?>/g, /<div ?\/?>/g];
  var remove = [/<wbr ?\/?>/g, /<\/?div>/g];
  for (var i=0; i < newline.length; i++){
    pgp_block_text = pgp_block_text.replace(newline[i], '\n');
  }
  for (var i=0; i < remove.length; i++){
    pgp_block_text = pgp_block_text.replace(remove[i], '');
  }
  pgp_block_text = pgp_block_text.replace(/\r\n/g, '\n');
  pgp_block_text = $('<div>' + pgp_block_text + '</div>').text();
  var temp = "This is a string.";
  // console.log(pgp_block_text);
  if(pgp_block_text.match(/\n\n/g).length > 2){ //a lot of newlines are doubled
    // console.log('removing doubles');
    pgp_block_text = pgp_block_text.replace(/\n\n/g, '\n');
    // console.log(pgp_block_text);
  }
  return pgp_block_text;
}

function pgp_block_iframe(parent_container, pgp_block_text) {
  var id = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  for( var i=0; i < 5; i++ ){
    id += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  var width = $(parent_container).width() - 15;
  var src = chrome.extension.getURL('chrome/gmail_elements/pgp_block.htm') + '?frame_id=frame_' + id + '&width=' + width.toString() + '&message=' + encodeURIComponent(pgp_block_text);
  return '<iframe class="pgp_block" id="frame_' + id + '" src="' + src + '"></iframe>';
}

setInterval(find_and_replace_pgp_messages, 1000);
