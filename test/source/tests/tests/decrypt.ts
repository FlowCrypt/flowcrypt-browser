/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import * as ava from 'ava';

import { Config, TestVariant, Util } from '../../util';

import { BrowserRecipe } from '../browser-recipe';
import { InboxPageRecipe } from '../page-recipe/inbox-page-recipe';
import { SettingsPageRecipe } from '../page-recipe/settings-page-recipe';
import { TestUrls } from '../../browser/test-urls';
import { TestWithBrowser } from '../../test';
import { expect } from "chai";

// tslint:disable:no-blank-lines-func
// tslint:disable:max-line-length

const protonCompatPub = `-----BEGIN PGP PUBLIC KEY BLOCK-----
Version: OpenPGP.js v3.0.5
Comment: https://openpgpjs.org

xsBNBFskt/ABCAD0N+Y+ZavNGwRif9vkjcHxmvWkkqBO+pA1KanPUftoi2b/
zMErfl+4P6xe+KpDS97W/BqBGKP7bzN08XSkqyROhv/lroofXgu1WSJ53znf
bRGiRmOjIntBX7iSKecSh9zcgjBRK6xnhoaXxUhCwp8ZsxapMRSwQmlXU6WQ
4XAI4JhtZVpBUtbeUW0/+4KRObmj9Dy+4nnNFFBubBrHV0F7FmkJkvksvkNL
4awmTFbfPE8vkapoDi1hFzMbWoYvEPLmv/HTRcqjPZASLr7fXG+AOefE8uJA
L++Zs0jw2ukrk9KHk3q70ii61CUz9zODCXzeoWQMNTUHoZFuhzawCFe1ABEB
AAHNT2Zsb3djcnlwdC5jb21wYXRpYmlsaXR5QHByb3Rvbm1haWwuY29tIDxm
bG93Y3J5cHQuY29tcGF0aWJpbGl0eUBwcm90b25tYWlsLmNvbT7CwHUEEAEI
ACkFAlskt/EGCwkHCAMCCRB+1D156WF2VQQVCAoCAxYCAQIZAQIbAwIeAQAA
2hYIANsYeRHhz5odpXWbeLc//Ex90llhgWb/kWWW5O5/mQwrOt+4Ct0ZL45J
GeXCQyirHiYhmA50BoDDfayqULDx17v6easDmfdZ2qkVxczc+TjF0VMI+Y/3
GrPuVddzBomc7qqYmEOkKEcnz4Q7mX5Ti1ImY8SSVPOchIbOQUFa96VhZJAq
Xyx+TIzalFQ0F8O1Xmcj2WuklBKAgR4LIX6RrESDcxrozYLZ+ggbFYtf2RBA
tEhsGyA3cJe0d/34jlhs9yxXpKsXGkfVd6atfHVoS7XlJyvZe8nZgUGtCaDf
h5kJ+ByNPQwhTIoK9zWIn1p6UXad34o4J2I1EM9LY4OuONvOwE0EWyS38AEI
ALh5KJNcXr0SSE3qZ7RokjsHl+Oi0YZBiHg0HBZsliIwMBLbR007aSSIAmLa
fJyZ0cD/BmQxHguluaTomfno3GYrjyM86ETz+C0YJJ441Fcji/0fFr8JexXf
eX4GEIVxQd4L0tB7VAAKMIGv/VAfLBpKjfY32LbgiVqVvgkxBtNNGXCaLXNa
3l6l3/xo6hd4/JFIlaVTEb8yI578NF5nZSYG5IlF96xX7kNKj2aKXvdppRDc
RG+nfmDsH9pN3bK4vmfnkI1FwUciKhbiwuDPjDtzBq6lQC4kP89DvLrdU7PH
n2PQxiJyxgjqBUB8eziKp63BMTCIUP5EUHfIV+cU0P0AEQEAAcLAXwQYAQgA
EwUCWyS38QkQftQ9eelhdlUCGwwAAKLKB/94R0jjyKfMGe6QY5hKnlMCNVdD
NqCl3qr67XXCnTuwnwR50Ideh+d2R4gHuu/+7nPo2juCkakZ6rSZA8bnWNiT
z6MOL1b54Jokoi1MreuyA7mOqlpjhTGbyJewFhUI8ybGlFWCudajobY2liF6
AdeK17uMFfR6I1Rid3Qftszqg4FNExTOPHFZIc8CiGgWCye8NKcVqeuVlXKw
257TmI5YAxZAyzhc7iX/Ngv6ZoR18JwKvLP1TfTJxFCG5APb5OSlQmwG747I
EexnUn1E1mOjFwiYOZavCLvJRtazGCreO0FkWtrrtoa+5F2fbKUIVNGg44fG
7aGdFze6mNyI/fMU
=D34s
-----END PGP PUBLIC KEY BLOCK-----`;

const expiredPub = `-----BEGIN PGP PUBLIC KEY BLOCK-----

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
wLiixN34mx9HOoCOwcFxC4+X6VVwVWQ=
=4FOH
-----END PGP PUBLIC KEY BLOCK-----`;

const unusableKey = `-----BEGIN PGP PUBLIC KEY BLOCK-----
Version: FlowCrypt 6.9.1 Gmail Encryption
Comment: Seamlessly send and receive encrypted email

xsFNBFYKyAQBEADsjzxkjEm6ziOxJuPKw8DXyBL472vEM4B+u8JmfhL70CVL
VQk9el8shQcRXy0jBDSWE4ZOV1PMfZAVhgM9v1m3YS8bUBKbwYWehfW39x/+
pjOnlu8WKwN67on36Rn8uzQ6gWMVyfEl2pBGMm8kxGfgp2V41ZopZMPAe+gW
JkV2I/IDdAfiSOw8J0SY3d9yivNsDqC96iG2ckPRsZzrfpeAh/aiknBnzhhe
dmjV7mHP6LdyDGa2AaxABkslmzZOnWjNGbTC0elHq//iaIq5Y2YS9zooKHSI
JpY19QAxgnMVH1Aop3ml0vmhIDcr7sFwXT2Qzu5OGA5YcpDH0GzkMtc9lOE3
rU9l/P7R8nuQtkteKlCj9UCr58N+I20XYAGskCjxY1hjhp3zSRMKNb8xWF+S
hiImCfZlTkys1bCTdx/tjtXxKxSSiquNwZeD0Wz5o9a2VOgnctTwk9IgdrUr
7y++TNOFR8wjdZUw1ILbTu1yU2CJffVVtzWfHvNDWt319+vtWXELz0weyCCb
cIYj2v/xPfyV2DfZmRiAQY7sYXS3V/k4XjtLUyzctVZ7YL/oK5xg+MImc5D0
FDC8SBrX2SrNrngcRwoV+sFYX1PGpIVi0wxo8XKFsoSbzJpS+WLwZ+Kp5crh
WO7S8BcGKp5KkYMRZgBkO+9SL8tYLooaH3Hj2QARAQAB
=qgj+
-----END PGP PUBLIC KEY BLOCK-----`;

export const defineDecryptTests = (testVariant: TestVariant, testWithBrowser: TestWithBrowser) => {

  if (testVariant !== 'CONSUMER-LIVE-GMAIL') {

    for (const m of Config.tests.messages) {
      ava.default(`decrypt - ${m.name}`, testWithBrowser('compatibility', async (t, browser) => {
        await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, `chrome/elements/pgp_block.htm${m.params}`, m.content, m.password, m.quoted);
      }));
    }

    ava.default('decrypt - by entering pass phrase + remember in session', testWithBrowser('compatibility', async (t, browser) => {
      const pp = Config.key('flowcrypt.compatibility.1pp1').passphrase;
      const threadId = '15f7f5630573be2d';
      const expectedContent = 'The International DUBLIN Literary Award is an international literary award';
      const acctEmail = 'flowcrypt.compatibility@gmail.com';
      const settingsPage = await browser.newPage(t, TestUrls.extensionSettings());
      await SettingsPageRecipe.forgetAllPassPhrasesInStorage(settingsPage, pp);
      // requires pp entry
      await InboxPageRecipe.checkDecryptMsg(t, browser, { acctEmail, threadId, expectedContent, enterPp: Config.key('flowcrypt.compatibility.1pp1').passphrase });
      // now remembers pp in session
      await InboxPageRecipe.checkDecryptMsg(t, browser, { acctEmail, threadId, expectedContent });
      // Finish session and check if it's finished
      await InboxPageRecipe.checkFinishingSession(t, browser, acctEmail, threadId);
    }));

    ava.default('decrypt - protonmail - load pubkey into contact + verify detached msg', testWithBrowser('compatibility', async (t, browser) => {
      const textMsgFrameUrl = `chrome/elements/pgp_block.htm?frameId=none&message=&hasPassword=___cu_false___&msgId=16a9c109bc51687d&` +
        `senderEmail=mismatch%40mail.com&isOutgoing=___cu_false___&signature=___cu_true___&acctEmail=flowcrypt.compatibility%40gmail.com&parentTabId=0`;
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, textMsgFrameUrl, ["1234"], undefined, false, ["Missing pubkey", "Mismatch@Mail.Com"]);
      const pubFrameUrl = `chrome/elements/pgp_pubkey.htm?frameId=none&armoredPubkey=${encodeURIComponent(protonCompatPub)}&acctEmail=flowcrypt.compatibility%40gmail.com&parentTabId=0`;
      const pubFrame = await browser.newPage(t, pubFrameUrl);
      await pubFrame.waitAndClick('@action-add-contact');
      await Util.sleep(1);
      await pubFrame.close();
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, textMsgFrameUrl, ["1234"], undefined, false, ["matching signature", "Mismatch@Mail.Com"]);
      const htmlMsgFrameUrl = `chrome/elements/pgp_block.htm?frameId=none&message=&hasPassword=___cu_false___&msgId=16a9c0fe4e034bc2&` +
        `senderEmail=flowcrypt.compatibility%40protonmail.com&isOutgoing=___cu_false___&signature=___cu_true___&acctEmail=flowcrypt.compatibility%40gmail.com&parentTabId=0`;
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, htmlMsgFrameUrl, ["1234"], undefined, false, ["matching signature", "Flowcrypt.Compatibility@Protonmail.Com"]);
    }));

    ava.default('decrypt - protonmail - auto TOFU load matching pubkey first time', testWithBrowser('compatibility', async (t, browser) => {
      const textMsgFrameUrl = `chrome/elements/pgp_block.htm?frameId=none&message=&hasPassword=___cu_false___&msgId=16a9c109bc51687d&` +
        `senderEmail=flowcrypt.compatibility%40protonmail.com&isOutgoing=___cu_false___&signature=___cu_true___&acctEmail=flowcrypt.compatibility%40gmail.com&parentTabId=0`;
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, textMsgFrameUrl, ["1234"], undefined, false, ["Fetched pubkey, click to verify", "Flowcrypt.Compatibility@Protonmail.Com"]); // eslint-disable-line max-len
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, textMsgFrameUrl, ["1234"], undefined, false, ["matching signature", "Flowcrypt.Compatibility@Protonmail.Com"]);
    }));

    ava.default('decrypt - verify encrypted+signed message', testWithBrowser('compatibility', async (t, browser) => {
      const encryptedSignedMsgUrl = `chrome/elements/pgp_block.htm?frameId=none&message=&hasPassword=___cu_false___&msgId=1617429dc55600db&senderEmail=martin%40politick.ca&isOutgoing=___cu_false___&acctEmail=flowcrypt.compatibility%40gmail.com&parentTabId=0`; // eslint-disable-line max-len
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, encryptedSignedMsgUrl, ['4) signed + encrypted email if supported'], undefined, false, ["Fetched pubkey, click to verify", "Martin@Politick.Ca"]); // eslint-disable-line max-len
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, encryptedSignedMsgUrl, ['4) signed + encrypted email if supported'], undefined, false, ["matching signature", "Martin@Politick.Ca"]); // eslint-disable-line max-len
    }));

    ava.default('decrypt - load key - expired key', testWithBrowser('compatibility', async (t, browser) => {
      const pubFrameUrl = `chrome/elements/pgp_pubkey.htm?frameId=none&armoredPubkey=${encodeURIComponent(expiredPub)}&acctEmail=flowcrypt.compatibility%40gmail.com&parentTabId=0`;
      const pubFrame = await browser.newPage(t, pubFrameUrl);
      await pubFrame.waitAll('@action-add-contact');
      expect((await pubFrame.read('@action-add-contact')).toLowerCase()).to.include('expired');
      await pubFrame.click('@action-add-contact');
      await Util.sleep(1);
      await pubFrame.close();
    }));

    ava.default('decrypt - load key - unusable key', testWithBrowser('compatibility', async (t, browser) => {
      const pubFrameUrl = `chrome/elements/pgp_pubkey.htm?frameId=none&armoredPubkey=${encodeURIComponent(unusableKey)}&acctEmail=flowcrypt.compatibility%40gmail.com&parentTabId=0`;
      const pubFrame = await browser.newPage(t, pubFrameUrl);
      await Util.sleep(1);
      await pubFrame.notPresent('@action-add-contact');
      expect((await pubFrame.read('#pgp_block.pgp_pubkey')).toLowerCase()).to.include('not usable');
      await pubFrame.close();
    }));

    ava.default('decrypt - wrong message - checksum throws error', testWithBrowser('compatibility', async (t, browser) => {
      const acctEmail = 'flowcrypt.compatibility@gmail.com';
      const threadId = '15f7ffb9320bd79e';
      const expectedContent = 'Ascii armor integrity check on message failed';
      await InboxPageRecipe.checkDecryptMsg(t, browser, { acctEmail, threadId, expectedContent });
    }));

    ava.default('decrypt - inbox - encrypted message inside signed', testWithBrowser('compatibility', async (t, browser) => {
      const inboxPage = await browser.newPage(t, 'chrome/settings/inbox/inbox.htm?acctEmail=flowcrypt.compatibility%40gmail.com&threadId=16f0bfce331ca2fd');
      await inboxPage.waitAll('iframe.pgp_block');
      const pgpBlock = await inboxPage.getFrame(['pgp_block.htm']);
      await pgpBlock.waitForSelTestState('ready');
      const content = await pgpBlock.read('#pgp_block');
      expect(content).to.include('-----BEGIN PGP MESSAGE-----Version: FlowCrypt 7.4.2 Gmail\nEncryptionComment: Seamlessly send and receive encrypted\nemailwcFMA0taL/zmLZUBAQ/+Kj48OQND');
    }));

    ava.todo('decrypt - by entering secondary pass phrase');

  }

};
