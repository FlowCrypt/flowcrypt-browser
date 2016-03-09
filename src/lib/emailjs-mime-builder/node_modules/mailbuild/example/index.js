require.config({
    baseUrl: '../src',
    paths: {
        'addressparser': '../node_modules/addressparser/src/addressparser',
        'mimetypes': '../node_modules/mimetypes/src/mimetypes',
        'mimefuncs': '../node_modules/mimefuncs/src/mimefuncs',
        'punycode': '../node_modules/punycode/punycode.min'
    }
});

require(["mailbuild"], function(mailbuild) {
    'use strict';

    var mail = mailbuild("multipart/mixed");

    mail.setHeader({
        from: "test <test@kreata.ee>",
        to: "test <test@kreata.ee>",
        subject: "PGP Signature Demo"
    });

    var altNode = mail.createChild("multipart/alternative");
    altNode.createChild({filename: "test.txt"}).setContent("Bacon ipsum dolor sit amet pastrami hamburger beef ribs fatback. Beef ribs sausage ham, tail jerky flank rump capicola ham hock ball tip. Pancetta t-bone pig, kevin tongue salami short ribs shank sausage sirloin venison beef cow doner swine. Filet mignon shank ball tip, pig ham hock shankle jerky swine boudin porchetta frankfurter pastrami. Tenderloin chuck salami meatball.");
    altNode.createChild("text/html").setContent("<p>Hello world!</p>");
    altNode.createChild("text/html").setContent('<p lang="ru" xml:lang="ru" dir="ltr">\nНо пожжэ омйттам жкаывола ыюм, зыд ыёрмод аюдирэ чингюльищ нэ.</p>');

    mail.createChild("image/png", {filename: "image.png"}).setContent("BINARY_DATA");

    // build entire message
    var mailBody = mail.build();

    document.getElementById("target").innerHTML = String(mailBody).replace(/</g, "&lt;").replace(/>/g, "&gt;");
});



