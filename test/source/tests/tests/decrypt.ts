import { TestWithBrowser, TestWithGlobalBrowser } from '..';
import * as ava from 'ava';
import { Config, Util, TestVariant } from '../../util';
import { BrowserRecipe } from '../browser_recipe';
import { Url } from '../../browser';
import { SettingsPageRecipe, InboxPageRecipe } from '../page_recipe';
import { testWithSemaphoredGlobalBrowser } from '../../test';

// tslint:disable:no-blank-lines-func

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

export const defineDecryptTests = (testVariant: TestVariant, testWithNewBrowser: TestWithBrowser, testWithSemaphoredBrowser: TestWithGlobalBrowser) => {

  if (testVariant !== 'CONSUMER-LIVE-GMAIL') {

    for (const m of Config.tests.messages) {
      ava.test(`decrypt[global:compatibility] - ${m.name}`, testWithSemaphoredBrowser('compatibility', async (t, browser) => {
        await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, `chrome/elements/pgp_block.htm${m.params}`, m.content, m.password, m.quoted);
      }));
    }

    ava.test('decrypt[global:compatibility] - by entering pass phrase + remember in session', testWithNewBrowser(async (t, browser) => {
      const pp = Config.key('flowcrypt.compatibility.1pp1').passphrase;
      const threadId = '15f7f5630573be2d';
      const expectedContent = 'The International DUBLIN Literary Award is an international literary award';
      const acctEmail = 'flowcrypt.compatibility@gmail.com';
      await BrowserRecipe.setUpCommonAcct(t, browser, 'compatibility');
      const settingsPage = await browser.newPage(t, Url.extensionSettings());
      await SettingsPageRecipe.changePassphraseRequirement(settingsPage, pp, 'session');
      // requires pp entry
      await InboxPageRecipe.checkDecryptMsg(t, browser, { acctEmail, threadId, expectedContent, enterPp: Config.key('flowcrypt.compatibility.1pp1').passphrase });
      // now remembers pp in session
      await InboxPageRecipe.checkDecryptMsg(t, browser, { acctEmail, threadId, expectedContent });
    }));

    ava.test('[protonmail] load pubkey into contact + verify detached msg', testWithSemaphoredGlobalBrowser('compatibility', async (t, browser) => {
      // this test slightly alters state (imports a pubkey). If this ends up causing trouble, it should run it its own browser instead of the global one
      const textMsgFrameUrl = `chrome/elements/pgp_block.htm?frameId=none&message=&hasPassword=___cu_false___&msgId=16a9c109bc51687d&` +
        `senderEmail=flowcrypt.compatibility%40protonmail.com&isOutgoing=___cu_false___&signature=___cu_true___&acctEmail=flowcrypt.compatibility%40gmail.com&parentTabId=0`;
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, textMsgFrameUrl, ["1234"], undefined, false, ["missing pubkey", "Flowcrypt.Compatibility@Protonmail.Com"]);
      const pubFrameUrl = `chrome/elements/pgp_pubkey.htm?frameId=none&armoredPubkey=${encodeURIComponent(protonCompatPub)}&acctEmail=flowcrypt.compatibility%40gmail.com&parentTabId=0`;
      const pubFrame = await browser.newPage(t, pubFrameUrl);
      await pubFrame.waitAndClick('@action-add-contact');
      await Util.sleep(1);
      await pubFrame.close();
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, textMsgFrameUrl, ["1234"], undefined, false, ["matching signature", "Flowcrypt.Compatibility@Protonmail.Com"]);
      const htmlMsgFrameUrl = `chrome/elements/pgp_block.htm?frameId=none&message=&hasPassword=___cu_false___&msgId=16a9c0fe4e034bc2&` +
        `senderEmail=flowcrypt.compatibility%40protonmail.com&isOutgoing=___cu_false___&signature=___cu_true___&acctEmail=flowcrypt.compatibility%40gmail.com&parentTabId=0`;
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, htmlMsgFrameUrl, ["1234"], undefined, false, ["matching signature", "Flowcrypt.Compatibility@Protonmail.Com"]);
    }));

    ava.test.todo('decrypt[global:compatibility] - by entering secondary pass phrase');

  }

};
