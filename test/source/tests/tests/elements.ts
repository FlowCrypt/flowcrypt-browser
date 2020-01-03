/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import * as ava from 'ava';

import { TestVariant } from '../../util';
import { TestWithBrowser } from '../../test';
import { expect } from 'chai';

// tslint:disable:no-blank-lines-func

export let defineElementTests = (testVariant: TestVariant, testWithBrowser: TestWithBrowser) => {

  if (testVariant !== 'CONSUMER-LIVE-GMAIL') {

    ava.default('compose[global:compatibility] - elements/pgp_pubkey renders', testWithBrowser('compatibility', async (t, browser) => {
      // eslint-disable-next-line max-len
      const pub = `-----BEGIN%20PGP%20PUBLIC%20KEY%20BLOCK-----%0AVersion%3A%20CryptUp%204.3.6%20Gmail%20Encryption%20https%3A%2F%2Fcryptup.org%0AComment%3A%20Seamlessly%20send%2C%20receive%20and%20search%20encrypted%20email%0A%0AxsFNBFj%2FaG8BEADO625P5MArNIVlMBPp%2FHM1lYD1gcVwgYl4aHuXohDMS6dv%0AVAlSDXMVWwbsXJ9T3AxYIL3ZoOFDc1Jy0AqBKhYoOYm5miYHpOQtP%2FM4V6fK%0A3rhmc8C1LP1JXuaEXS0w7MQig8JZC08ECUH1%2FGnhm3tyacRgrAr13s591Obj%0AoP%2FkwglOUjKDYvkXXk9iwouU85sh9HKwC4wR6idFhFSnsl8xp4FI4plLQPTy%0AEa1nf3l%2BoVqCFT5moVtsew7qUD5mWkgytEdr728Sqh5vjiO%2Blc6cjqb0PK77%0ADAuhTel1bV5PRCtRom%2FqrqmOz4MbE5wd2kU%2FJxFPIXZ1BKyicT%2FQ6I9MXjni%0A77Bl91x0V9brnBqyhfY524Vlm%2F2AEb3H9I10rsTBtU4TT%2BSJOlwyU1V7hDkJ%0AKq1zTrVjCvoPcTBXGx9xSZmJO4TI7frNZFiJ5uiYwTYPwp3Yze69y%2FNORwme%0AZlXtXJbzpVvRzXUzex89c6pFiKE8mC5%2FDV%2FeJanBYKgSyGEiHq9U6kDJrTN4%0A%2FfSjiIJ0fWK3bcYwyYUbf9%2B%2FJcLSo2sG259FuRF75yxIe2u2RLSh62plEsyb%0AcpD545pvlrKIvwg%2F1hio999lMnSjj%2BhfNQ7A%2BXm5BWiSzrJ1fR1Oo5rq68kY%0A1C4K8FUQwP3zEF2YDoqbBEnYaxaH7HUcbc34xQARAQABzSlDcnlwdFVwIFRl%0Ac3RlciA8Y3J5cHR1cC50ZXN0ZXJAZ21haWwuY29tPsLBdQQQAQgAKQUCWP9o%0AcAYLCQcIAwIJEAbKVT7CRV1wBBUIAgoDFgIBAhkBAhsDAh4BAAAvwQ%2F%2BIaTX%0Am4ZrqA1h2N%2BgYSUiNkLKnVVZNTdVKSRCEvHNZaYHqZDK5mO9TRKlbz04bIle%0AhfYzt0MW65AmZm5vtp16TTzXQVpFv1YGbFFkol7qR2chzXdnbOCz172W0cKr%0AWu8exVr4XR1C7R6UVckltfouq%2FJGe4pDFwYshluL8ZezCCWDeno6y5JJJr98%0AobKWtSMw0%2B0XqMqFsTP3%2FkF77cWfeZ6aE7Tugq2vRIVg1CuaDZKnrGYPBWbw%0AYZA7r0MTLEHMNm3NWGcmA6BZyAqWLe7ocG%2B%2BDWlXC2AsScUqg26D2pmh4089%0A2%2Fi54ecThwzVmtaycWou6x7E7hEqDGGdD5RorVJ5FqEMq4NsBit43loV7Hoo%0A1R4IW6bVANIqFGUv0VS0MA8%2B7ce1UN9taC762f9idRfNBY0yi9u5hoinSrJo%0ALl%2F489nhyqL74HyelSghK2QusavHCe9BVsHR%2BH0kwszDMtXjDBJtkKRI9FcK%0A%2FQfvU4OvvVKNNSbkz1zaXrGI2YOu4p3CHK%2BaQCluR3PhldVUSDR7wT%2FasfWx%0AMH43juH%2BC0kXonRqye7cDs%2B3wi4qfrJw%2FGYtwC0Jfza%2FOlyuyE%2B1AlVpEBKV%0A7gG%2B6iKTIl2G5DnBN%2FtdfckLNSsYDVby7%2BaZV3CtVvuhfeAjN9YluNqZZBSD%0AqOym88BUsEFLOdzBLbbOwU0EWP9obwEQAKKVKmNQsbpNlhuFZydHjqf%2BAaBB%0AQsJb9Q7zLSuUABmBLUG9%2BohSdb1tsI5MEq7Ldksy2sF4KsY6KBHg0VK4Ndu8%0AKSzeVFlgESyizryt%2Fa8Jad%2FdaujYdJ5fliVx46XYAuVXROhes0Plpa8aQGwU%0AumbV%2Fs2INXqo8HwDke0UI42%2Bk%2FOG2SkkiLGTU2US3OMk85bWoqHi9fYkmM7Y%0ATJRt6dJgwjqevfIvEFUjh3i6ipFSwp%2BB1uS3%2FTHtc%2Fi066wWZwIWb0Z1nsAh%0AVpikL6ckaLiEhkvUEkL%2FmqTfIv0wJAsAsRvXKZvmO8qQrKq8UQrADjfMSP%2F4%0AscohiuwjPRYqpt3NyqrliCcTRWZTBLXj7w1E2m4ZcAeRUFFv1LhcLPkR3uBo%0AmxaoKqbwT6D64sz%2BaXopIMopcsWFf64zFnYBAJN7tYOmIQQMH5aZGNV%2B8v6u%0AWvPpgEzAFQutDUVr2ttAIfyK%2BHPu57pHOAB51N%2Bl04en9WXeUmT1cqpqaXAK%0AV9cEH3oRkpBRz5waIW1LmElWbubjEWKZfLB8NgvGMsA0lMqsaaVdV0swoehQ%0AHuvXIQv1eeBLK%2FsAL3%2FVCStMwkW8gfaL8%2BbEKDK%2Bl4Jd1mhXa%2BVAyzTAEsTT%0AyAaYP3Y1fR595LA8YHBsfu4ugYzqc7%2F71ExvE%2B7S8kdBv0wOiekWs7zVABEB%0AAAHCwV8EGAEIABMFAlj%2FaHMJEAbKVT7CRV1wAhsMAADFiw%2F%2Fe8AN74gI2LD%2B%0A827r3742%2FasQ76JnqM63GDT3c9Tp6N5i7HMxBw%2BKdcPuEgQHWADdpDBcPtRG%0AkQUD9ty2mtvGsYSg27G%2FHPyb2OYSLf6LF7MQPbHl0REvIjyGKvM0jV6sfGQA%0A1DkfY5EdbQIaqamB73GZrG1vmwXYR4NBFYHtqhDxcvOJNDTlTNRcI957G5cp%0AvWS68d2FkCHHlSRsZdLt1JknTaUdCYArgkJSLRMSWPAwWDFZpPJJHf7lkEgU%0A1quql3%2F7wEShDKqfmgOYDzBZ4K0Hy%2F8jSHpiEWlgF6F8Kl0HCRs%2BARhoAbl%2F%0AM45Xb0%2BbDp30xKJMoHkoOyveWZWz2MHb00ISzDlKEBe2MrCPJe6iHVFtqjPM%0A3qZ93hyIaYKu0H8Hc3HlqYB5muvN80FFX7FNPXc4NiIoRp5Nd6F2qvMMnuD%2B%0AAsOKCgQ4KcTa8Joe4%2BcJ8ba3rizK45ktPvvJNzSeB6Zj9rSIiF9iU4a49QDU%0Am9mzGSLx%2FpFtJ4kfFqiVs6htbtobOBKFjUVrhJtKsFuk7awoTA6cl9ytd%2BSA%0A%2BUxSdqb6cFHq5YjR%2BCwRAG0HF2bdd6XvYtZnjwzTkMwYQzG30QPFTpy%2Fnu%2By%0AOwlAeRiv2EMNWKHjnNVWpqwApGGHzFV%2Bg12fK%2BDgurILj%2F8qM1pZBvu3Q8bI%0ACkFQRDXhui8%3D%0A%3Dy3QV%0A-----END%20PGP%20PUBLIC%20KEY%20BLOCK-----`;
      // eslint-disable-next-line max-len
      const url = `chrome/elements/pgp_pubkey.htm?frame_id=frame_sqpdwqmqtu&armored_pubkey=${pub}&minimized=___cu_false___&account_email=flowcrypt.compatibility%40gmail.com&parent_tab_id=9%3A0`;
      const page = await browser.newPage(t, url);
      const content = await page.read('body');
      expect(content).to.contain('cryptup.tester@gmail.com');
      expect(content).to.contain('ALMOST FAMOUS EXILE LOYAL FICTION COME');
    }));

    ava.todo('compose[global:compatibility] - elements/pgp_pubkey shows graceful error when pubkey not usable');

    ava.todo('compose[global:compatibility] - elements/pgp_pubkey can render several pubkeys in one armor');

    ava.todo('compose - elements/pgp_pubkey can import several pubkeys in one armor');

  }

};
