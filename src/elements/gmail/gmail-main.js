

if (document.title.indexOf("Gmail") != -1 || document.title.indexOf("Mail") != -1) {

    console.log(window.navigator.appVersion);
    console.log(window.navigator.platform);

    $('body').append('<div class="cryptup"></div>');
    $('body').append('<div class="T-I-KE T-I J-J5-Ji compose">@</div>');
    $('body').append('<link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/font-awesome/4.5.0/css/font-awesome.min.css" />');
    $('body').append('<link rel="stylesheet" href="' + chrome.extension.getURL('css/gmail-main.css') + '" />');
    $('body').append('<script src="' + chrome.extension.getURL('lib/emailjs-mime-builder/node_modules/requirejs/require.js') + '"></script>');
    $('body').append('<script src="' + chrome.extension.getURL('lib/gmail-api.js') + '"></script>');

    $.get(chrome.extension.getURL('elements/gmail/compose-window.htm'), function(data) {
        $('div.compose').click(function(){
            if($('div.compose_window').length == 0) {
                $('body').append(data);
            }
        });
    });

}
