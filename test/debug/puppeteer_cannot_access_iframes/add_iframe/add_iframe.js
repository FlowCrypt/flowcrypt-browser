
window.onload = function() {
  var iframe = document.createElement('iframe');
  iframe.src = chrome.runtime.getURL("iframe.htm");
  document.body.appendChild(iframe);
};