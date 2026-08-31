// ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com
// Firefox content-script sandbox workaround.
//
// In the Firefox content-script isolated world, `ReadableStream`/`TransformStream` are Xray
// wrappers of the page's native implementations. Constructing them with a source object from
// the sandbox realm throws `Permission denied to access property "autoAllocateChunkSize"`
// (https://bugzilla.mozilla.org/show_bug.cgi?id=1757836), which broke openpgp.js's compressed
// packet (zip/zlib) decompression with `MalformedPacketError: Parsing CompressedDataPacket failed`.
//
// This script must run BEFORE the web-streams-polyfill script (both loaded before /lib/openpgp.js):
// 1. It hides the native CompressionStream/DecompressionStream globals so that openpgp.js
//    (loaded next) selects its bundled fflate JS fallback instead of
//    `stream.pipeThrough(native DecompressionStream)`, which fails the web-streams-polyfill's
//    brand checks.
// 2. The web-streams-polyfill script then installs its own same-realm ReadableStream/
//    WritableStream/TransformStream implementations on the sandbox global, so all stream objects
//    created by openpgp.js and web-stream-tools live in a single realm and work as expected.
if (typeof globalThis.CompressionStream !== 'undefined') {
  globalThis.CompressionStream = undefined;
}
if (typeof globalThis.DecompressionStream !== 'undefined') {
  globalThis.DecompressionStream = undefined;
}
