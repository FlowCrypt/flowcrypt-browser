# FlowCrypt: Encrypt Gmail with PGP


## Users

Get [FlowCrypt](https://flowcrypt.com/) browser extension at: https://flowcrypt.com/download

## Developers

Mock tests: ![Mock tests](https://flowcrypt.semaphoreci.com/badges/flowcrypt-browser.svg?key=d575b4ff-e35d-4217-9152-27cea9e72c19)

Live tests: [![Live Tests](https://semaphoreci.com/api/v1/flowcrypt/flowcrypt-browser/branches/master/badge.svg)](https://semaphoreci.com/flowcrypt/flowcrypt-browser)

```js
let you = new TeamMember();

if(you.know(TS | SWIFT) && you.write(READABLE_CODE) && you.hate('9-5') && you.areFrom(EARTH)) {
  await you.email('tom@flowcrypt.com');
}
```

This project is written in TypeScript. Browsers only understand JavaScript, so the project needs to be transpiled. You need to build the project the first time you download it, and build it after each change you make to see the result in the browser. First, install tooling:

```bash
$ cd some/folder/flowcrypt-browser
$ npm install
```

To build the project (for now Linux and Mac only)
```
$ npm run-script build

> flowcrypt-browser@5.9.7 build /home/luke/git/flowcrypt-browser
> gulp

[02:42:04] Using gulpfile ~/git/flowcrypt-browser/gulpfile.js
[02:42:04] Starting 'default'...
[02:42:04] Starting 'flush'...
[02:42:04] Finished 'flush' after 62 ms
[02:42:04] Starting 'transpileProjectTs'...
[02:42:04] Starting 'copySourceFiles'...
[02:42:04] Starting 'copyVersionedManifest'...
[02:42:05] Finished 'copyVersionedManifest' after 199 ms
[02:42:05] Finished 'copySourceFiles' after 557 ms
[02:42:12] Finished 'transpileProjectTs' after 7.57 s
[02:42:12] Starting 'chromeBuildSpacesToTabs'...
[02:42:12] Finished 'chromeBuildSpacesToTabs' after 4.55 ms
[02:42:12] Starting 'copyChromeToFirefox'...
[02:42:12] Finished 'copyChromeToFirefox' after 323 ms
[02:42:12] Starting 'copyChromeToFirefoxEditedManifest'...
[02:42:12] Finished 'copyChromeToFirefoxEditedManifest' after 10 ms
[02:42:12] Finished 'default' after 7.97 s
```

Now you can find your built project in `build/chrome-consumer` and `build/firefox-consumer`

Printing debug data to test logs can be done using special `Debug` class:
https://github.com/FlowCrypt/flowcrypt-browser/tree/master/extension/js/common/platform/debug.ts#L7

### Note for Mac OS users

In order for `npm run-script build` to work you have to:

1) Upgrade `bash` to v4 or higher and make the new version default: https://www.shell-tips.com/mac/upgrade-bash/

2) Install GNU `cp` util and make it default: https://stackoverflow.com/a/40431200/3049064

## Other guides

- [FlowCrypt Project Structure and Overview](https://github.com/FlowCrypt/flowcrypt-browser/wiki/FlowCrypt-Project-Structure-and-Overview)
- [FlowCrypt TypeScript Style Guide](https://github.com/FlowCrypt/flowcrypt-browser/wiki/FlowCrypt-TypeScript-Style-Guide)
- [Running tests locally](https://github.com/FlowCrypt/flowcrypt-browser/wiki/Running-tests-locally)

