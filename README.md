# FlowCrypt: Encrypt Gmail with PGP

## Users

Get [FlowCrypt](https://flowcrypt.com/) browser extension at: https://flowcrypt.com/download

## Developers

Mock tests: ![Mock tests](https://flowcrypt.semaphoreci.com/badges/flowcrypt-browser.svg?key=d575b4ff-e35d-4217-9152-27cea9e72c19)

Live tests: [![Live Tests](https://semaphoreci.com/api/v1/flowcrypt/flowcrypt-browser/branches/master/badge.svg)](https://semaphoreci.com/flowcrypt/flowcrypt-browser)

This project is written in TypeScript. Browsers only understand JavaScript, so the project needs to be transpiled. You need to build the project the first time you download it, and build it after each change you make to see the result in the browser. To get started, please follow the instructions below:

1. Install the tooling by running the following command after navigating to the appropriate folder:
```bash
$ cd some/folder/flowcrypt-browser
$ npm install
```
2. To build the project (currently available for Linux and Mac only), run the following command:

```bash
$ npm run build
```
After running this command, you can find your built project in the `build/chrome-consumer` and `build/firefox-consumer` folders.

To load the extension in Google Chrome, please follow these steps:

1. Open your Chrome browser and navigate to `chrome://extensions/`.
2. If not already enabled, toggle on the `Developer mode`    switch located at the top-right corner.
3. Click on the `Load Unpacked` button.
4. Browse to and select the appropriate folder, either `build/chrome-consumer` or `chrome-enterprise`.

Similarly, to load the extension in Firefox, follow these steps:

1. Open your Firefox browser and navigate to `about:debugging`.
2. Click on the `This Firefox` tab.
3. Click on the `Load Temporary Add-on` button located at the top-right corner.
4. Browse to and select the appropriate folder, either `build/firefox-consumer` or `firefox-enterprise`, and select the `manifest.json` file.

If you prefer, you can also use the `run_firefox` script (`npm run run_firefox`) included in the package.json file to run the Firefox extension in a separate instance without interfering with the production extension installed in your browser.

Printing debug data to test logs can be done using special `Debug` class:
https://github.com/FlowCrypt/flowcrypt-browser/tree/master/extension/js/common/platform/debug.ts#L7

### Note for Mac OS users

In order for `npm run-script build` to work you have to:

1. Upgrade `bash` to v4 or higher and make the new version default: https://www.shell-tips.com/mac/upgrade-bash/

2. Install GNU `cp` util and make it default: https://stackoverflow.com/a/40431200/3049064

## Other guides

- [FlowCrypt Project Structure and Overview](https://github.com/FlowCrypt/flowcrypt-browser/wiki/FlowCrypt-Project-Structure-and-Overview)
- [FlowCrypt TypeScript Style Guide](https://github.com/FlowCrypt/flowcrypt-browser/wiki/FlowCrypt-TypeScript-Style-Guide)
- [Running tests locally](https://github.com/FlowCrypt/flowcrypt-browser/wiki/Running-tests-locally)
