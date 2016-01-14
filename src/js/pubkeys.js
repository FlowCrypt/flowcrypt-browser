

function getPubkey(email, callback) { //add a callback here to do something when I have the info
    var mit_db_url = 'https://pgp.mit.edu/pks/lookup';
    email = email.trim();
    var pubkeyEmailMask = {'tom@cryptup.org': 'tom@bitoasis.net', 'cryptup.org@gmail.com': 'tom@bitoasis.net'};
    if (email in pubkeyEmailMask) {
        search_email = pubkeyEmailMask[email];
    } else {
        search_email = email;
    }
    console.log('searching for ' + search_email);
    $.ajax({
        url: mit_db_url,
        data: {search: search_email, op: 'index', exact: 'on'},
        type: 'GET',
        error: function(XMLHttpRequest, textStatus, errorThrown) {
            console.log(mit_db_url + ' search resulted in 404 for ' + email);
            callback(null);
        },
        success: function(text) {
            var m = new RegExp(/pub[^<]+<\a href="([^"]+)">[A-Z0-9]+<\/\a>[^>]+>([^<]+)<\/\a>/g).exec(text);
            if (m === null) {
                console.log('No match found for ' + email);
                callback(null);
            } else {
                search_query = m[1].split("search=");
                name_email = m[2];
                $.ajax({
                    url: mit_db_url,
                    data: {op: 'get', search: search_query[1]},
                    type: 'GET',
                    error: function(XMLHttpRequest, textStatus, errorThrown){
                        console.log(mit_db_url + ' fetch resulted in 404 for ' + email);
                        callback(null);
                    },
                    success: function(pubkey_text) {
                        var pubkey_m = new RegExp(/-----BEGIN PGP PUBLIC KEY BLOCK-----[^-]+-----END PGP PUBLIC KEY BLOCK-----/g).exec(pubkey_text);
                        if (pubkey_m !== null) {
                            callback({'name': name_email, 'key': pubkey_m[0], 'email': email});
                        } else {
                            console.log([mit_db_url, {op: 'get', search: search_query[1]}])
                            console.log(pubkey_text);
                            console.log(pubkey_m);
                            console.log('Found a match with corresponding email address for ' + email + ', but followup link did not contain a PGP public block');
                            callback(null);
                        }
                    }
                });
            }
        }
    });
}

