
var pubkeys = {};

function colorLegacyWindowAddress(email, pubkey) {
	var element = null;
	$('span.vN').each(function(){
		if ($(this).attr('email') == email) {
			element = $(this);
		}
	});
	if (element !== null) {
		element.removeClass('vNsecure');
		element.removeClass('vNplain');
		if (pubkey !== null) {
			element.addClass('vNsecure');
		} else {
			element.addClass('vNplain');
		}
	}
}

function checkLegacyWindowAddresses() {
	$('span.vN').each(function(){
		var email = $(this).attr('email');
		if (!(email in pubkeys)){
			pubkeys[email] = null;
			getPubkey(email, function(result) {
				pubkeys[email] = result;
				colorLegacyWindowAddress(email, result);
			});
		} else {
			colorLegacyWindowAddress(email, pubkeys[email]);
		}
	});
}

setInterval(checkLegacyWindowAddresses, 1000);
