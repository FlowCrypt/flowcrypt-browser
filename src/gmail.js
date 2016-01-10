

if (document.title.indexOf("Gmail") != -1 || document.title.indexOf("Mail") != -1) {

    console.log(window.navigator.appVersion);
    console.log(window.navigator.platform);

    $('body').append('<div class="cryptup"></div>');
    $('body').append('<div class="T-I-KE T-I J-J5-Ji compose">@</div>');
    $('body').append('<link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/font-awesome/4.5.0/css/font-awesome.min.css" />');
    $('body').append('<script type="text/javascript" href="' + chrome.extension.getURL('jquery.min.js') + '" />');
    $('body').append('<script type="text/javascript" href="' + chrome.extension.getURL('pubkeys.js') + '" />');
    $('body').append('<script type="text/javascript" href="' + chrome.extension.getURL('legacy-message-window.js') + '" />');
    $('body').append('<script type="text/javascript" href="' + chrome.extension.getURL('openpgp.min.js') + '" />');
    $('body').append('<link rel="stylesheet" href="' + chrome.extension.getURL('gmail.css') + '" />');

    $.get(chrome.extension.getURL('compose-window.htm'), function(data) {
        $('div.compose').click(function(){
            if($('div.compose_window').length == 0) {
                $('body').append(data);
            }
        });
    });	

}
