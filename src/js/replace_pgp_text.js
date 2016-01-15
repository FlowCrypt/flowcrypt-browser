

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
      text_with_iframes = text_with_iframes.replace(re_first_pgp_block, pgp_block_iframe(valid_pgp_block));
      console.log(matches[0]);
    }
    $(this).html(text_with_iframes);
  });
}

function strip_tags_from_pgp_message(pgp_block_text){
  var newline = [/<\/div><div>/g, /<br ?\/?>/g, /<div ?\/?>/g];
  var remove = [/<wbr ?\/?>/g, /<\/?div>/g];
  for (var i=0; i < newline.length; i++){
    pgp_block_text = pgp_block_text.replace(newline[i], '\n');
  }
  for (var i=0; i < remove.length; i++){
    pgp_block_text = pgp_block_text.replace(remove[i], '');
  }
  pgp_block_text = pgp_block_text.replace(/\r\n/g, '\n');
  pgp_block_text = $('<div>' + pgp_block_text + '</div>').text();
  return pgp_block_text.replace(/\n\n/g, '\n');
}

function pgp_block_iframe(pgp_block_text) {
  return '<iframe src="' + chrome.extension.getURL('chrome/gmail_elements/pgp_block.htm') + '?message=' + encodeURIComponent(pgp_block_text) + '"></iframe>'
}

setInterval(find_and_replace_pgp_messages, 1000);
