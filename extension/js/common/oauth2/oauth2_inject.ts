/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

// Decleared win variable to avoid `Type 'string' is not assignable to type 'Location | (string & Location)'.ts(2322)` error
const win: Window = window;

// Redirect back to the extension itself so that we have priveledged
// access again
const redirect = chrome.extension.getURL('/chrome/elements/oauth2.htm');

win.location = redirect + win.location.search;
