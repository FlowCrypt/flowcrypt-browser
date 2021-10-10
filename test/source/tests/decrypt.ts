/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import * as ava from 'ava';

import { Config, TestVariant, Util } from './../util';
import { testConstants } from './tooling/consts';
import { BrowserRecipe } from './tooling/browser-recipe';
import { GoogleData } from './../mock/google/google-data';
import { InboxPageRecipe } from './page-recipe/inbox-page-recipe';
import { SettingsPageRecipe } from './page-recipe/settings-page-recipe';
import { TestUrls } from './../browser/test-urls';
import { TestWithBrowser } from './../test';
import { expect } from "chai";
import { ComposePageRecipe } from './page-recipe/compose-page-recipe';
import { PageRecipe } from './page-recipe/abstract-page-recipe';
import { Buf } from '../core/buf';

// tslint:disable:no-blank-lines-func
// tslint:disable:max-line-length
/* eslint-disable max-len */
// tslint:disable:no-unused-expression
/* eslint-disable no-unused-expressions */

export const defineDecryptTests = (testVariant: TestVariant, testWithBrowser: TestWithBrowser) => {

  if (testVariant !== 'CONSUMER-LIVE-GMAIL') {

    ava.default(`decrypt - without a subject`, testWithBrowser('compatibility', async (t, browser) => {
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, {
        content: ["This is a compatibility test email"],
        unexpectedContent: ["Encrypted Subject:", "(no subject)"],
        encryption: 'encrypted',
        signature: 'not signed',
        params: "?frameId=none&message=-----BEGIN%20PGP%20MESSAGE-----%0A%0AhQEMA%2Ba5zJlucROnAQf%2BJc3kkQPIko5gnq0bN510e16pk%2FBNq3w00BWZZmqe8QZ3%0A2CDi1i8mJCTf0ax9zCjJmNEoK4sonX88ZtQ3nDX819ATeu8gi6cWTaaTrdtfI5wF%0AGoD3IgRiwOGJf3NAUSa8YB77%2Fpx6AL35je44uXHvstmmWrt4LMQBQaRUGHG51vxf%0AQKNx9hBHLOv83wGjjKoDOByb0Lf2sGIlECgeOHGfowKG3fH4NNO0kWbaLcVvM9Dh%0AgWjQQWWAWhZCuFmpYdIktYzC4CN7JaTRdGbyuK2syrsiWyc1tty%2FlV1XM06dwYO8%0A7xgdXTDbmVwujEtQJW1bJuOoI8DiuRbYfEgGSGADmIUCDANLWi%2F85i2VAQEP%2F1qR%0AiYLG5IMS60KJf89GK13PNeo1QzbNNYrNjxWyiEZOy7n0qZ1X7JWfGrRSx2Wqtesh%0AvzY5Dt%2FWQWVES%2F4sl54GO8Pjlhi6YjIn3wFyZryftOF4eXjoQ7dbbpoOsHhOizcD%0Ap3l4zXPRng8hC4gF%2FZ6XxCsFRHLXgDRsJKu5bZ8VEJvK2m1soG%2BCDl9s%2FDifjf%2FU%0AJVc3DWh7lQPGy%2B8TxkvHtvaD1ZbNSjOIfdmsybBS3Hk%2BSoaLb3MI%2Bv2clHMYnSKs%0A1Z2zEn21SBxrLd%2BYKWD5mBE9UZGyarANvvbMkiPGVkHzzUrfu6NjF9sVKoNLDJmu%0Aegjr6RWNv2CrHr%2BREQWRaQ4004Xfu2WRZkcZH7DLaOvIMlvi8mHNW1EplL2SrvF9%0AoH7YMev0j2x0BLEkrOWtFfRG7NpgMU%2FO1bDz3DD7uDHIgi32KJ%2BUhSYXqiMOlIPK%0A8wB39mCqgY1vD5bkw7l%2FVHX%2BfwU7QTAK2Lg7%2BUGD29VmJhso46Mpz1pbL0HZiuCY%0A9JRr1Cxi%2FXwKWXgng8ijIUhQ8%2FsDdUxuRIx%2FxgLCn%2BNy69MrjZnXE2T0W5%2BgBpuX%0Ac7KUdJwCUEkdiB%2FWlz4izdPUCBUnc0QAqCt7Ixx4S4Hn%2BU1lNfrECqJI14kbf27r%0ALmLiZqEB5WJHLBtUkegyFWr6WwHmqQFxtuu2Tg%2Fz0ukBkZDzODNz0eVQANEb%2FkWn%0AxaaH%2FDhvkx%2BDxKeyhi6LDfAtU7oOOo8C3%2BiTFzk%2BSsr2Tl6Mb6fuSSxxVc%2Fi1YZb%0AEOWEuw%2BTLGhH3nzWG1reM7N0q7lNVy5mz3V9cXRcvRUj7wYBhxf4LyBRtCq3lOUl%0AhfHf7U3zk6ZpIUCq146CbWVAy83jnKbJwzmlOCWoy1rVfbRg6%2BemShml3ugOCjfp%0AJVViuW33ZUEGYIeDHa8CihGn3ai0aN4CHQiuDe%2FA9tljFseYi%2BIdfVhIz10VRPBO%0AbRTW%2FnFDkVjI9E3Bd%2BH5%2Byj4LEbGFYfcSHMjgoMjS578p5dmbl%2FVeNt%2FwS9dxPF8%0A8iRV2tcSu5HbLhWGZJ1l%2Bcn6N1PwW6Rs9NrdfsMD7QNsyDU71hOz10asOgebxYNM%0AgFhhw%2FlxHig9iuNwO8GE0HBDmRv%2BHKxLXue0pHPWt9Ut%2FmY4r%2F%2BruXloxRsU8gjG%0AhzSamV5IdvfQy0xCog2bWDCL4rCngh1IkrFi0CtNNl1mPskhoZqMZjso290yNaUc%0AHeFIdyPyvjjxyoHd9K3BuXx6fPvYbZzFRz9YikMqHxz6AyHAiMJnl8OPFH6XOTki%0AO1liU9LI%2BMsLCmeDqGliNap9VMvpBkJK6lWoC0RDtqHM48sI4BqHBgW6nUwnGv5H%0AtKbDTgFfMZw5c%2BklOWIUHME4eFNyRej69uoofFyb2rNjXBqvKlL2g0dUXbm2nmYG%0AUW4JPHWria6djv6zg0h037c%2FP6%2BDhVdm2O8in8b%2BBgqsdr7ChYPp2jUX8rouFNwd%0AU4xAXYo7iLoDN7AXHUb%2BG19qrx3c%2FXBrb5msVllfjDfKspX9ftTBukl1%2FJv2QdE0%0AG0kEVzAVB3amt9KHNX%2BfMC28rBla60gfxmpEJ9Q7fZCAOqTJPPcS1D9AKVm3wpoh%0ANWNJXYstblVGNBGuYeJuvHyjcGfs23RPgy1PI%2FAqJJcumUCcGb8Aa4BufsyZLw4L%0ACkN6yaCuw5DdmeNklkm%2FNVDJJJpvkLYrTRr6V5VIeO1usvmTYwAg5301DjG%2FI6qP%0AVRJQ7GeUXB9G6r6g15KbNfIALz0SUt6wKrFn6H39aVlBXzFO5Y6EmmD%2BYapfJH0o%0AhOHiIbWHXqU9rPToLC2Pn9WDq9FIUMx%2B0wL0En172e2%2BUOfEoPrcoykVFXemGCVp%0AIbB9HsIUVrsYyqvs7HLQfMdR%2FSjw%2BsFilKzIIBFjgNWHiyOwshVMkHCUHohcw6mJ%0A3cx01xWgJaG42ggGSYvkb4BvZEfgKmslwIV79pbwQxuayKNNqCpPwHuqA1fdlZ2E%0AhR8Dn%2BShq2eP5lStlK0V%2BGYT9fBcfuqApdUKNmJA1Pks%2Bj9h0CzseWYA%0A%3DHRui%0A-----END%20PGP%20MESSAGE-----&msgId=1600f39127880eed&senderEmail=&isOutgoing=___cu_false___&acctEmail=flowcrypt.compatibility%40gmail.com"
      });
    }));

    ava.default(`decrypt - [enigmail] encrypted iso-2022-jp pgp/mime`, testWithBrowser('compatibility', async (t, browser) => {
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, {
        content: ["ゾし逸現飲"],
        encryption: 'encrypted',
        signature: 'not signed',
        params: "?frameId=none&message=-----BEGIN%20PGP%20MESSAGE-----%0A%0AhQIMA0taL%2FzmLZUBAQ%2F%2BJgpmkgscJEB9uAiFT6TbeZsBqD%2FrRDInab9OevrRBWOZ%0AwQ7UxS4OkM8M1joflEgtP1ZjNkCCuOG5RXR3JZFkUeQbvtMc4mpx%2BOOjYbwHwNNE%0A05wbcIHn380axNPWMYqe8%2FiCK9wFWhMDwtpDfJ0PzLKAhnjFhymMWjmXB2avejaS%0AiaKQRelmUiNt5Tk6FAu8UnOAbr7%2BuLvFBzzjyELL3pGzDBLkawhUT2QZ2nqrC1Ns%0AJ8HEXnl0TBI5T9rlK5i6YQi2i26SWk8QkM0ov5OWVK1qISf15VHeP5uLXch3MfHu%0AEfQEubo378Jbka9QMo1%2FE%2F8ublGQReMpsvbrWto9HqfPSXUGe3hUQcIRi3nKuQBx%0AnbMWonnNE7UEhBFytLL2w%2BMmBDlkePa7zDngOjQwLpYNVvrxJnCjk6Skcrn%2Bx20D%0AYkGziEubqhquMRLxJht4UTLuRSLI8j1NtIRZ5Q9Bi%2B1krSJz527cbq%2FIFBU%2BEmNV%0AfCcR1nYbF5%2FhyTwB7aZQyxCVlRWKlYfwv4%2B7q9cj5wCBuLCY7ZKucEbzodehRcEt%0A4C8Txg2KkD7%2F8%2BTt60KcqjvyDtQkQYNSaubugsG2BAmJpYRU6KFVGDlpNe6gGEQI%0AhnVQq5UaZ9z0DcevE25Xr7fg2mLN7yHRRSauvOGlMnP98d3gDluQlbvAzk5qOMqF%0AAgwDqn0MG9%2BUHywBD%2FsHF58ogxK3kAbITjA453U15KkR4bAqcH343mPfjPOPTyAb%0A3IMoYbQV9SbHuptav6t9rhtrGEkNVunLQLrGYNbwrQx253yqgN%2BdRYD8mn101yJM%0AFcN3R6PDCxAL4hW0cXjSspaqe1mx8U7pz%2BLn1DrC4X8O9HHgMrPvUl18Uc14fAkw%0AZm%2Bwk5vzVYxHp8WsQXb9xpe1imlew7jPuHZkNSA4k6YDoGn%2FwpN3mEOKE3BYq6Ro%0AhnTaapIe%2BJIzsa%2FH0HXKcD0ztFeRUEyyjd%2BdE3vdJYehZrEQIjsM0ocqbn5tcf1W%0A9DP0OXGylTfNbBMT6PQ4N5gfyQDext9Z3QOT0c3HcmUYHJd865jR5nXHGzsGW%2BUr%0Ad0Z6AaCsSCP8WPUNixLzgCdB7EQ6Z5PB4etj9%2BFmKYvEbFiaOr9hrY48ny%2BiOJjq%0As0dudhgZkE8XpA9jcJaGnM4UZdFnssiTydlqaFWYwjVk8d4CsjrsTx%2BJNRWOSVHy%0A9WBbUFQc1eH01rv1sfL467Eyzhh92SCfHooHN9lLtF2mDh43ZQu0ReW8aBd7RzHc%0AKJC8E0wcslzLqfF%2Bx7rh0Vt54Y3i0PS9H9RDWATssCx0V3ySwbnxqme6zIa5qKUN%0AkbSqkucmzZKnaksb46S0zJyOB%2BQV%2F8ntYErmLsX1pGFvPFBm0%2BGQ%2FyQgpUiJhtLp%0AAW8jKCFMyQBHhBKyG0k8Dn9f5mO8rE0xG982m%2BnGwlMKJunn%2Biiyz561V%2F2ebb5e%0ARPCj12RUAIzKicPqRaPCaXhEyD30y1rDCHO7vpCB1CgnbVfRcPvTOOuUlGlrMYWa%0AZlAyrc5RkAiSCLUJab9ZTf%2F%2FT34dmP1p0bmIN3Mnwu3XsbEdZnoQxqPSl0UyfqiL%0A4e5uGe2Za%2FrxykM9CuG0f8vtFWsoNhJkTugdZjfKUZdnyfdsmZhNbKlJcuB7prvb%0A0Gl0%2F3fNns6qv%2B%2BR%2FEGNHbZhSxw%2FqZXGBwGa0Y7hwwsA1Q6ObXgnZA1TDqFUhFk6%0A%2FcDa8FlRD1jj9rKyeuwwLryRy%2FLhoq1LL%2FWV%2BOiUB%2F%2FSldGaHkqXv9%2BCJNhmNwEU%0AiC5mZYyhGGbsVcBxuQigilyMpDQJJfcUiqfN8KL%2BN8ICpnuPGgaMQ97SLeHq2Mmm%0AehcEZwVQZGlCnQJNKmhbqqxJB7WmdBRKTDiBxE5qz5r3grB%2F5v%2BMbyM6G6MyAnkP%0AA%2FUKX0QUZsPDR41XVWhZPTDo%2F%2FZ6aIKJwlgB3E9vak2JkD4%2FpdgzyAM28HOTUyJ%2F%0ASfBVLd%2B%2FjxHIVlm1IaLUAzvJjG0NFlXvD7Pkzs5pXmUf%2F%2FbTdFXNA3uh7VBSGQMl%0AkaeyuemQwiW2Ray4tYbUq%2FFCzl%2B8862JBY98w38natrA%2B%2BWMLHIox0rhMIG%2FvoyK%0AU1%2B2KKgED414MsC309jn%2BP6WCZGKt34BXSfDp%2FRbgwP3X0QIxSYOxtmX8fjKlVPR%0A9FPmkwFvIYsE14MSB16y2vxSEt8JFKoGhXRuVxlGoYuuZrpERfhynnkwSLkw0zln%0AMNUUihw9AePivi6H0qy%2B7DpUy%2B41CW8nxkx%2FdePcdbAq84Y71FyfM7gbLu04EPZ0%0AhTzzgSLDSWvLc7vWRGbqI1erQhfadQwiUzMd0YAyImWmnm003dxfRNNC0oCYDE8V%0A3QGFqOmr4AqcbMGIWBGiP0LajmehJEv%2B8GkIkuDwQRtkgaAkHwDMigujFtraqGEn%0AmduYmYBW88YDsXD9Jv24d4Pt2Ce7P4lc4DEAU3vqUMZFdIwHanjKSNr8O6aXXd0e%0AwrFjc71tUTNGF0suNi%2B74ol0rlS1seQNiijulEW53ngK8z5brNSd1N56H%2FwcYx81%0AqSyeqnGYHphNbpwhBTqHkURBlwygxI2%2BCuMSR96j49ko9AZZHYl6DBAqHLKYWHGi%0AvqvpG%2F%2B%2BFFy0AMSxjs%2F%2FCe5lTS3y3skfneaZ9sgH7o%2BUXCJ7Op%2BmtLdHGjn6%0A%3DGAOS%0A-----END%20PGP%20MESSAGE-----&msgId=16f66f1da9d50d05&senderEmail=michael%20<censored%40email.com>&isOutgoing=___cu_false___&acctEmail=flowcrypt.compatibility%40gmail.com"
      });
    }));

    ava.default(`decrypt - [enigmail] encrypted iso-2022-jp, plain text`, testWithBrowser('compatibility', async (t, browser) => {
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, {
        content: ["ゾし逸現飲"],
        encryption: 'encrypted',
        signature: 'not signed',
        params: "?frameId=none&message=-----BEGIN%20PGP%20MESSAGE-----%0A%0AhQIMA0taL%2FzmLZUBAQ%2F%2FembFGVPRuVfiUujhLesQa6a4sbp%2FPOQcAsy%2B%2BO6tD%2FVA%0AwrQtPhJeniYVFeOs%2B37MWy1PkOUn6AAvgasHtlMCVnthxavG1onImCJWyC0NdgYn%0AhrIN9aPmOY7UGhVzpU%2FGTxE1WHJHGMMGShmKbt%2BJThtAvmufuDK1DSho3kcjGEs9%0AwpY0DU0%2B9I7xEmobgQqK4jyzLBLNx4aHl2qurKSmjghmk1ZMW4oluckrDmmQ3AWT%0AZ%2Fq7bnbP1GDNJV8cxR7ed4k6HCzkrX%2BBxL308E8soLtg87occ18QoJAIRAHU0kx5%0AJlS9%2Bfh%2FjNwKanZJjCWv6hqZKz9iUocRZD9iPqh9dhjsKalqkRaxuPM2eJkZY%2B91%0AjG8tsHYTLeY33A4aUpdA6FpNR8Uyz8Agv%2Bx8%2FaFp8GxSNIuUumf6bSIk2Oudt%2Fa6%0ArWvZO%2BM%2BUK53a4k4ibxrkv4zsE8CbijjCP8BvUrA37023GEWkOHIyMoFFy0o06W1%0A56wTP2bLmKbujeES%2Bdkzjrr1r9X6oDBwpoPABKSAjIKFQKcxWvhMgz4WO3w61g3F%0AE8U0Rlx4lB4Ce1I0qzu8S4hkaZ7sYcKJ%2F211pzsaf0BfxZQdrfyu5kse275YgTUA%0AbObnoW2sAWg8fX9JwuL9JVArnJ%2B6AOQjvNG9fr%2FuM4thV%2FzwqBUWfQ0sasDjjxSF%0AAgwDqn0MG9%2BUHywBD%2F9bMrHNk%2FqirxpfIRa9vZcZssXv7A61XUZy2IVum9%2Bp9c4W%0Aswd23kQOfC%2F82Fx75CwMQ%2BzzdP7%2B5tqeNfm3%2F4vfObLCmszf1%2B%2Bj3nVxEEX8sWpC%0AmgHobD3uZPwgShvgcy6ZHkfz%2BBrxqqTJIZ6xD03VgzmNg2cuAHD1YVUKbTHGYcKM%0ACY0b%2B1VG6lv4f78xiB0v8aw%2FaPTvtx0rY2g0YZHaE0JXT59cMNTMORNiE8h8guLB%0Alf6hcwctRN%2BsJw5oW%2FsaXpgFJSzVbQrwp0a1b6Ftzqv%2BqyJL2%2Byay83RaPX%2BR7LR%0AJy9jPrwBbzwCVbJBBSfeQ0zXkeNAOso83rE13UjxPsl%2BkU0ajxy55K%2FP%2FcLO6KKs%0AKtFN7UGo2jGelpqDoGU5FwOoGeEaYW%2BInrZryyV%2FA2bjw6Zmfbh0GMzls25fK%2F9O%0AOJp%2FD0yqEmnkU60O6eDwwwxY7VNqmtuOTZ4z8PIaV9LWuftVOeOG99%2B9g6280CKF%0AYYHAxgb559v70V50bk%2BZ91rdA1SnxSq9wOkUu2K1BmkTdqEO5jxWf04MGrvROZUA%0AdIKQ%2BPYibnRo%2BSObBUn4Otlfhel1tJ9wWWjJLpGJ1Zm3FaoCVH%2FMnnvhF48Q5JNR%0ASDnqTg4wWd51Tokcnz2PoPrxRN3jacI4d0GZiAtsmB28mcKjdB5UYoXEy2MazNLA%0AyAHzCHRtOJ7eOcStwltwnbh67%2FRCK9OCegaiSOMAcsEciVXUpT%2BhVl8oMl6IvJDk%0AFq1CwOL8t3Oj3W2igPkm2EejHl1dkz2JXPHjfHqt24tTtWRa3xuotoSvMAy%2BtfKT%0ACwg67nQan%2F13hl3eF0XXLCD%2B%2BaotGSahUePsgZU79oedY2vmcofUf743sZ%2FN6aMP%0AgELzwyLm7LzcFLjeokhNUDYpBgrH5%2BFcFZqpiTQhILONSvenncP4k3FDjC87DG5J%0AyIckBN1KeU219vaYHEkmSmU3egfEYRMw2HznFAaiMEAnDoGs0ZTqNOx75ktZLpfS%0A779APSTDmS%2FhsXXo7D8%2FmyYWO5RMxFzGL7SIcXkosqa%2BTS3FJ5198epH0xLNrDhM%0A1lMO2ZU5qb2TNA%2BWvSviiwWsZ%2Byj6kD1rzrvEg%2B%2Bq1b67s3oogP08wwHcfX%2BUiND%0AvdGeVd2YFPX0kszhtfJDEYAkJ8ERe5RKQqeNXdk8XMYq2irp3AVBTBDkgTgMDPSU%0ACI3g89S3eldT%0A%3DP4O8%0A-----END%20PGP%20MESSAGE-----&msgId=16f431a0b9056562&senderEmail=&isOutgoing=___cu_false___&acctEmail=flowcrypt.compatibility%40gmail.com"
      });
    }));

    ava.default(`decrypt - quoted part parsing will not crash browser`, testWithBrowser('compatibility', async (t, browser) => {
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, {
        content: ["point to them directly", "free cert through", "will honestly soon", "dropped significantly"],
        encryption: 'encrypted',
        signature: 'not signed',
        params: "?frameId=none&message=-----BEGIN%20PGP%20MESSAGE-----%0AVersion%3A%20FlowCrypt%206.8.5%20Gmail%20Encryption%0AComment%3A%20Seamlessly%20send%20and%20receive%20encrypted%20email%0A%0AwcFMAzBfgamu0SA1ARAAuHXRxM9k%2BXfQ8iPNconAE62s5pP1PdO5iS01%2FOB%2B%0A3%2B6xUX5oWemiwXjmKetzMvYvSA4ltQ7fWxwY%2FRznfUqxiWQAMQflWINMlmrq%0Apv1iznuVrkdXiyhSLvHuhN3F6ZrWFBn3UL5xDHPHYaFsg2azvqgF6QXK9i37%0AwYbZZzJ9OU5yqAdzdTAk2Il5V%2FG7dh0Su9qrY7NAa46DIqbgdlbLYy6qLcvx%0AiI1yaliUg%2FmCbiVj%2B6kgb%2FFs87peaHg0z%2FpcngOB0a7x1ofbIW%2FrcTbhsEjH%0Ag6I%2B7XST3RmKcOv0PgCtEDU6HnRINbbKrwr9M%2F7xjjBKN8iyDs0Z%2FdOXDKKC%0AFuUmD10ut8%2F3d4jJfTIb5FEiPUNsChM7lidHadKjMoEg55iQgUTp2FeWXyIl%0AF0UlmWRZziljUURdDU02z0F%2BNg9wJkCNrdaCHZeULWfU4%2Bzhvobb%2FaTQfS9C%0AIDC9Qo1jPw1U1nojFMQdBMQQ8P9xsD8vHkeG0f3FOzvj8xWm2oJEvBDpsP6Z%0A3tGf5vV0uRFWuTE2xWbV3cMdvsL2rVJanmGnsddJP4p2WS5at7UDdm7DxyKR%0AzUJnuvITlydd78pSXmqUrw9W%2By0oOdIfwWz1A2V9pdaYwBolPGt7UKUeSK6A%0AMYELv6Ac6Yt9TBJ2B7pLu%2Fw0Wtvjw8IGGA%2FYxKX2t4rBwUwDvb12YPaZjcQB%0AEADRrSJiXzDXVdM%2BGbHBW%2FrdKcDoHq6n3f0mUSbwumiz51pQrtKmNgWFQZuM%0ArkV2O76foEDpUn8m3Gwcoo0MvCxJKWQN3U7dzrMzKd79egDQr8mCQIUqPDbJ%0A4gxVCy9pMAI51oIFM4bOD51MdOgrU1uITZDtaapswiIMywmjxYGRGLDsQ%2BgB%0AVaGF86QgHSgH2M7KdWtN9MSqDs28z7N9kdr0bVWAmVauSchqBeGEZAOq90d%2B%0ApXET%2FbEm0Y0l%2BqpOFEfkbWGoAsjOdOa0rSmBcfZoSh%2FtYWDpPwJDT%2BIp4XLp%0AC3C%2FFSQ11gPt0%2BAb8%2FYouGYmICTzMVUkiHxHGs24n6Tww26qBwQFDzXUAwxL%0A7LENsgsebLDOW8RjCn3EUuH0vZID7T13Xa9R1YQQHmIebVN4%2Fgrz%2FqGDYaZ0%0A4Ub%2BpMWpNYIhDWiQRkj3u39m4hCWa2Lo9d2avgUqmdghCDKZkfMtNRAMyLt5%0ALSDnh16yrl1p4P4e7IMDFp6Yt%2BeSCjH55HaDGeq5Z%2F3PhlbD%2BVFY17v72cBN%0AuyqsecJpTacESxX0Q4Psgahr7htG71KvIjaRBeN05I80IXjrMcTY6c8r0qhz%0A72rW2rfNRuwjIGtJOUfFK6vAovR%2F6kMJMTM4elJ4Q%2FEZIN7zd0OY5z%2FzZ%2BkP%0AoyC8hwFHgwhhx1%2Fu%2Bj8Ira7DXtLMIAFT2PriDTi4aGUjforTVKCh9DifU8Bp%0AUvpEUJl71EdFZ5ic%2B%2B6pkGKhyAFbNvJS3dvZWE50%2FCf%2Bm8iUvZCs63aikTON%0AdjBOpQgE32ig39oM9ggHit0zIZPtZl6XTJHytxNoydnT1bp2qJNj81ZyTlQB%0ANTusbMcY3usDMzIbgFdiNFLrRTaZ6KPuXIzljP7Xw2Lm%2BTcVFGRUmDkadFF9%0AY4RC7q3isJz9h8i5Q6sbaWJu6Ylc305FDKH9XensyR0lXGEX7ishe5Mg8MBp%0AOeSyw20GEejrxUHOp5daUA1XKFX6%2BvZbekqZ57Z%2BJFrB%2BU3cWN2b7ADHkxol%0AhfnCymupqLmoOj%2BU8sx2omWE5KBehRiSpWIF01Mx3j0KKwVpJo8wisB9WXg4%0AG3V2LduE%2BBTZves%2F0A0FTUg0m5ZWeqUm1MAOUkQOdf3%2BC8sKVEUUUeW6%2FchL%0AyQXhKCfgpDHFmYKiTUr7ybPmQZ%2F2hll49a0xkndGPi92kmne5dz3X7tHtPH2%0AcgRAluAt2GU7nPYxu3jqWURfeIZvGRLPd4Ty3CfQDAymEQr%2BmMvkgFdfn2pj%0AlhDGntJgUmNzgwmpD60y4eEZhYCnDFQUdEACHb8OTFZ7sZhKO41po%2FCV7Sip%0Apv9ryn%2F5QJJkoDPD1Yy56NqzoaAZxSfm5Uh0mr1wqCjk4yBHrvu8naYpnQMw%0Af%2B0NM0BffntPx6jUr58uUh4GF9bwThLYtFY8SRVMRbz2R2Vfgn5nxnD3EwrV%0AGZo4YnzXXkryrD2V2uwTc8iOhIc47h8LcN7Riz4mvg6wlc2B04skZKknRgBN%0AwtPXB0cjKy5vi5%2FmBTnyHGnCVxhGAtaCsGFBLNmIAoVuu8Te0o0whDyA%2BNly%0A9aBJunBjkfLWol1Xc4wO1PKOE1xQAS9EzE3B%2F%2FGujyzoL6311HgABCjMQeCL%0A3Nv7YQSgp5meoBXX3%2BCqKiPDEaKY%2B%2Bftr8YomcIYQJyDUuRhXoHynv7LcepI%0A%2FQUdYKxem7XECg9rVsjkz%2BP0xtPtTCW1%2F9wWFBkZJP%2Bl6V5zV29Q4ROAIKhN%0AuNmcekI7gUYKhpMp2AGt6MalswUoqhV0aMIpRPdVzN2xrygGtv3LEfOXV%2FlR%0ABdW3J5I%2Fh0AcbR1cteMVZfFX0DInDtJ%2BeOUj236HFWuJ7%2Bc5%2Baj%2BfN%2BIAubQ%0AEinGN1n7KPRtd7s1W%2FT%2Ft7m3ECTCt2bjOGu4E7kcetNuROV0cRpISC40KylC%0AWDhCY0T0jRheyP0n0QA46UHCMvWsFPc8wh03MI9dvDuBf4olzFX3UfCd%2FJC0%0Ap9KlzxRG6CMlJZaDykP3rbCMatUsioMcCubma63ZGUJ0%2Fs8zaOhh5wM8fLLg%0AVJJ0z0cxZJOOaNyulIrCcMonQ42IAiqNr3lQO9dQ4TeR2qCrai90UK%2BDbyH%2F%0AptuxG3Z1D7RWn3KTMoL4lybbcD82HsQvzayNKqFKs3ePRpJ2bHyrb1ehhfuR%0AD1tBuLY3qjk9Ah%2FbPvck%2FwWpzui%2F%2BwanfLRHkl0n7TtZIqA6U87OSQCIGQpN%0AOZfhNSzyFYHwfdHTXon2lyyBXwRAm4WVvb4hYU%2F3ZtVheUevqjDW0gau4KSo%0Aa%2BnbXYYziOrWZ1HtYJYuuDS43I2f%2FfmNpv8PC01OO4b2FOt9QNuHnFzTPnI8%0AgFy4dXj5W9WU%2FwS6eLTBZqftSa5zM8lxEM1ZLQHOtgH3FUwvNJOddujHtJ5V%0A5rsXxFNNYV9WKPxVa1fB9tWvmtXHVLr39djsL92rQTGTgniViHNJRAGk2eCC%0AMoheMqVnBHwv%2B1fIy4YoeWZmmbWnpIq%2Fl7Zi0aKmhsgu5EeJ66R7g3zL2srC%0AIu9OVyVCiCzb1j%2Bm4wSTiLzLlc8iPREdsTt%2BF1cpbB1b9euEDA1l4OIIEcLa%0A0oxZICpvBcrrZkVxayPjsPzz1y%2F3%2Bm%2B2ylEZbew30kaHFxet0abd3NWRYzxO%0ADRSNl%2BZGG6ThAqKcmxPrHNv2gUIqt%2Bvo8O8f6REaPMqRpZRdCesBc1XD5FMi%0AJREzoOCLrFdMO%2Ff6SOe6w7Q%2FtzQqVR%2F7YQJJ4aafqCgclckF7DW%2F%2FJKkAo2x%0AnV63%2FnHrv7zCeurdFLs7iYu7Zrjd9%2FZEZ0DWzI7MKCf7rulwLr9Z1M4s%2BzJy%0ANeV2Qx5HIZ7DBxQxj7PE5AVKgQntVyS4fYIfc4giUDvFb3%2B%2BaTJ%2B%2FPxEW8o0%0AW7kd%2Fb9Y%2FUoIwo1gTA1vL8OQtAmN5%2FizO23APj2%2Bk1Yxa6seaVbGUfgtehde%0APko9tgcRBPr%2BnQMFuiWxzgUb5HFH%2Fiibg1sXZ32re%2BrKJkD6eUQBZF5gFdCS%0AO4UbO9GCEvOCNoAFlatkYEOhA4i25cRW9FmBfmJyCZ%2Fot4vqR5bHYvkddZLp%0AvUCYx9XQn6%2BTsZwaRB6MDPFABqAqFrsJnjzOfjO%2Fwchn10vo9zf3x3dQcKc1%0AGwJECb4v%2FawAayNzqQgmAjmT8JqkcHDGrbUvjVJYvfVA57V3L7Ohd5iceicO%0APb4VEPh2X6%2F2xQKsXgpDqF4aC%2BT9mJ96olqTnFsqKwib%2Bm5%2BdJa9PCAKEKxB%0AuPzU8j7llXBChJt7qwzPNShVV5kYTWpnrUJLyvjCP9qBZ%2BH%2F9UACHQvsrP6Z%0AJERvjq5sUuLpSOvqdUcTACHyEZWHZjXArGLmpCdTsyeHv2UF6%2FG2RVXrwDVk%0Al8xL4pBQkgG1HSA%2BCh2dDTaFyNZcZuF6EtwjfGOyJ0a2dX7sOTSXVggIpXwf%0AHxLB7KZg8GOTr7LRgjMl3h2bCOQJ8K4fOCYLw8yAK%2BMw8dQHwvtYUKcB8jCl%0A2eg3NAgDfqquKS0V06usPmSbXjgYyXTwYFM8NkOglAidnMKE%2BmzJRPsmInxs%0AB90SL2vu7%2BR5%2BX8tbLfCf2AMDd96cgCDB3TCxgaUbo3SU%2Bm6d97ALpiF%2FY6I%0AAUkl%2B5fcUdk8pPXkWzs%2FGyy%2FzpSmSF3I%2F6O0%2FS5RkCGVZ70Ig5%2BfeU89RZCW%0Ad%2Bjz0r8plMUn7lDBmouUkHGIkmXYHM%2Bzf6q9C17VWBwJCx%2FXddGmYTsPHmnL%0A9uHOIVNpDluf6cUvp%2FJlZ7t28f4fCqMFLF1Ebi87zVJBXmyvgue4WEcHVnAD%0A8ZNTpVvc03ZGba9UchGdWt5Y3kauldSFPN%2F4ziCPOeC%2BL50M84irXUevO5Es%0AwAFJtm%2BRI6FycBz7CLlZKjxz8I97%2BXxsjA7ZyuvUNRhORwv9HZx2BJ0OFM01%0Az%2F60Keq%2BQTXPzpzL0xAJNdrrYi3CtWf7gC5hTUlO8ocnx4qnwGOPyo%2BRmMGk%0AqKXLCeeb6OkS%2B%2FPfoGXm%2B9mBpPiskdMhhDD6gEfP6Z6oX%2Fhf%2FnlI9JEMKECN%0AQpPzOcFqDPyBjyBhTo3VSQClqBV2K1dQNL5GLgXa8tkHaXlPtVJR4S0WHCVh%0Aa3vcT%2FossJijMIR01HrM1jhbj%2BmFo6wc0o2XTG003IZih9T6ZZvCnGV6v31%2F%0AJZ2LOWfBReStcSrFZ5ZinS7fWcG%2F5JbuokKZVUxWqJq3jolD6nKpfEcBPaga%0A%2Fc6SujlXKQ2Gr58cmdCrN7JTty5F7lFtZlZRcG7QHtr01RXrrqCGU%2B%2B29%2FB7%0AcS4jpPvX8of3zwaPiBsi68YfkfAlyhQhbWIYYmWFjtyC2aduiGGcPudnRzVk%0AYG3li130yRvD%2BxeS4f4oficXUdB7SvloRbYvNuT%2BtaCPJ15ncSUXwLLOFWk2%0A7PY5r5h6PwPVxhxEtmUgcihbBP59WWViL%2BijxPCBoPxDknREjeJOgKxoswyK%0ALuOj5R2D6SU0Zs%2Fv4kWwXCz3wTTdU%2Bph019Z6SvLnm4XFbJTx1MI90XYzydD%0A2HFYgMuAEae72Hmv8qDO8SOat%2B3EkNw9e4DAT%2FRGOmwuPR95gMucqJLcP%2Fu2%0AJxLNQLSUnlfABSGiAA68Gym6ykDKYMrt4v2JOFNE7j457Iq0U6fKKRxVGNdc%0AnF4KmIyA08QIc1YKoR794%2B%2FgNYmb78PCsBQbXOmgldOAKQQl8%2B5Cz6Y2Mu1U%0AduXWUmcAi%2FIEb1w815jTzedtoIQ2GdW5gGIcWSLiLztV%2Fz35gDPxXb0HUGuO%0AJ6THAR4mc87euWzcBhUBxdfNaEiTdUgcfx5M%2Fh9YFuhS5VJjK1rjX9I2jwP%2F%0AgUBlWVwmG3mE0thoVxpSFHICI7uw00PjTNRA3qiXe1sEB6D9%2FWRuqUvKfkak%0A6ukzJBHJA2buKyZqOGE1R9ZJniRImpJN9sPVF2joSvHPB3cSb1JWENeF2T5H%0AgXMhFY2jbgpcXucMHapqDLJ3WMXCCR6R0pCGxWnYcY0O8klv2r%2FTPfdptVJO%0AaEib8XRAgxR7FfctRKmfrf0d%2F9UQQRYsBnN7fn3baHFG1UUVUEYHTr%2BiXpMM%0ACFontBV4pK%2BGl1bYAvYWLVXeL01drpVTgU24FZp4yTPC%0A%3DqLXa%0A-----END%20PGP%20MESSAGE-----&msgId=16b7fce1c1589c0a&senderEmail=&isOutgoing=___cu_false___&acctEmail=flowcrypt.compatibility%40gmail.com",
        quoted: true
      });
    }));

    ava.default(`decrypt - [flowcrypt] signed message inline`, testWithBrowser('compatibility', async (t, browser) => {
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, {
        content: ["Standard message", "signed inline", "should easily verify", "This is email footer"],
        encryption: 'not encrypted',
        signature: 'COULD NOT VERIFY SIGNATURE: MISSING PUBKEY 06CA553EC2455D70',
        params: "?frameId=none&account_email=flowcrypt.compatibility%40gmail.com&message=-----BEGIN%20PGP%20SIGNED%20MESSAGE-----%0D%0AHash%3A%20SHA256%0D%0A%0D%0AStandard%20message%0D%0A%0D%0Asigned%20inline%0D%0A%0D%0Ashould%20easily%20verify%0D%0AThis%20is%20email%20footer%0D%0A-----BEGIN%20PGP%20SIGNATURE-----%0D%0AVersion%3A%20FlowCrypt%205.0.4%20Gmail%20Encryption%20flowcrypt.com%0D%0AComment%3A%20Seamlessly%20send%2C%20receive%20and%20search%20encrypted%20email%0D%0A%0D%0AwsFcBAEBCAAQBQJZ%2B74YCRAGylU%2BwkVdcAAAfAkQAKYwTCQUX4K26jwzKPG0%0D%0Aue6%2BjSygpkNlsHqfo7ZU0SYbvao0xEo1QQPy9zVW7zP39UAJZkN5EpIARBzF%0D%0A671AA3s0KtknLt0AYfiTJdkqTihRjJZHBHQcxkkajws%2B3Br8oBieB4zi19GJ%0D%0AoOqjyi2uxl7By5CSP238B6CXBTgaYkh%2F7TpYJDgFzuhtXtx0aWBP9h7TgEYN%0D%0AAYNmtGItT6W2Q%2FJoB29cVsxyugVsQhdfM8DA5MpEZY2Zk%2F%2BUHXN0L45rEJFj%0D%0A8HJkR83voiwAe6DdkLQHbYfVytSDZN%2BK80xN%2FVCQfdd7%2BHKpKbftIig0cXmr%0D%0A%2BOsoDMGvPWkGEqJRh57bezWfz6jnkSSJSX9mXFG6KSJ2xuj30nPXsl1Wn1Xv%0D%0AwR5T3L2kDusluFERiq0NnKDwAveHZIzh7xtjmYRlGVNujta0qTQXTyajxDpu%0D%0AgZIqZKjDVZp7CjKYYPzvgUsihPzlgyqAodkMpl%2FIhYidPMB135lV4BBKHrF2%0D%0AUrbb2tXMHa6rEZoj6jbS0uw%2FO1fSBJASYflrJ1M8YLsFCwBHpMWWL38ojbmK%0D%0Ai1EHYIU8A%2Fy0qELPpKorgnLNKh8t05a01nrUWd%2FeXDKS1bbGlLeR6R%2FYvOM5%0D%0AADjvgywpiGmrwdehioKtS0SrHRvExYx8ory0iLo0cLGERArZ3jycF8F%2BS2Xp%0D%0A5BnI%0D%0A%3DF2om%0D%0A-----END%20PGP%20SIGNATURE-----&senderEmail=none@flowcrypt.com"
      });
    }));

    ava.default(`decrypt - [gpgmail] signed message will get parsed and rendered (though verification fails, enigmail does the same)`, testWithBrowser('compatibility', async (t, browser) => {
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, {
        content: ["Hi this is a signed message."],
        encryption: 'not encrypted',
        signature: 'COULD NOT VERIFY SIGNATURE: MISSING PUBKEY, MISSING SENDER INFO',
        params: "?frameId=none&message=&msgId=15f81b5e6ed91b20&senderEmail=&isOutgoing=___cu_false___&signature=___cu_true___&acctEmail=flowcrypt.compatibility%40gmail.com"
      });
    }));

    ava.default(`decrypt - [gpg] signed fully armored message`, testWithBrowser('compatibility', async (t, browser) => {
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, {
        content: [
          "this was encrypted with gpg",
          "gpg --sign --armor -r flowcrypt.compatibility@gmail.com ./text.txt"
        ],
        encryption: 'not encrypted',
        signature: 'COULD NOT VERIFY SIGNATURE: MISSING PUBKEY, MISSING SENDER INFO',
        quoted: false,
        "params": "?frameId=none&message=-----BEGIN%20PGP%20MESSAGE-----%0A%0AowGbwMvMwMVYfy8j1GPd8g7GNXlJHCWpFSV6JRUlcSH3akoyMosVyhOLFVLzkosq%0AC0pSUxTKM0syFNIL0rm4gISCrm5xZnoekEosys0vUtAtUkjLyS8Hq9VLzs8tSCzJ%0ATMrMySypdEjPTczMAYkp6OnDrODqZDJmYWDkYpAVU2QJVTh1Tmeb3HLhpxtYYQ5i%0AZQK5goGLUwAmYl8mwDC3yqJ3RqXeax2n108b42sc%2BI29zE1fLvdgq1Tz3ZL0a2Z5%0AXSTDobXyoiGnj748k%2F8iX7dJYc5C%2BTTmPMXtPmYJKmd7V7v2x6675BfR%2Bm25ednr%0APfEB9k%2B47iQ9yNsgu9TG8NC%2FhhccalMkT1UUcv7V07mW2ZRbfvSop1ZSU%2FbXm3c%2F%0A8nd%2BZShfmrHQYMMfe3Xmildmbhs2f7S6I8G%2ByamhrH1XsnXKlc%2Fca63S53TU7u5e%0A%2BX7vil97zTc3cDgtP%2Fuw6GB6mmTo8mqlb20GytG1LuYzZftP55XYL7XyO5M8Rzx2%0AZcLBPTsfzs8o6bgxt0fBucIlds7nzLOyKld%2BG2u%2BuSqzuj9wgpeOSX149f%2B8y7N%2F%0Ahl5nbXIo3qL3QXaWwsXvh7fITVp155%2FbxSXKX65fuLmh%2BET24Z9C7V8iGf9M7v76%0AtI%2BjSNRu7cnAttxlX4tOGHhtuMH%2BTU8nNv1cPEc1X%2FH1VRv95mWabl3lP%2BHVmou%2F%0ArkyN1%2FsWl7tS%2FfZP3vVlp3MSPvqy%2FP6T3VKhXSYdWFzhyblB6KhqzAbBuuVf%2F2bY%0AKRx1239v9uZrM3yEZOc0JtzNz7Lh7xb6e89tIne4blx81aRT7b86YroUHGfe0PF4%0AsHjRnQWdmeU2kgcmH%2BLUEdxd4bJgx%2FSQwPrb%2B6zieQ0mLbDsvZm7gHFPeq5ZW%2B%2Fe%0ABU8%2FcNc2bd49KWrdT8%2FzKpJ9KmvV9uz4AQA%3D%0A%3Dr8So%0A-----END%20PGP%20MESSAGE-----&hasPassword=___cu_false___&msgId=1707b9c96c5d7893&senderEmail=&isOutgoing=___cu_true___&acctEmail=flowcrypt.compatibility%40gmail.com"
      });
    }));

    ava.default(`decrypt - [flowcrypt] encrypted hello`, testWithBrowser('compatibility', async (t, browser) => {
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, {
        content: ["hello"],
        encryption: 'encrypted',
        signature: 'not signed',
        params: "?frameId=none&account_email=flowcrypt.compatibility%40gmail.com&message=-----BEGIN%20PGP%20MESSAGE-----%0D%0AVersion%3A%20FlowCrypt%205.2.0%20Gmail%20Encryption%20flowcrypt.com%0D%0AComment%3A%20Seamlessly%20send%2C%20receive%20and%20search%20encrypted%20email%0D%0A%0D%0AwcFMA0taL%2FzmLZUBARAArdbyWcgwf3B0LjUD0ephMVsbwKMqETPnpCZiXnuk%0AXWEfNv0IbbuH3Z3MT%2FDmMQuzjltFOx7ggKAg3z452JZI%2FZ74vxaMtiWL%2F4NB%0AbDERSYIsLe%2FqaG0r9bLSFgju2JpToUGY6yiEYg9ciE1vitUwzurx%2BwFi7WIq%0AsO%2Bzra46rp76rUKk%2Fvss6CtPlqScNyJTBmv%2FSz%2BL4zbMESkdiR5qBVqm5ah6%0A65TXO1KIH2ZjdOBmLOEi4p3%2FJM6IQ2iPQQIsxWHjqtMQyOZA9Q40GpRT5kQ7%0ADCUXsRsGB5YjfgsBw2r8HUt2eLKmUThPC%2FQZlu8yLO1AAIAPJJtwAw6OOJTR%0ATxBTwMAhcJxtFRKPYtUD87xuydctGhoLy6mJiPk3q2Z4BP5hctnuSsaUQPl%2F%0ACsZnSyobQIde5MnS3GyEQ%2BMUc0oq94aTS8OdXrX3EJJU1EU3Zy1P38n3V%2Bgy%0AW1qH5CR1D8otQ8Ed9Ks%2BSRiNm%2FQPBo8hu3df5RGQycwVe%2Bbmx3EDCSBq%2BzbD%0ASbaViUJaKxJnqJ%2BUKEruouuhli1EkzVgSj%2BnpQjJ1EcVIjPGNE57BDC0qIF9%0AbcHcCsyT%2B8VMtrCB9aMAUGNXr%2BbyhY8SIv0xFdTshjx5M6PWu7e6yFrRiT2d%0A4mMUJjYMWcEyXd3RH9pn1QLEWZK1Fpaclb8oPi4PwHzSPQEeLXuhArWpS%2Fsv%0AkqaG2U1x8qUu3yM3vkxWWRRMtmRuPTvFfLhoJRqxGV%2FihBIEQXwlKvgG5qcW%0AjP%2FPXN0%3D%0D%0A%3DNyoF%0D%0A-----END%20PGP%20MESSAGE-----%0D%0A&senderEmail=flowcrypt.compatibility@gmail.com"
      });
    }));

    ava.default(`decrypt - [flowcrypt] encrypted utf8`, testWithBrowser('compatibility', async (t, browser) => {
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, {
        content: ["გამარჯობა.", "こんにちは。", "Здравствуй.", "Chào bạn.", "Dobrý deň!", "여보세요?", "你好。"],
        encryption: 'encrypted',
        signature: 'not signed',
        params: "?account_email=flowcrypt.compatibility%40gmail.com&frame_id=frame_CdqnkNWgHP&message=-----BEGIN%20PGP%20MESSAGE-----%0AVersion%3A%20FlowCrypt%205.0.4%20Gmail%20Encryption%20flowcrypt.com%0AComment%3A%20Seamlessly%20send%2C%20receive%20and%20search%20encrypted%20email%0A%0AwcFMA%2BADv%2F5v4RgKAQ%2F8ChgnbhGZoPWlurgYIIv2QrY19hjaUs3cpuKMDlDu%0AVEtRRktKtX2aQ3Uoa8Uujc5xbP%2Ftj4PI2Tq7Hq2J6e%2BevJ83QOkKhT9zjfaJ%0AMqutNeP6TFDdtBsumdoLMEPXeGRL5iQ1QpIlifenIMsGI0JRRYZnZJIa%2Bezf%0AAhp%2FKrwK06bnT7mopm4zNRai2JRDppCbs486Xk9ErOMtCLEzWDZcVPD76agC%0AoTiRQjX%2BHeIyPgAqYTFgS4n5OyOl24alwHwPAvYV9uMEmKfoWZAOc87lZ53v%0Amqmyj14kWMtHwNhgQ8AncozGbv%2B0j52%2FJATK9U605cF6f0%2Fuc4wvd2jqpfWY%0A%2ByJw8E1wLR93oHvp0osyrHPq5TFeQO2CyLzOhhZsT50kyXJuD%2BQfgj7buNed%0AQQY2Ve4nrkYPgHIMukfXQDj8W0ZCluct3WCg7M0YWJizDnI9GE2UN9VN4OHn%0Adfle%2FAjBCijxWLxQqWCSyuwNmZl2QaHS%2BTrGj7%2B27GtsQc3JPu26D50a3PRg%0AHZ9srOYHVRR18PgoSfunySNio6FuMCreg%2BtPds0dN%2FYapCkXnOSrIWUGhOv%2F%0A5XalIpMK4ICa7mCmtgGV7C9BW%2FlvDr2jL4o%2FE0jyJHMF7eUimylGLU5ETu0e%0A3wJFemlLMlClcfsoo7Djpv%2FZLv7M8SvBLwSzr8%2FkF1nBwUwDS1ov%2FOYtlQEB%0AD%2F0YG4QGIkkxLjK5pHLlWGD9k4VJ0vxMjgP3zI5hLG3V9j9mR3dm7zmiULpN%0A%2FyeDlU7v1sdmh2s8x4yJZ5xJaiL6gDPGoxKg017L1GyNzqvna9qoDc2HxBMj%0Aegs8RR6Do8rqk9p8EBXiI3FlHHn%2F5hG49Ni%2FLNNxcqf6dOextTWpm4tFeMHx%0A9nA%2BPO2MoF6oGkrgbOMDUtKZwnQGCxA3%2FYXgv7wya%2FoAS1HYVvRx6Lbl1YME%0AHM7e4nYiAOflwU2getEtSXfu1CD8p30F%2FAkO%2BqKaitZF2LXmS%2F41yIjD69oQ%0AsY5ERKRdNQTBkr5eUhS6rFXII8SXtJVw%2BDY29AAelZTIxIJ%2FzLW6AiPydRSp%0Amu4vi1%2Fy7YWTQ1bWlvyIjHWDRpwVv4K7VMWIk8wUq3uRF5%2F2%2B4h%2FemcXc7pG%0ALuX%2BwiqMWw8Hjv34%2F8HlltrQRG38JtsTKC9DPKTqezrIcdPvv4PkVXGHLxYg%0AdFyfkYr%2Fb3mKiGVpptGEE1rCPzg0TCd8JNQgFr04Xq5gElPP6XBcvs3J5%2Bh%2B%0AuHlaFsoPMzthn8%2BeNmvxiCHpd92VIbl9Vq6%2FZtSPcJn4drrftn3V1zvUC712%0A4LNp2iipdSAynfkBQE0FJv7m9mbunCa5aAEVQ7bxhgNX1CqAtRmeshd8w7SA%0AoyTwxN%2BVsQUhx8OMKB%2FvQ4SQNNK2AVgaKnVXEtPWJsyj0HUlwHB9jjV5L4I%2F%0Ai4OoVEy5ANL2f09cPeHGkbaKb8s4LTqZAU6Zz%2BLfDfTjzPrRD3qVcn3Kcwj3%0A4eCvkBIEt8NJ5%2BZVIKhN3lGCCab%2BFJOtlXaCL0oks7JGlQn57IPmtmWCaGKa%0AVRhp4WU3oIVZkKjI23sIWdt0l0z1H1xKhFVF%2BLE4kiQ%2FCIwifGYJ2R5eQi5I%0AqtFxVWy8T4Y4aWPciv73P%2BRL%2FnDd3JU%3D%0A%3DwmSW%0A-----END%20PGP%20MESSAGE-----&message_id=15f7f5f098d6bc36&senderEmail=&is_outgoing=___cu_false___"
      });
    }));

    ava.default(`decrypt - [flowcrypt] encrypted thai utf8`, testWithBrowser('compatibility', async (t, browser) => {
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, {
        content: ["ทดสอบ", "นี้เป็นการทดสอบ", "ภาษาไทย"],
        encryption: 'encrypted',
        signature: 'not signed',
        params: "?frame_id=frame_vsaWCVStjY&message=-----BEGIN%20PGP%20MESSAGE-----%0AVersion%3A%20FlowCrypt%205.7.1%20Gmail%20Encryption%20flowcrypt.com%0AComment%3A%20Seamlessly%20send%2C%20receive%20and%20search%20encrypted%20email%0A%0AwcFMA1DaD5CEIgc5ARAAoUfZ%2B9NZCeiIQKQK25%2BdSvxB085gOTv0XnoAlqPE%0AjdhKp7XXojq7ccUSaeEW8DqTel5P74FZ8GwuhFNj%2B6G8ZEcOaxo%2BVKgoOkfX%0Azh%2B5BsABuCDRxoEUivVVM3%2BC2SBBGkqgbj47RJUFOWYkQIlwBhSA%2B4bVXaIC%0A7TEYLxNy8845%2FtTLDoSjQyMA2qXx5KgFaiD%2FZNDQeWM6wcYeHCczbRBLBJ9z%0AOvHy6hDdo%2Bs0P1N4jqGCUKpORrrCyqupKkViWIYwhkrNE74BGzSGtWp4PD4d%0Au0bSgCcKNJI4D56vOl7VPpNlqumNaM1DFgWCRdGcQdfeHyw10PuLrWB8QmSI%0Atzhv7SLxGQBc0o0tveTKfugVZlDq3Fi3eo6GDzKHW%2B2NkOjMoR7mNCvI8Zrg%0AcZVFwmSEClNTnBV5QwDSevEkOYdhc6TEi8p3Gngv%2BOMLZmPO1TSAQ15KgzeH%0AK6BzTff%2FeTJggXvR4gbYOvySIrow2eUQ8F%2BLJV2jKfmOJIJBOUKEh%2BRQCuIW%0Ac1TUxrANDM6Q0ZMPrQ9uvKUQuDjORmizBqXo1YvjDEbGHh2%2BdwaTSNr603%2Ff%0A4RDOgaSMhMWNvTx2MXk%2B5V8uqoAqZQZ3tSLkPGtGTumlCnLivR%2FcKTeL0wIb%0AueEVTDW%2Ff7nQfhuPXL%2BfVL4i2HItQgl68YQQg1PxuCHBwUwDS1ov%2FOYtlQEB%0AD%2F965w%2BTY6hqEtzgQaHr0S2AyNdgLU2HkKI26%2F0iZ6m5V9S6Kd39r5HmVOcY%0AuNLDlNwlXjK3ohbmEg3VmLirLt4tiq8meN6wpCKLv29GL1qkNXsrfA01dd8M%0AizYFXmf0c7d7HkV9JQmUr0xbl3Iy1mNl3qcXooR2OociWykK0Z4ESLKNV2Do%0AUAP6z7X7jVHLstri5BOqMKTRihvFB2rMGdJTIzH6XuMlSnJXSa8LBHE3FZZr%0A%2FSqxSV4pseg2VXouscdDkMq958ZAaLteptrQT7rqO2qcJoE3Xoon5RJaFv%2Fl%0AM%2FVSzfgfcXCfJF34HMrZGjrHddeAGG%2B7k9E%2FiEGcZ%2Bkxx4ToruzdxGdenANv%0AQ8W5l3AkT1qlvV5GSB0uwpJm1FavoAtiwQfLX0f%2BDC1jI%2FwL658%2BnzNp70BY%0AlL7MXN9PgLLY22wSIYXG7ZHlbWAbs8WD67gBw7W943rw0%2FmCzuhQGH6sJSLc%0AEMhoCA%2FePk3oL2LqU9F1Im04tz%2B0FBP%2BtPZDey%2Bo96Tl%2F0W8wBUxLCq0SAdv%0ARoG%2Btm%2FqfFpJnCvKMOlW2UMT2dYxFGAsTdgHU2xWBP7v%2FnsUsRBM%2BF2mGcxh%0A1OOVzxs01SvYqza7jPhfW3NYBW5QhtnIx6w4b6h8aFrwOwgH0B%2BhuGvDrppR%0AL5TgtK3%2FJqomOtbk5n7T2YID8dLAIAFzuBmdFwMtyzU3NFucc4ekf%2BZYLiR3%0A0edmsPhzAFhHxbaaUimCfe0ipXiuWMyOTgGr%2FeQHKT5Tax9QbGq6j5XVzAr3%0AsAJ%2BYho2XvA%2F%2Bj0XdVHDw3m68HJcJzcJfESIHod8asikJSpr6l%2F2a7e7P7yk%0Ao5sQ7owhi%2F7DXTPdSyjB7rIO389WrRy3AHBy2T70qEcXL%2FZcRX1Hg00dqNZ1%0Az6r8N1dCp6En71mie9jxN37iejGJgD7ygyr%2BRm4Q8r0dsL8%2B8wfDcbxWpJZu%0A2Zmv7a4MdPYJ6bFiVJYpFau26zP3%0A%3DaaqE%0A-----END%20PGP%20MESSAGE-----&message_id=1645e37647db32f8&senderEmail=&is_outgoing=___cu_false___&account_email=flowcrypt.compatibility%40gmail.com"
      });
    }));

    ava.default(`decrypt - [facebook] encrypted utf8`, testWithBrowser('compatibility', async (t, browser) => {
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, {
        content: ["Сергій Ткаченко"],
        encryption: 'encrypted',
        signature: 'COULD NOT VERIFY SIGNATURE: MISSING PUBKEY, MISSING SENDER INFO',
        params: "?account_email=flowcrypt.compatibility%40gmail.com&frame_id=frame_CdqnkNWgHP&message=-----BEGIN%20PGP%20MESSAGE-----%0A%0AhQIMA0taL%2FzmLZUBAQ%2F9FG%2FDQ01YvjE9jIzCRSPJ392q28yexjq5PIyFnmUb%2FSOk%0Aboeh8Xs1zMmsgcT2rtMN2Fw79MQdqhhsSS8GSU47MJ7MdMLaWBdrF8oR1ChpsCMp%0AwMAqdy31b%2FRE95Pzp78VJnmZp5qDqqCNbnLVD%2BZzev4ElGan58YhpfnMFsdz0tk%2B%0AgTr6CQVDKOprvbskaFanG%2BjpLWo%2F9LzPu1eWrX%2FQ5SwUVcaVKSdbLm5DVRSU1qnt%0A%2FItTiRueMaOPwZgqXJS3GeqT0C%2FCVxCDd0ZKwfP%2FBuhVTKv77l%2BqnxuNj83I%2Fak1%0A0CJw1J5jTe%2FNEwU8ZdcJO8hDWo900zU90oqUoYUsH1yf7SKL8qSJ8%2FGMW9GSz3cX%0AFhsbE1FiJZ0CG6sUAYtMFWX2rhMwuz8vPLXlj3q6iYQ6s%2FCxqJvuHSbIK26XYMWX%0AnsCkuJjKm3cKe3KONeyxOyizlQaA%2BeQB21U33Bap1FSFdJ0APK3HVJ4B6ZICsLiF%0AVX0iml03ezvhC4qRv%2F0Xb2AdYZm%2F1HSgVUuCvX6bnoLDpRYq%2Baiy%2BHeO79%2Fu2Z0T%0A9Dv0YUAopO5it8cEAWBz1eQvKmkNMQC1W%2B3dZ04Z8bZZ95UwQpcVZLLlvxc8ubwK%0A%2Fh55B8g2ExlAFKtkuEfTtsDzAE%2FPUkgzZ%2FmcyT6clvPrGG4NZGpHxEvl%2FshWRjzS%0A7AHgElrFBgyBD%2F3EhQGy3Lb4pf0helGHuMFjEWHb0NocxyKhLLi63rLVZrDPSPWb%0AM4gtE44bMp0HZ1kF150X8F%2FfXX243M7EVf88zv7uFJaKThbK6tqhl%2ByuegUFiDUO%0ADXOwDkj3aPKM5tOpkkR2ECOOsNZiHQXkfvED4yNhx4sRGAEiw7iXuIJp8mRYQKxW%0Afrmbl4yxUSgWii0s8VQOagwRjcYq9PL1Qn2gujfeNDk6SSfDHh2vIEr6by%2F9y6MG%0AeIvbI9VVke%2FUWtZE75yn4XlVROou%2FUmfERyR6%2BzsQBoMp%2BPy3bG%2FZ1pS42jk%2B6YM%0ATVoGz5SEpch1RH41Kokgn9gRvlbUN64jwsAHbWi3CDEtik81TXNhE9GbPidbB49N%0Aihy172mP0U0MoeAdF5T9Y8GEdDu2%2BTBJYzzpjhGszi6pHjyh%2FqFE2stuNCV44YDc%0AJRnWW35gzD1PU%2BgVOWcx%2FPEAMLmY1VN3RMuuFW951BlNtjg6B1E7GBhMHm%2Bn9l8R%0Aw4%2B%2BzjnV8t6ZqIo6OjJgiQkEh85pOq4yq%2BqGrQAJYOwpnJ4hZ65IB3rsqUrlCeeh%0AXU9n%2B8DCgtfmxuodQWqcRDjwADXc8bWFYifHvTehBly1pIrFLvNq%2BBfrE85vbJmv%0ADn%2FGIa%2Bcu9celM8%2Fuu9pKN5Um8sK%2F%2FHRWo4vFzTXRkBUDuK5p0xWMM%2FYVtSV9PN4%0Af51wBMyaY20YOXLYdyAy31%2FNGh61vSRd%2B%2FzjuzresZ2ghvlecZdQy9fnSqUSvbIt%0AJLYa1tK7H7UjmzauZccKcQqKgaXXAQJt%2BXYZYYlwGcCBzHzMCD65fMwcHit%2BH5Gs%0AjMKjBh%2FitsQP3FV50zO%2FkFq6k4fy9j7ib%2BREQqFyeb0JZp3tnqTxpUPPV21wa%2Fws%0AZ87kxWPN4ckwVClciZMDXtESxRXm2xmlwvQY76Kjw5vvvGgizxEBvMafD59bB%2FdO%0AFwa8tlPqlwCnI3SSB5WHEdV2Rfu5O9SU1ao5X%2BzFpZLSeMMgnysY5VBJzFa6EdEP%0Apu16Hl94RX3aONOD4Mq1DGZQg0ZZ5qFZ9ZXCgf%2FJ6mqFo%2BaHCnT4ETNRotN4bIvO%0AdQROF7yiZxKl%2Bue74pfAfgDLPyYBSmOB00IA11dPsml%2FeI%2BVU4MpDdKNWHI6a4lw%0ArqoeoxaKaSg8lx58SeLW5VuRiEZ2PlNnf1aFzfew5lb%2FMBmTrNQLikTkKgRNUzUe%0ApaobFtSnXDabV0Yqg4A2AYoCKErk%2F0R0lyrUitaUgAl6s3e76QRzf4Ao7r5HTXF3%0AsnwFAD4O6ijuQQz0FnszF3VjHwO%2B%2BfxZRoUAVhovPMN8sUxAXbPUq4Lui9vHbGHO%0AxN0CAY%2BAj3qgtrZE5nUt8rTRwiW%2FkVCyDDLY3kbPdZwdOvyeWkSNOijRcdy99ZZG%0A3OXoT8ja60yMmtRvbrSvXQ2KoyM1%2BeLaFOqap6elGGmkZbKvuDR3b4KZElZCvB62%0Aryd4v%2BtsEcCMsTTpo7ekZqtlcs98LA%2BjCFjVUWGxBz5SavUmcVWCy6QzjG0RaXMx%0AImDGQWiom%2FXD8hACE%2B41HYwGrTvKsW33yM%2FJEsDb2dRN%2BrbCQ6RGTjX7tiRV8BGk%0A0MIY3EejIgQkZMZRAzh4ZbGbZhBUZgfUUzsTmNu%2B%2FfppZPQtwRsXvunF%2BqFCvXWT%0Ag5ZVUcZeBqd6awLJe2nr4i1sYKfHLztKjSXnxbN1Gofnvh4NbPRN%2Bh3Q1vB%2FhCgg%0AfjPjdojEiHk1QcUG4Vw3N5IUSWdeYnC%2BCGsO%2FRX9f0u00TnVpgkkQTfj2FPOE0fr%0AYd90TYhegXykYtzjigAkSMgnasd7zg23MLH0kZQxQCdj7%2BEq5JF0zB%2FgbGbKPdId%0AxxWhSPoAU3y0i%2FlyN0541uqlHxX4i%2BcXdlsTSrAg1QBAquCf3we7b7IMaku72aBp%0AXInSLj1bbnWeRmeuKWh%2FIDnk0xvPN7eTIzi%2B0wYkYfuwKLd5QSn6CGLgk9VRHzsC%0AY2PwwSX58Yo0JK%2BYE9DCvMVMNUeJAxpdIkq%2BV0jwjdER%2Fzpv%2FLUy6MKh4X62dKMh%0AyU9MpvqeMYkfFjbVnFlV9bJnWutYKbtNpzRegY5wIGEOXtpRxuFuhQoGkGH423rD%0AcWDEzNuQ3CYqxY%2ByVATpElBiEYbfx3KKZ1%2BG8aLajv0tI6NnN9qkmCIbjv1e%2BFlS%0AuA5WutrCrIgHrMhREC1R6woUh%2FtlcwGpn9gumNZvmvqUY1GY3jQ5UgY5VFgwBycv%0AvM4kbEbk241xt1%2F8%2F9FZBwvjfW9Lyt0CSw%2B9dqYuRAEbXSaAvvqPL8mUUjG2%2FYuD%0A%2FeStuJYwOn1e9gNYX%2FiUYJD8SqPx89DgGSOcSPOefcURbqLF2yQGl5si2PonVNW0%0AjCsLc6iREfLO%2F28qn9Wd1ORBI6VdcRKHmAxRf517IZDAzO4aay45T04hU5xFL2eA%0AUZ9TC8kx56rdNFvrL670XfOa1er7MaprUBhWfdtgbIQ%2BYTYjzVVi5954ivMEV7J%2B%0AyBLgCKUUJYI%2B%2BvWJ%2Bi7X07Kzt0ZHXebLRCCljiM124dkhncGVUM6QXb1qK4hQG5Q%0AFhxrOjGUrNq7zExBPYEihmd4zf3e3kQXPb1DmldTrwRz%2BusBSB4kSi%2BKjW%2FiKrte%0A0%2BGXgDaJUIL28XLPTYZHPwE3mB7tw4YImSxeSfC9FnRw66JF%2B2Eoae%2FO52G7BoEl%0AqPVRTvVu2DgXxb%2FDljorSrWa00iJSZKeasXDrHSCKcUexkZ21D8Fmr%2BNib3KhQRY%0Aa%2FzgNO9lg%2Bg4JWu2KbVyjECcjToS1sS1TOXWFpGUFMJ5WXMUgZGD1Kk7m09fZF%2F2%0ARbgm6mDWFzG4gNbz%2BqpRmZUCfKwvEDEWtCw7lc0AtAZitjZW1OfATo7oCuqSYQyb%0A4A%2BPibAme7a3kJ3pn5puGQ11hYY33iYv0Jk5%2FMEWVztwkwYc4rweS71YxatIrJiT%0A6SaD2jSzZwAvyqeEWZbYOByIZaRmm6rTmGpE0yGB%2B7zWJ0ZpbCvqQcyTrCZBMlp9%0AkselQeRaxDpkcmlP60Hb0b3emrbDtRliVrTpw3WJbafI4kMSv9kuozBqAavPkhjm%0AKH%2FR6bvuuYzG0fhr9O1CT7wdn85hILepQoIAiLkkjpx9t0x2GS4els2LQm3fRU9h%0AaXP4YKsIoe%2FJjSmdyvs5orSHbNEIsS8MpLBRTKzpl9y7SOFaGp82Vz8%2FLh6yrey0%0AXV8Oz1tQZguU23%2FNkEkgSFjWeJwEB6LCKzMnBOXmFPi%2BFqx5S7JphhAJdu6sCTXK%0AZjYkkNP%2FUGsbWIFCkqzId9CRPzR2Q5Db16bkjJmxNzSnYXUP%2FRzI%2FILbvFTtA5uU%0AS9%2FYPTcTXyVQWuU0uPUl504M6Vz7uMtj6XFFbU9yAOlBrimZpJPYHygFvkS7MoNu%0AuV5pwAADkNFxzoW9GxBeZW9fwouL3KrHw52Nl1AkFWmoIshdXqTOpNgi7Xxj8XqA%0AMF56BJYMjxRbQtnGHZoj8jrIwUTDTIYvms7xxJHm5YOv%2BtvAlcBMcaRX%2FpKYtoz8%0AQYrOZATUQs6OjXuWWzydltx4Z334iZqtJPwlJ4tp9AkLVPjhHwB64pAdrVLOwlDz%0AoYXccYJsqWPZhp2ygkQ06IMPT%2FSVKs0poKdchaaHTo8BRDvzC1PoudjoB4SusL5F%0AWG0mZrv3N6yPk7V%2FCajURwrf2i14SV58swwiS05xZDhUX4IOVBFDQEF4EEHbjWvR%0AbiYyr48NZCqQKIUUX7Ol5aO4ogv7ZFW%2FLsviCh7iYENRHcF0RKRXCLnpFNdULXFA%0A%2FAIm3TOX0vp%2BtjpM%2F19%2BH7wmqj1DLTGWk8xX%2FrBsgTbuqhPaT4otQxcwkA%2FzppMh%0AJ9iUYOdWrnHs4DLX7cHoKjwcHkemF7GT6F0ufyQI4MimLp9YJioy0Vs7seZiGBnA%0AyBSFIFn827tgGN%2FbEqNT5JAUcRn3VClhmgA25mPeHtJ0Qm%2BrF2rOddfXJ9yLGJcd%0AcLQK6yPf3T1wqd1rWdgJ%2FLCj%2BNrWWfOgp%2FL9qDrzdTJoTOQZtSw5KVnQ683Y%2FJr9%0AwX3j5B2mgMwT5EfJb%2BQzDiD%2F02Pnitzn42v9FMZct9260HIGWsnfVu2dhXPwbE69%0Ajh8ccj6E1Pz%2BfRcheJCnyMD7YDNO5palOGNQgjtMaFIoMORiX4UYyWsgQVkB7gDw%0A%2FH8TdhsYCi06Z8LCj1XF4qkiTVseikyih3Ro9sypUUeln9QhNrEglpj12xrUcNZ3%0Arap4C4inie%2FMrxZ3IaEKP930QkaGWmP8IdQ3gykz8%2BWVBXwu1OyJdZERjbsoZVTy%0AiO1eE%2Fo2jSpol9KcBD0s9DobHWcFlDhzExdk%2BVb9pS%2F6a37lrQvj59bBQ2aVt41b%0AbTngwnCrMeOWYChecnu078YEeyRVlOItsB%2FTl5qbq4HyLPYfMj53nJtGh6IbDN%2BT%0ABgbKJbmrjpbiXUEWryNJYVNu%2FE1CS9X0AXb3or%2BBBzVqdwioO07m3GUYyMV2hlnm%0Akk0o6Qlxb1VR7CB3PuJOgeUK%2Fn3cqzZcG7q3EdYobjfkM1bGiuXpuIzkOPsD8Gbn%0ADYKjvLts0yO3CF4EdYEKBGnZ7Mo4IL4G0xZjAKqg6jVb9DhiWyVp5R3dcoOBZik2%0AqcQ3iY5cE40SddK0jQYgWRhPFyi9V8n0fElhef0OJL2jLKYRHbxpLM5lgKpnmH9Y%0A2ti%2Fv8l2n5z7wSVBIpHbpYq5LrRdlAwyvSITglf6IHFXiagyJTcL3mx7eJSfscQT%0AdH9RYoAO650vDfhXZd%2FrVgbZsUjr8vHf5SHIS16yZE2mXxIPSBpKJZpTMXJwc9h5%0AYAxwukFXP0k2SUZN%2FgoKg%2BQ7rtL5LbgmOAcPInVxQILv5HqSsgZFwunQ3v8TWtzx%0ARYmdHDGQSyfpAmOEJ5Kpnzqxon59tUdudNSgut9FL8SCy9nC0sB8SxPKO%2FqtLM5i%0A4n%2FPqMutwPsqTW4ugiFuBKvwDQbLhUtlr6BuVP61dhv970TBNZfrfO5mptxdxjey%0APrj%2BP6uKi6RODHHdE8jVvZSrxGRowBYyPN8GpY7pfchKdU27AfGP6p%2F95oboSnQN%0A2MTOmCYO%2BW2aaqVO7xaBHB6slY8OZ0a%2Bb9fk7w5m5zE28RfJIp%2FFNRZXzUmvR5Ek%0AXln%2Fx141yHEl9go1RnWX%2BKuRjptFPN293SXQZCubQqJ7MMAWixTGcyKb8L6V2KoZ%0AWMqzP54Ud%2F%2Bt3ddHC7BxSPkVAgDY%2FrWqu5kBJOTbuHFCrTTFPEQBEs4WZRfiR1FH%0AC%2BKZH3GWBoi6tVGVCVjapGQR9pwzTUpWQ9txN7XC3a9A%2FGUxCgCPDSDKPjjuoBwY%0AreJvP27UiyWnHR2QjcCXAC4lbAC41Gc7Q6ejTfd0HZ803V9bDTrcvsb933rM45%2B%2F%0AYM5mbp2VkugZbSQ9fTNXP%2FiSsZRjhk96I38n%2Fw2ZH0np6m5YcfCdj%2Bd15tYQKe9M%0AyjqTsaxEvncLT9M9RcRgzgnq8gmetEf4ntUC0P6dk4TcSfhqCfg03KgixRNqJEOk%0AYTR7t%2F%2BiV7efS42ppR1XwJXAOVy7S8EGY5iKnoJtxSKMgcWBKUng9v7cPLvuJJ7M%0A%2Fw379Bo4%2BpgXtRJKEQX5wBwbs%2F%2BV67rZAppCJfyrA%2F0k3UwqF7s6%2F1wG%2FPHjpAlf%0AWco17A5UW%2F4PAL4ASUzhSijcdl4P%2FulalCyL7zz0CE9szDTxvGoQcUjyFz4X7k9d%0AQ4h6mFdJGXnAc6KxXUo8hgKzcoP1uUU%2Bb%2BZzMV7iaX6JIA1bq0l1wCqogF6A7Xqn%0AMXzZXfOO3k3w6FWqSIpSwGMo%2FZgdApvQdzsLdcI4WpKQYcvv1kkNQHJsMzp0Av3p%0Awf3e5Yi3cS9c6D68CPiinSKaz5Hh4TWhYdEogKehW4cBYchjst9Q5PpC4%2BlC4gRP%0AvBT5QW6i9XTDprdUhHZxeNtefsZz57kgJTr%2Fhaf1kbiH1ZTcGOsM1R%2FQtl2RB85n%0Ar0RNRxFC%2B6S0B6HbTQFjD0Kfy%2BcuYJY9%2FtvevLRLSlGFjqgOjJmBjr7fmUCCJSIP%0AZkp%2FLF7jBBt%2FtaoUjLNOGQfSYBot9Fhi6DMoQYQ4SJZL9FXpTA7SsugjSvULxXPh%0A6AAmevooajrYvrbQfTlZ1uKoUwZXb4%2Fz6iGgtDuXtilmx%2B04SO%2F7j507HDm4WooP%0AH191ZiH%2FPYEVt3BLERNzVqg5C1orr8yMpeuKvib6YQRk1heXiGPpJEWiSAHKYx5r%0ASkRtowOSymL4PfUdcUzeWtNp7kjpBDX548KWZbmROBM2326ecxKzr2UdaLcYi5Tg%0ABpmJhxP3pySowMOBQOg8Qgls6LJZwLePLBpDS6h6kI67pZlR2P%2BMVpzfN8G%2FDd77%0AG5yC0rMNGhCaLGAbNZYHhHq8z9EqoxCzvVKEyeqh9OTDGUmuytRLnKSijukxEuvy%0AGHXRpkO%2FJWTc0z6IgLh6uvGaHxcswLWd7%2B%2BPoUsU%2FWuFLyt0VtzcjkMFfriRhYWm%0AHmbSVDfZsz3JEJGPRFJb0eU4qgc0qj%2BzFmpSGSeDroZhwFBqVwu%2FXp%2F9dPYJRebd%0AlwFJ9fTjFJkkv%2BsWE17wAjRcHDqdbWk1%2BXjjZ1lnLRCPGLalK9IB%2FIATibk%2FmMe0%0AoQnVGuYABhvpa1CldSy8A907jt1grqx2foQfJLvCMUp0yCmTjdtO3b3fLwySrHh8%0AwuD4V2RxRjjjkzivPyBBA6Cr7rkwra%2F6MofokiUXFNrZZq8PQaoxifwcKMXmmqtA%0Agv18sY%2Bc7gCeQJcFz3VTLCrI22RYoKYuQHCZ0Pp8tQlAkMjcpkxfWR0tQLxpDNqe%0Ajvtqf3hNNW2qu5amEUGXs0Mq%2Bv5v6aRfr9Xy%2BLb0ZNhz8%2Bks7eAax%2B4IsaDbrGs7%0AeIzvp413pFwO%2FunARcBXn%2F%2FE9AVXWXARVqIWFHrYO%2FH2ll9GR0Pe%2FOAPwuEGG0QH%0A907r7dbHe%2FaWQw%2BmMdK5j53PbDYinm%2BFVcTEUklzJ5n1rc%2FvMIyqseGl6MoT%2BKXu%0AuBlSIedJ%2FnNwsu1Oa9l55lklFtV8bHOg5NPj530BIAC4tAnbRhdtoWa0O%2Bz8SYmc%0AdXUdf%2B2vF6BA%2F63YjinYUOX8PreIJVnD8qFpJCtBTT5HRBhaHYV5L6A60lq1%2B1Mh%0ANWmNckKVG6pZDZrNAYfkm0tdYJ8wJOR5XjAstbHFRwbRqWWNJU283v5wuZQtpMt2%0ANXWbUCjMVsO8IVh2VYwftrb1HV1mZYrN0%2BxdGc7mjPlHGU8G12ci4K0BqMqNv9Bq%0AXtu7RO3iZHNc1Ir2Xy9FJBd9ysr3SoZc6C0NmWzFOQ8oMKtg%2BC5HK6joO2Wced8v%0Ad16ghltn0WxLck8%2FloqUMaJZ58GCaJws%2Fxip45PQeWBAWJRvXlqWkQfdiPGp1G2I%0Act29btIAixOGMplReIuwPlCg7R5RaFn28Mt7QFk8NK2kVBd3pWzWtgodeGyo6jG5%0AZG8uZpg872hENmTZYKg4TQDdlCSzX%2FjEAX5VBPFTNUYKSw73%2FCAHZgtHWE%2F3Hdv9%0A5rSokViBqIOrmU5Xpy%2BDfOsRaMEkv%2BpSzElKU7wBY%2BVRDV%2FCBis7bOei70IBsaUw%0AwKfoz9NemxHR7gTi46l%2F5fBjWtubx8TO%2BbtZWd0845hvvSTroP5E0KtUWiqCwq9h%0AWV%2BkBlpu06aHue6abPcbQ2P%2BEXLEVg8r2SzKMq6br%2F3O3NF2uiUIygM6OV81yiqR%0Ad%2Fs7Op8dnVXlnQ5CYViOGMKjuFHReQNCeIUx2TDtlKm61F2%2FzMrqIOopJqbZrQrp%0ApeZNe0YSUlPGzxlAV9%2BlbACf3ZCO6pigogIdoGELUqg2aStQ8482FHupSeSubSD8%0AwIVVJC5bX%2FEB2xY2EImJ%2BqS%2Bv5VjGRTwcW8srEJL3qq2zgn3Llc%2B0k7nabjZTPVg%0AW%2BI9YphTDpfAvXE0rUAocquP2bxjHavW3J3tVLQ8HFCQxxcWFGg686JNDxVqleJ2%0AIBmraou9mLQMU33YLJP1Yc8gRvkOyhP9NkK52mvQDeshYkb7Q%2BmjGnHAD%2FMiAE5S%0ARncixlzbGkGWXFZ2Hk2NQqvWnflt98zU8RDHeqTGss6KL%2FeffmpM8gxK3WIvvnWW%0AfNHuSVUgYjEKhnuouaAY%2BKSjvUhxeF1l%2FeCHYcvtWABl%2B4Q6y4EhzGfubgqbcIav%0AVNF%2B2yF1q5m4c9stoYjzalg4oExlepAdzQ%3D%3D%0A%3DzHlX%0A-----END%20PGP%20MESSAGE-----&message_id=15f7f5f098d6bc36&senderEmail=&is_outgoing=___cu_false___"
      });
    }));

    ava.default(`decrypt - [gpgmail] encrypted utf8`, testWithBrowser('compatibility', async (t, browser) => {
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, {
        content: ["Prozent => %", "Scharf-S => ß", "Ue => Ü", "Ae => Ä"],
        encryption: 'encrypted',
        signature: 'not signed',
        params: "?account_email=flowcrypt.compatibility%40gmail.com&frame_id=frame_CdqnkNWgHP&message=-----BEGIN%20PGP%20MESSAGE-----%0A%0AhQIMA0taL%2FzmLZUBARAApSOEoWZSpvBNMFPgyhbnMd3Jdv2%2BsQRSs3iX28z6TsOp%0Axq7Gqm1xh%2F27EeJfisCZH9Af1aB9OSQXDzfZG9NqvXXQcsMsp6GcqyzUhxp33VDq%0A5xWRAoS8M4WvEMGOKx2q4ChoBhpl8wloDQtPtnk7cDv3YRgxF0JSkwTy%2F%2Bs6wAOJ%0AX%2FULyAayJ8MgETkRpFgzYpWaWTmrJsdsy91ASJAP%2BKujGn6BNss0LdufWrzOZmxw%0AJ3sX%2FSasurMwwaftRcQd9CVzckrAFeuwn4fCsr4kFdR%2BRDSM7GRPM5rxWnTiulgh%0A9SRTyekvJlpnwbn9K6qPO6oiXVDZmB5Gpl3OuBl5V%2FPazSHpm%2BzPzNxiwlQOobgN%0AP35PfbpJAi%2Fq%2BpSEra0dmU1Jtek7s%2FNh%2FsRebJEgAXwZvuUiTBu2zdIygW%2BItsaa%0AQqvffyZqcrY85Q0KF%2Bz5j7MOYXL0E3bkhEtpou0pjdOEJTsbNlAsFu64oxRjUjkD%0As%2Bfpgv3hnW%2BvYHQy98B1VEz1Q%2B2G3sxmArepnaD7Kylj6mNE%2FI2QPYCl%2FDqxBdZv%0A%2FSKL9D5t6DKqj0cu6TsitWNbT8SOq1oJP97ZUcr%2BNg9YHDYnb6v3mXdKZ2UxtqVG%0AmXzGU9rc2QW%2BltQINpj0uYzKNQiYxXnVaO0eYF4wJQ5EkJeixLltUQKSTlarQKOF%0AAgwDBlAx99b1mtYBD%2F9yAcmyrvlAGEvn5bScQXV0k4KY0n2gpXp6A81uyJAv4iFo%0AUye4LdRlZEdx9WOxpujfLCiGAKaN4tfDoDw4G%2FAlLelOwG87AcuK01EYQOmtVWmO%0A0jPkQJkmQe68Z68KRUlS7BpsLriC%2BfSjbT9wOlhVA6xaA0DQfig%2FhMkvZp%2FA2vCT%0Ax7OE49siG6lyWHhTQXEmXflGm23a3Eza1%2B16Ln8TDUEt3uFiPFAg8Wk4arb2NMth%0AlzPOvLtDjOmVjpbPDtGjmUeCjlt3m%2F3IB2HrII9KZrT%2FnXBb29XenXa4z3Rv8ziF%0AtBNWOXqKj4E0aYzXJKNDvGtK7Ddn4gMgdLfsSeJ4zL9vwam%2BL%2FJi7WPb3SGSew6H%0APKGnOJj2fBMXUnWxzLDf7KZs8Z6ON69P26kYrwd%2BMpL2hkhEi5fYkpHDam7vBUUb%0AYwBUpGF2Msx2YH7suCwaNVeXX%2FakNzeu6%2BxgyocPTDlIPN3C%2BJsZIeglw7lsWs%2Bn%0A3EcTvS%2FC6zIOLTH0fYAES5dzc1sSIYPJ%2BE86nhC8snxnSIsJyaB8OJxSfVUreMmO%0Aw1kiBdMuAtUPOUs3ME9Xaqic2zQrcX1G%2FKSNjsXCNEf%2Fj%2By%2FNpeVP8jtyGFmHdi2%0AIaBFez6rMOQWmEimThz8r7805jvfYHlCWRN1ADSvxtd6pjzUgrdnmGu8mqfZ39Lq%0AAT5PwLztaOjaI%2FhCOdPzjb7%2F5OLvAh8voc6EbEXEHRvg0Ut7viWnSlLw2VrgHXM4%0AuBEEMUtRTaFQr19FKyp698V%2BnMoi6i00aoxVYx5K0fhR28eTiyZFRAYLpo4jV4p7%0AG5wuS2Bl%2FetLDZ%2BKlWjN0OdZn13OIMV0hO12RibB7ixK0dR6aFxsrDvL05RIl6Cx%0A9oLaBTQs%2BQcHTGL88%2BJ0dxY9Q09%2FBkz8VJcIdM8BIJSPDj2Z97FsMPgo21NNR7EW%0AaKY%2F17%2FztFHXXsh4LPYxr8xe%2Fjz8i9PYPCo3VTe4E8lW7r0XbXCsinFtmouO%2FawX%0AZF0pgMCnSfT%2BFaji6THxfeMCQEXH%2FA7HLe32l7B%2Fnhl9q7Hb6vEIJrav7yfSSpp4%0AW9P0Qoz5xXRtphcqE78TXGNlMYGOZjZtMKk9qPeRAfBlf9o0B1TAPAVb%2FcaYbph6%0ACe%2Bd2mRPSHv%2FFZlHtk3aVhLbEVBdfbwculi8OY%2B13EiUuzGahrjWXJU8%2FVj38U8V%0AGt8glmUkshZDX%2B023YJ4e%2FBg3m1ClnavXnW%2BoKDsUfvHOjIBwH1PGjkhnaEqqXw4%0AhHM%2Bqn21KViyDemgxhiff9ruvNq0w0fWk%2BdD1bCuS9JJM3Lrgpq7EduBhP0924Dp%0AlQvDNHMOXqdm5x6cec4ZDJUJVKNt0RM2hi%2Bz1ZWuZKsNnm2WkV5VMjE5m4kVkLKW%0ARzJOpZ%2B8CzMi3oYO2R9BRYpcNjNETXN86mYaMJOBxXyUM1p%2BcNVtqjE2L7EMhy%2BR%0As6sKiDPX1VHX%2FUrIoBiscAJsROzFJ2DoLS21omL6V1opCp5yg66t9P4ksnZC%2FPTT%0A5jndqWbNFVzCsyaGjH9skHwHlFbgwnuonvhwShJIfjEnG9CIKUlsIsHIHxuUKO0j%0A4dmCmfpQVUYgWNsw6u6FZ4mXaTwx%2Bg8e5BjP0xW%2FvQkmsOltZnxt90zp8aujtGyH%0AM741rzKAp40wR7mmd8qiAim399yyLthNSrJOGI4LYbixIMEk0IdiU7BoHvOkNjqF%0AE6cZBgHIstClOz6rYIJmzMeJSD5knjHBO3O4OIlFOtOa47jOrU5yCV2MaUtLcI8A%0AS1YZ75bgznVQZEHS6qNH7lfuLw3DPm5otvYJQwX9Nf2EfNhdp4XKiSyN9GslzpxL%0AtR5FMA2%2B97MAC4rUg6IrEF%2FsvM0I307g%2FEKGCJp9K1MuuVmrUvOuRxDcbdzwTRMA%0AYs7Bjf9jasO1gw9CXE%2FoWPQCERlZMse%2B39DmJkfWpc3jxYLo29OqwKNzyjohr97z%0A%2FffM98dwmkLJYr8Hh%2FSVlKrvq98kA400%2F%2FYo9ZhOqvXhxAC51dn7IdlPL0hrRVE2%0A7E4cHZQ6k5RBi6mRs1v6s47qgUekQAFfhOwNUECvKzuKBFYDtUpwgS32RkytdcRf%0AMwhqau0F5rbghdWpJCY9vffiw3qpTh3q2bMVm0ZRR2SCUtJ9L%2BRC78PStbNu9xr2%0AnvCgqyXJUl0p5%2FQbqLUdtLr5ZRsOsPnKo3Cqmedpkv9p75Uda0VASisOVf64Fc35%0AMa7MzfqLTrPSQSpNfLLc%0A%3DoKrd%0A-----END%20PGP%20MESSAGE-----&message_id=15f7f5f098d6bc36&senderEmail=&is_outgoing=___cu_false___"
      });
    }));

    ava.default(`decrypt - [enigmail] encrypted utf8`, testWithBrowser('compatibility', async (t, browser) => {
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, {
        content: ["TEST, ПРОВЕРКА", "C увaжeниeм, Пaвлoвcкий Poмaн Oлeгoвич."],
        encryption: 'encrypted',
        signature: 'not signed',
        quoted: true,
        params: "?frameId=none&message=-----BEGIN%20PGP%20MESSAGE-----%0A%0AhQIMA0taL%2FzmLZUBAQ%2F6A7g5vt9ji%2Fp17TEtJ%2BN0SLKj3%2FSVCBGsUB1OPoG5jXKd%0AURfKPDZ1wwlANopiaqnPOFmXQa3mfLnonvoHlR4oK7LBBJnqxaDR%2B1apxXeKJd9M%0A9zb1QTHmGioOGegJicc9b%2FOtL%2BXK%2BkB8kby0%2FyYVWItwghf32VjFB76UVfTnMvh5%0AI%2F%2B04zxLJ8yelt9m2c6TEpjP8lYjn58ODQgdXr7oYGfqNro9uNKDFJf9mwog7W3L%0AGaA1fGePWvaTnwpu9UZ72qsRn8ON8vmI27gqP%2ByW1drlUYl0gPjhlWy9xR6L1ri1%0AkOD56gLhL%2Biy97Eaer6jTKtuy93esvehKqRldBmIB%2BisQFTR1TV8Ugf3EzTlTW5Q%0A0jWgx9%2Bgl98B%2Bk5Tzh8VoCok%2BXaQxfkKK71LEqNTtAjFIHpzEz1QfSWP49kYBMiZ%0AQ8H39NKYPjLc8vfOWgdDkK4twNUApbjC6plIa1hfQoiktFNN7iRNp0sDiSh2BY3v%0AkDima3Pl1IBlLSZyjZRVlslebzxtXorJSgDHdoZLiyPLDEuzuAHT5vD32HUmBVBM%0AjsB0N2NlvPu9AIZvLtYbSeviTDxri5biy1n7gBNaO6udql%2FF0HObIinm6W%2FAdK%2BJ%0Anh8zmW%2BWEh8xJiTuocrmCIobq7%2BNydhAONV406X5%2BvLWNbEq4NOp%2FgO83vrPeFaF%0AAgwDuL%2Bybr9GbWQBD%2F9eWIom%2BopCTOYs3emdQtp3SzJgTGgYecUpdc09vrZRGDl5%0AUDozj7xeulXkT6A7hJlg7se505CYEtZNGdoZVBHKQxQsqyDBXVReNDS%2FDOf1BIP3%0A5gUIm9SDOFc2sro7U74HThSPePFPslIcl9WCF7%2FZbhwIQ%2FX1gk7EbdREct7f1nxh%0AEsH9EldrNFT79Lt6gZZ5jmeE2YdgSCuFof64cImReMU%2Fs8y5JI6x65IEwxTNHiPG%0AJw%2FR85Bh3bl0N8VlxJKgBW0ZNyJiF8%2F7JuBvsZ3u8Sh9jH9qSE0f%2FIXYvZEfMm00%0AHzMax7jF%2Fvc%2FtW8rTfZzHLxgYCJaIJHAeqnksmf2mfgiiCryVU%2BkOYMNOVYv4PYn%0AEaQLX%2FY34DkoeFDQJnCnC2Vny9CGW6qz1UuaCKes%2FnbQr8sphpfvF7%2BO1dVFqib1%0ASz25tTWQqfnVqoiZaVnQp9RbRN2LlQ6j6YmVap8hLMXPtu2enIvraH9tSKkEiZu1%0A4615OybnIVhYjPSgzrZjihYz8hgxl9EznCKnJ%2BvDTUMl4sxxBnwF%2Br4rDtAs%2F%2FWU%0AeG7QfruTyLZ%2F40tTg16WdrjK4AWHwcQNuf%2Fy22YHP13G3OuhWaFLYLqpgwO5CwF%2B%0AlkROtXdIZcmD8dV%2FjFy%2FmurMIulyRCAHKDGUJcjklA03CW%2FUTe1A%2FX5sIA5GLdLs%0AAXfkl1lNVHQFyGoVqSXW0zUKIi53EkUAC3fbEIK%2B4ljf3Owj9I4M14YbF62Dn1fz%0Amk6KGPOyApO8jH3q5pST2cWGnlAl2Jrwmm2mMPtYKWMSbIHaufMDX68suWS1ZN3%2B%0A1t9LehxG9ruTCrg80t1H9Llaz4rHpho9vXOmIFxPHmREN%2Bqo6dq0cwVb5TkLAalT%0AU795tmmmiI4n%2BSQA8ouPbu%2FvndFQGX1IJC6Z1bln2h%2BxS2HXzS8WT17sWxGKZYiq%0AviL%2B85QMH5oM7mQGW2g%2Bm6LxmAibjmcvYIEPcsOJp5WBMtv%2B6U0%2FHMXJkLWS4NTU%0Ag2beKjmRI9wyT0THkQEBWJ0lcY1Cmbv3k1y7TuhO80FSBh6MUlfFKROsbbgJ50G1%0Ak6%2BuCw2UOH3xWivj30%2FvBU73f%2BFLt99fX8l2xfIxRut3ud68tjVYEtq7j2m5iJ4E%0AZmZdjPbfWa8zpJrSiL%2BTmJUTtrIzp3vuD2YI%2FvZ70%2Btw%2FciRUnCk8%2BvsNz%2FLKG8m%0AwKz9nmnc4qWmRGk3TqEjC47o3N9r0LLTnYh5npena0ns0AIX33w45afjkb0Q8Csb%0ABwzuedgOjruUvOacUo07mNrgjUVDmsGOZJLuQA4KpYA9o2obZw4FhGXrdMgYmp4p%0AnDfTr9nPasfg7Lw%2Bqn%2Fxkwcpc090BBJA%2FAzuCrzYtiKTEH%2B7FojBR6AUaOfsJSvb%0AVvYv8N3TikqYT2gTkQgrwd%2FFtCSkGU4%2FrCIPQzcNdNauL%2BwvayAFVSJE1l0AClRh%0Am1%2FUNvvJ%2BkzSyuRTjWZUHZ10O%2FXdldtLbw5FERuLTI%2BNV2ju1Uh%2Byb%2BPBT3W%2BWZP%0A0kcDFr9MFu0Nz1xg3H9ur1dU%2BQaNIR0vhEvCbQwsthddIu0irX38Gp%2FKbL1f0LhG%0AW%2FCizRuU3IHcnE6FGqAirbMU3M0z0bF7uf10bdCx7Q5obEr6UcvHZbWEp0zuHSzo%0AVl7MxnEJOZaqs79faTP2N3ZXPruZK5O%2FU8s%2FFvm0QOAhnNMGzCRw3tKOPFJYi%2BoG%0A2jpflyaA7PW5aPHRMZjXPqN9pcVNr%2BoCECNFNn1btBCLlqQj4aJ60XQPZPKq4lH9%0AEicKmhnU25%2FP9U7hWpLjSVqnGtJWLsJUqyw%2BQnLh75Zt%2Ba%2BU16q6G9MaYIB2bEkp%0AjLPtUxA0RYVfXn9dvwrq6rLGRXo6dg5VckRkAVN%2FDxi5ZSFfhw%2FpmLRwD%2BwTAQ2W%0ACmRkoMwEpvSAB1trZeZ0iKTP7vl%2FwL5daCgg%2FmpqEj5Fsl3ufXZcWrA%2BqqgTKiK%2B%0AKshS5ZFnPnkC6SWB7XERizeKUDx8V%2BXMGD%2F74FBXlCzw0%2F7wLU2Wal5eRRSaKeCf%0AM7emi7iWR7X0pBQoQCHK6SD7pQsRNowjC54zFmksNM0u9tcwQmOR7hwn65nKmMbR%0AIV2DLHuwb%2FC5%2FYCqgNScENvnq5WRO5TWUKdc5vhpDd%2FuLsrSKB8DgqwTnwKxLiyR%0A7Z8abUs2mdoaEBSFQj4MmZHP87vk7wm8MDkZ%2BZ8yC5PNC9aEqFvNVavoTvfSzO%2B8%0AHIjKrCqZ56QnEFlM2qCfERERzvlVV%2FWYaj95KEV9N2neJrCh8kpwHmaBis21I6KJ%0ApZsbQV9YKEj2sEBtndETXWr9dsaNzy%2BlaUUnRzbrH7OcOq1JQ0GxW4sGHmoky0GE%0Amnuo%2FYTBLzPqhTrnAWaSMoRhUDlQbHdz8lyNyQEmSNAEbmB8zfIzV9Qw31NIa6Qz%0AFISoYR1Teo%2BkbXRvABGqvlaD0VnS2gdgSoCW92PvEwgBvfdKNmOan80PELFaqujG%0Ah76Rt08g0UGcP%2BGnU0iCydjbmTOtXBypFOpXQh7phd0RlknlLhro7fhMlNtHO6Jf%0A6o2y0zcEEu2CzmNiNS7G4k4Op0o8txZjBfCRk0JRmzl8IBiWEk1eaUs11AHlVun2%0AhP9iVyF1PAaD%2Fx2siEi7Y6P%2BMUmLIpZUHQtSartAIsudhqtkbyh9rTWT4N%2B1ya8o%0AQha9O409HLCdVk1J%2BDj9RMDhw4o5oVZ0HryHvw29l%2F7CUe34%2FwRz0fp%2F97Slryc2%0AV85wzRiUEjWNDqOlrgruShywik1i1YDK0ZoUDy2V5otgrWRN%2BFnV1ezbbkp8V4cZ%0AlOPbnRTr0QQQcoHyb5lHolRlhhjHNy8FwEi5y7rtYued1lBBc3tjiNt1AW2QrqH2%0A3QHCaURQVknS%2BW3kvUlfFBSkWHVXeuL2MtKZ204%2Bjyk7t4hz5zJI7P0ZMsITPCfZ%0AVgl7VTEYyTBVDI13T5bAxXzyBLafc7KOqWmo7Rmwhh5ksomEKA3s98CbSATcRem7%0AH%2Fd0CWpBIWYDQh6GhQUwAfqoqFMb%2B2paJoySD3I7oukQ7Mjf61N9ZUsvb85xfDog%0A6E0X7ocyPMsOOJuZUT%2BIO13WDxIOAIedJ9AZ1%2BdqQSDSdYd3R7bfBJaJ831ESR80%0APer2RlkOm5KwHmPBj%2Biby2qX1NFtfUwFaIiZvilDipiwO3vdiQN8tqwCQGUXUwc%2F%0AcgjIUfwsQIZID%2FC05aFh4TOHpxEHGh1zihw%2FjOKmgntZAM5BBxFKRoLRb%2FizmxXg%0A7WpnPwYPqh3NZogB%2FLzT1v4Gn4LfDXB49%2F%2BPpWiymqyitepjfCCLI4Iezgpz4DNI%0AftIp71gI0GCEHH2ZV2fWkZtiMmCuX4BRq2Ck4E4d55AUamlj0Op%2FH%2FzyJeacIZzr%0AgMk4geKO51112xGw5hCWF0VRu0HyoqH44foOsB7JDth2k8WoS%2Fz4aWXGi12aT036%0Agtpqww3ZDXjb9mW5QdsRQ%2F00Hye1%2F4iCEJ97rB2K2XrWBDqz2AZQDC9uXfdyOFDx%0AMGTqwdcQCN8vDtIDOZGXoIj39HKD0KjCwNxzFMbdQngo5y9cBXrBhA%2BAyKOQCNoW%0A1Hq7OROolPfreqheIIqv2zZKNBzkJysEuJbMgHgPJKreBJa%2F7mK6yORaS91OofM6%0AzUOingcNjR0QmLWdxPX9PcoIHsIpQPA8k8KEe%2FtIWhQSciy1ZyyqWrL9Pt8LeupB%0A%2BZo%2BASgwoPSuQpIKdBOcnmqZfm%2FR0V6caQ2f80bIKwafA%2B7KgAiYmi0URiraITSk%0AzAV6BR44Ijn6dBR4MJFrxY3VWXwaJr07EfGuOkkY7YMndQNovHtlZNWtFPmH6kBh%0ATHBhNuHRdpL3Z31gYSEv4bKaXjfkXzG5fotUL5wDUTnit9jtAzgr%2Fk3i1JlGAHmp%0A0AQQquEQQf8aKY0gCLxB13t6jhOSGAriMAm%2B5BYkEIPTditnK7vCG1y4%2BhO7sHYL%0AXKKkm4yoOart3%2FUUtjZSxrIjz97Hd61V7He85zbFmevanXQ7BLBU%2BAh7ppyK4iMV%0A2vWcZGMsU11iO%2FSfsbuqotZYQLQtacpTP7IYtNflWevS%2BPILb%2Fh13DmL3OW%2B9ebS%0ArwRsP59hNFLesJKVh%2FPWa1Orz3rybOhskM4T%2F7jT9OH2DyGgaMnGEL9EISkZ5m9q%0ANTVD%2BHmejta1yf%2F3AMhgYS2rzGqJrjBIfY%2BxciOERaTmV4o8x8ranri%2FsUPEDdUr%0Azk%2BcnTsfvurwjZNyrfRpB5Jcg7v%2FTtAkmftCQKZWPXCQFLwAO9HsLLaQ5PsVPZ6O%0A8OKXKqrARyhuH90OB%2FaeRBqZeisfMpF3CgP1%2BhUksncMGmufhDtTW%2Fs%2FZyIpKN1E%0A87Rd34EG8%2BzcIm7YtlEqJjJKsxohfm4bx6OqGbaUVrOijqK0G43ZWdXZtF1%2Bm4n4%0Ab9NZWbG8l46%2FIRg0LrlNAaNwyJVcmzLhF0DOv1J8%2FmrVs7fXJWKgRw6u5BlxmvC7%0A0zJsarwyqQNhcINF%2B2sxoVNMi0stcN3h6cUlamfX8Q%2FrrRxJLIkU1GzTr1JtEQzf%0AUHxL2%2Bl%2BcTiYTKOFU%2Bi5pIPLo3K0eH%2BWdiG4n1juUUN9ufhAzw1j1eDyxZ8PmKbM%0AmHIpZrao8r1lghni8eFTJwnh8K0KLQcp2DEYGHa%2Fx%2BqzZOZWWrgQTwFRZ4wdp2DH%0AsM5XX9MGu5wl1HGF3bzKNQC%2FSoyWFsrpCESFdTOOMAjBC0BL1Ap6pLtk2AsMlnWT%0APoxmlZ%2FbejCkLRDCJMgcDKXJL1uHf16cjyjTbstDPDNxzcVMISsfBxuYhcPDICse%0A%2BXJ4rxQL8CWym05JEG9OspenjHuuDK07mLNkyDcv0jruFhy%2FVftJnGnmwheMGk2b%0ASFC2LMqYEduYIlc5vSQYajFZnWjzOtxh6CmCDyKPDhhP3jbFEKJix0m8jeFlxlmO%0AqsXNVAO75FKZxTqpBxPpiN3%2BLj7Aa9k2JPGZ0BCT5TdqxLmIUzyKWyIVB7D%2Fg1c%2F%0Aa7qLLtVhwQV3l0ckc7txHVXXMPyhvJK%2FTC3E8Qnmhwb9t0AjdcQpW0mhdQqB6d4I%0A6NfoWETjuyxiCxnJGdng1%2FJhxlRAkGnyOcuWIycv14nfXyyZTR3WGsiCNrv8mrLB%0AdYRi9jMBH%2FSNh7wO4xxYJL5Izpa9uCGPBJCER6LadV%2FrjWn0LOPSq1HT2ZqzgZGQ%0ANtZBuQu%2FB714SU3M8yL1ySEPAqmwAtvke6y4oMdJogSSUMiYGNj8w1SnC58Kin5j%0A3NT%2B%2F1O58EbZ7u%2FkaubgmgQx6kMs7aRO9Ri7Lcalgt%2BA6FkAeCnyiuQ2xbehX2oz%0APZ%2F6DIejX5dQ362rFD1RMemLhi7bh5mIoyQgDz5DziVj4SFIioNv5%2Bn6Im6A3iYb%0A8xsgxlKBOb2REdric6RfUPuIX8tq7yhTGVH7a%2FIXLxhaJHUYJQUQVmhQmLVaQvB4%0Au8zpwVmdr0YJ6B8IaguDwoF7Zr5m3fUVZH8%2Fu%2BqVE%2Bhn8XGzWNcxuUwbU8aNE4G9%0AdAKZ%2FTxCrh%2BBibsTA7LkT%2BODaL3T4inJYrF0xcJa8h1SSot47mc74Ixz6iUoZIeX%0AJIRbI9wcwoJflQvSOy55vHEGBVcYoowab8V1WY4%2BPmQfpZKkSqPuhqToq7PvpSpR%0ARGeHL1v1H3f5sQIbZCKf7a%2BCvoWwcEdsLhKU8mVyrDhLbVj6kLy%2Bi3xADBLZ0y68%0A9kMdegb4bppAMJnFLgHvogqMKrXRTzRLGC09cllK90i4Gp05ez%2FacciXD3oVecvo%0A0icQ7fz3sjpqhghxotS7WqXHYJuogXdeFjSUFKg2biMRPZNEhtoN2ybgpZcWL5Yi%0AeTFzCvIP0JA7U3eMuBpFbZr6hEzzFbqoPcS%2FeOks1h9NiMLggLcZUWrrb5ZSs05I%0AKgKFNLqkQNTeK0r2X%2FP03qFb7YD4Sb%2FQxGqZaan0cNj8mL5BclwBZKM3QouEsbeN%0AqUQ0mdPf7dqRu7KO7rCQFYWYU7nIDOrsppbJ8m4r2sOKXP%2F7YSxoiK5gtX9lTDpy%0AlUGmkR1P3yuSupp0%2FI%2FfPdRQZmVV6yizFNPluDkWC83TTjk39Wd44QV2ZFwAGI2x%0ARn3%2BTZoxunxYWPaOy8wbMiO0i9OIAxAPVnGFjQB4W3eJLVdkwjBGujdX%2Fk1MsbtG%0Al75lW5HAbn5EGvmyRoS4O3J7LF7MFiVxEWbqnbG532w8Z%2FIJYJ2Dc42q8nR2p2dQ%0AlxQ8%2FI4I166THh%2BTmUYA%2B6wi8UeTBtHx69fYK3Xt8x2ZJQh%2BfjWGGeVNRyLX6j1j%0AIjMzsER%2FLiih91BqkekWCC1eRmPJkC2AZVaWlWbutZgbZlM%3D%0A%3DV3XT%0A-----END%20PGP%20MESSAGE-----&account_email=flowcrypt.compatibility%40gmail.com&senderEmail=none@flowcrypt.com"
      });
    }));

    ava.default(`decrypt - [enigmail] encrypted pgp/mime`, testWithBrowser('compatibility', async (t, browser) => {
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, {
        content: ["This is an encrypted message.", "Not much going on here."],
        encryption: 'encrypted',
        signature: 'not signed',
        params: "?account_email=flowcrypt.compatibility%40gmail.com&frame_id=frame_tGCJGTMBdi&message=-----BEGIN%20PGP%20MESSAGE-----%0AVersion%3A%20GnuPG%20v2%0A%0AhQIMA0taL%2FzmLZUBARAAmSfoaXFbA0tv0ulFxViTwrDVcbPHaPQxx3vaX2cHLABe%0AKS2P2wOekq%2B8qD%2F72MMWMU%2Bvx1fbVu%2B0MDkAEcygCP1o54mIR8vYGkpL70JaLyMF%0A0jqy8LKfheJO5o%2BdBYMv3rk55%2FQlMgrKSrXUmGr%2FEAM6kLh6UwWS%2FK00TFrwmPAx%0A2c4ngRQLqyHyg9DOLL8x2SkBoPYLHTycKY1oM1CgdwcNqjy5RXDwrN44Ws8HRX57%0APKLgrAM%2BvUv58bThYT2oS1L2l7rIq8S0n2eFI21HHUQFDA3rBJJyvmhV4JAy9BLi%0AUYqmBDjvMtdfn9iBkFhzapORqigAUds4aTiBnwWijgfuzilXq97OTmb%2FHNVvPd0A%0AsXY8u1c6snBqu9vuspu%2F2qXPLYh06H1aQlMP11q%2FhWVfVLnj8vFmYpwQREVe8cXd%0AKVWN8%2BhYiqKoSmu5nKbqwXMqeHjS9L%2BEGZMyiRlSwImUq%2BB9gGMcTBFR2EC%2BOD3U%0AweWhseK9jIOio0otF1EF4pV%2F%2BVUU2gPCZhUrytGItwfcDxyo2DPWUun2SA9EDH3%2F%0ApGf6ODUwCb67gNDDFoR%2BY%2BWxfGCKK1CSPAEHHnKXTUP1483IzUHWxP6R0%2BxhgypQ%0A%2FufEhXOVwEjdV%2BCTMlENeSNpQdNt1tyy2TMhlNd1A0dnRMivvgVpqk2hHH38iGeF%0AAgwDluAOlKXQo5sBD%2FwLeNZiKJznLa65VNzJot28Tc7BOZQyfmtbjF9H46RRB8a8%0AICqu78K8Paf9QBP%2F%2FWcPL0RFvWf42k4fZ3dy3DgPcwZourYKJpvFkdaiIuFQ1ua7%0AIgH6sJjTrv%2BbsBbCNloFTMgljBldmiSXSZPdOjf%2FAt8EU%2FG44Iu9NWzuowMDgXiZ%0AUfTUm3RXdWYYi84WlL1oMWdMTrHmvpd3s1yat4Y7yaBGrlxr0Vep6hmUAXtDqEep%0AcjPr%2BBl0tzXC9XJ9RJsAp03pDwEkfXiSfIQB9yorGF46XOT%2BdRnicwk7HgUQIkw1%0AbP3xsOFpP4R8xda3QZ0ySDmn3E4bAc9T6Lu0qKEBr6cECgZXp7NfJxpjoQbnHxd1%0AqS0FXmbTuHWagJbESHqXtrBBz6Ug%2BFoVh4fuxy5%2Fu3QFMaVFRoAyA3PbUTbOfiJa%0APMiW1nTJG7ofspKgmsg%2BxFqg9%2FdLepgBw2QU0azsbXPmmSXGJEwlzrrvkKz1EiK4%0A%2Fp3r5Agj7S4jXSUsDEhWFmrmqXmj5Sv3EcC2Jew%2FzykWG5NOMxuq4mPTWx1cK1Pu%0AP1eBnzXlHMZWNBvn6lDwPv1CyS%2BT5SrTjxuFmJYs6sPGioVIT%2FiVmAVgh7ctqV2a%0A3daPU5bLEVVH2m4mcMwULbQ9%2BVc1lIbuG5PlJvAYuRTy3QEsGs2VFd2t8lG%2BENLB%0ABgG6E8Ln3ziqECqQZV4WLTn5fRGttKuA3%2F%2BosQBC55%2BtcPsKk6j2J4pxaU8KwK4z%0AT40MKFRpBTNXZQOEWEvNngv3RsM3dp6FvVWgUoUhu6340H7OqASuKd9QoiqIZjXz%0A4O7%2BqVzjpJykiJyXoJDTXBCF9BO9SvxADG9IDTUsJ1iFYRDkWH3jjf29E3l47zru%0A4PFnKMQsDRT9UrtAjNR%2BHD1AZakZczhljcRql83rG7hDSOjBwUML%2FckpJ3HA4wx2%0AbeAN4y8ywJPHWbZxcT%2FwZlLZzIn%2F1us%2FQhYtIfU8%2FhPaU0N49oMVy6SU64KA4rgT%0AjUVhUoBIQ3ivi6hs0GAUAapcwdulEcuvQEJ1JbPXMst6aU5H73MbhjYTNduK3QZc%0AXpokQN8AZYL9pqbUcViMLWBqznuF%2BbOIMKNftEoj9MVPbHVKvHIZZQrKVZb7UMcl%0ATcSsI0Jm%2B5fWkdrHkI51YxcrVapNkT%2BpGo%2BMBzTVtw7oZ844eVYUnF44AjaDEr8x%0AR3lQ%2FHSh4Hy6ibRJ0ZGQZsbAg1SLAg%2Bhg8hzg1uuy9E0MDaI15mdz7FrsIwbbi8O%0AuRTWDQgLQtxCY45xvSmVJqangIg8pkQ%3D%0A%3Dv6vs%0A-----END%20PGP%20MESSAGE-----&message_id=15f7fcace2d72246&senderEmail=&is_outgoing=___cu_false"
      });
    }));

    ava.default(`decrypt - [enigmail] encrypted inline`, testWithBrowser('compatibility', async (t, browser) => {
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, {
        content: ["This is inline-encrypted message from Enigmail.", "Yay."],
        encryption: 'encrypted',
        signature: 'not signed',
        params: "?account_email=flowcrypt.compatibility%40gmail.com&frame_id=frame_vCSPFGeIod&message=-----BEGIN%20PGP%20MESSAGE-----%0ACharset%3A%20utf-8%0AVersion%3A%20GnuPG%20v2%0A%0AhQIMA0taL%2FzmLZUBAQ%2F%2FRO4wLVr52Zf0v6%2Ffa19%2FnoJFsFLIEqsWkX3OPOZfiRew%0AtcI17dq5u854lbuXwSELEAUkhX0NJ2ZM%2BjNPRyW4dqhcuFBebBXN10%2FpzBaG%2BnKi%0ACK3B4mAhqYeFAzVeInFS9MPbp1%2BXzcyPm%2FkPs2oxISk4CUGaFClSTGFUdRjdwVyt%0A06BEVx4o0dvu0em5O4sbmAqAictL9Kc7c%2BBYRmvIBBat2xkJtoOix3HmJBcNR0w3%0AAQxoB1pKkbzqOtweOhcP9opSvO8GXx%2B9vXzSi88PJ4uMKOSFUbtKGavMyXYkKpIs%0AN%2FhYiK4L0B8%2FqcJS6LsM26o0kZsVMg9pz%2BBK3ZspAyq3QnMRGaVezzrA%2BeA2%2FGz8%0Aou5CU0tBXMLbuBPj8qWBBgaDJzWBJyQ9VRNwx1OE4yWN%2BR%2F5H38fy6Z%2FBj8NiueW%0AbSVVhXVdwPzYoG6Wg06CUS%2FuyjTUtUkGGy7noii610XLsOhfOcsBcYOEwFuQ9FYn%0An9x2qMfo71cuWwtDcxdUBfGsoZzJkn1auD6XfHrJY5fux0Ji%2Bav%2BnkWtgRsu2%2FJe%0ABEFikuBYFZxjWOiArGGybznVZXE8m8ogZWYMlyQYybShs%2Bctp%2B4Wx5oNWBP4E0Jb%0AT3qW6GXSreP%2FECfZNUggPgONUYm8YKTZoWgwL%2BsxyDlL6snZMidP4FrC35BnvQ%2BF%0AAgwDluAOlKXQo5sBD%2F9h6N4KWlL41e0jHJX%2F2KbPXg1%2FcU%2FW4urdFxmx%2FHu1y9Y%2F%0AJ9VKYxne3HwJb9BxNu6g1QJirGSL%2BN4dH%2FbaR9Bl01uPdR6KZg06lygWeVRIMPO%2B%0A2ytla9Gx9lv%2BG8bXM1adNVbCeRX%2FILvU13SM4rO2eHvZodBQ%2FYyaQfUOc59idNHx%0AaXSDT19%2FiBVB67Xxq%2Ft4J5n8xWt0b0gB6pEzADnJ92iK1so7iviSxWbn0ld4E9jf%0AczalFCZBb2Hlqlt7qUyOQvqPIw5YR5R24o4TFdtq8DzjLdNfaz8eIlHjuh%2Frvprq%0AxBhdqgWFMc2V8bOPIkQSmYfVQXPLWflnWV0MHuoo7RgW33xD2ASPKHpUX1br65C4%0Ahsq1e3R32tXcOO%2Fbh9SoJKj7vL%2BNP61QYkarmh30yh5YxNcJV33lkmZ%2F4AvF8fRa%0AeeTQdHKdvJtgmMgWuRSeR1zKSIadvylGZotqTI662pfm%2FzGjdVj8gJWvcN4XnAqI%0Aktg3mpI8mRS6yzDLcbWI%2BqFkcAkBfkK3HTw9Kqj596jQuWbd08ORm6NxH2L47BZE%0AfV4OiTm5mJFn2eRakrS9UmYhVkvL9jITXwhqMy1Mj72qxZVnx4PSnn8wgMt0Jd04%0A36QKwsmsl4oaxBAt95QQVu5a3UQa8P%2F2vTdinKaLV9voQdFW5lcOUPVO955ms9Jw%0AARLIm29ptBkVK6N3fquEQQtssR4Zt97HK4O7l%2FYilRa5m9iQFaPIqasHHJaVxhKM%0AZk3zfTTNR8t3%2FmoaSbo45bXQk4Vgmux1ATrNcKjyIRiNqPRz2tbJIc2H05naijsb%0AyTu3s7CnSECMWF283s2Dtg%3D%3D%0A%3Dl3WP%0A-----END%20PGP%20MESSAGE-----&message_id=15f7fcb7fabc7511&senderEmail=&is_outgoing=___cu_false___"
      });
    }));

    ava.default(`decrypt - [enigmail] encrypted+signed inline`, testWithBrowser('compatibility', async (t, browser) => {
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, {
        content: ["This message is both encrypted + signed."],
        encryption: 'encrypted',
        signature: 'COULD NOT VERIFY SIGNATURE: MISSING PUBKEY, MISSING SENDER INFO',
        params: "?account_email=flowcrypt.compatibility%40gmail.com&frame_id=frame_NYYEYtuCVf&message=-----BEGIN%20PGP%20MESSAGE-----%0ACharset%3A%20utf-8%0AVersion%3A%20GnuPG%20v2%0A%0AhQIMA0taL%2FzmLZUBAQ%2F9FX0uRThi4ZT1KmNEZYS3WC%2BNoqommn5szVhI72E03HUp%0A3JMub2XMmU80Oe6WybHancEZw3w%2FoWR5CvdQx9414jub4uXxaE91wBuqlS3Ow6%2Fo%0AXfXZAzT0aEz7jXkh9rAZDzKjwqJjD%2FUICHmZsgVsx1%2FZZBYNBpbh2esDFGcCE%2Bn0%0Ahgd5%2BekbNqXU1ByU0eZRMo30u3hw4RAp3dPcfIJO3mTNUTXbAunHztbvGFk1TI2s%0AaSxvJQ%2FQNt4IRMaVG7pl%2BGwc28ymWbNOv9vVQQB80TJt5x7xJ8S6MitoAzTZ0KTa%0Awj2BQ9JPO1fgxTw7Zehab5UhQLJXsofe0WnU7XIxzFYyZdZSGNq6u%2BcI%2BDfUH836%0AUDYyEOhlIOyYf8SCd7B3AT7Wd4%2F5c333EC%2FWnG7W7f8RsdWAQtf8E6iWEDgnGmvu%0A2trxHZdTIOhEqwgwPWkVX0UjBdJ7U8nBhP%2B%2Fcsn2h6bpxOARFpXOwgmlmjjA%2FQQL%0ARgaK0TCy7JcnQ%2Ft9SCGw62YYQsgF8RCUPvmz%2BKpZV%2B9ckwOlj8vN75sxFtitd%2FHq%0AhSVMUeIsgBGvo%2BOxFA%2BNFLQTxd8T9hUNpU2Y7RWv0GLqgQtj6GE7ykh4I4dcb%2Fgf%0AIApF4XKnzGlOIoHNUf9tOnY8JV%2BTLbQl3hnRX64QCNimglagQ0yxe3p5jzX1uImF%0AAgwDluAOlKXQo5sBEACU3rx6u9Xh%2B61DcpUHMxgQ43KqEXWwMpzk8YudWrmNKL23%0Aa65%2FOYpyCBsL%2FD0%2BbVKvLMhmyfaz09M3q5lh86oNrvHHFsbDOKzHlAeBF9x8%2BHOR%0ALANj0TCttNR08e4i3HPbUT6uK%2FfKlHbqA6%2BiKgbBafbdHJreXtKKS7g9erEYgBYe%0AEg14s7X8q%2BnHXZ5sS8%2FptWUh3CoVtRgBsYe6AgH%2B6uDvtQWu%2Bm3NRZZrTBUj94%2Fv%0ABlkAV6ptRbTsBWQJZjRaKGQuN115WBrKAoPzIXoIk%2F3LJSe1zZU9kpmdJ4wrawsE%0AwcMRJSjYWR2mjpIKZZa2UEMaHSNKD0tfMYnt2etvmDrrt1eLMfzd8Nz2Z4rj77c9%0ArfI8nQgTmX5EaHJQ0PcJ0H0Jn514gz3wOh1B8zCD34KlS%2FwRl4v2bc7ModN0pTUI%0AeohNA4j%2B9GamJNoMPbLGi7o0JqagLTPiF4JuuEmV0Mu%2FpjWKiik%2BSi6HIddXsP4s%0AWbPfIVweOhCKfkN161TwSw%2B1cdHOw%2BD%2BPAxMOCpSDU8GOV94uoTL0JtJEdAaZHsj%0AZZbMGC%2BzATIKxpoXIONr5Qwy50hHf%2BnZRQfvfn8il%2FF0Noyg08pMafZmAUjWQgSm%0Au9bE3NkTF7FXYrJ%2BX2687i%2F1KJ7UrjhJQFcz1%2B0wbRmmSmJlqqw7AJKxzO7wRNLp%0AAZlYT2fl7jLUvnq%2FKeEhpU%2FHIQ8kiHC31J8%2FSYBvt1s4%2F%2F0%2BcykA8bKEC43VKZ3R%0ApncO5P3LasxCMm6dPcrWuR%2FoN8UM8uTQjUsxhJlF6fNUv3gDqt0em24ZogKuKpzS%0AIPXX9EGotN5XxKgbCY6lAOiHOjHJ0tfMpPQvtqP1Y28mJjp%2Fx3kb8ul5h4H6Uigr%0AB7u8tHIbR82ghbqzE7vKrGld%2B31hP7sRKthtd17qJPEvDfvwW%2F6C7q8Do2PObVqY%0ARqwzVWns8mrkTuzJgzSUgWCHBU%2FrDVxf3ucVu7bDqCYkWVkm7bd8Gpy0%2Bako87UM%0A93Fa%2Ff%2FTegrWGbFqj2maoPgBVHCe%2FaEN2M2dyjeltqW9ATHyeelq4PgqO6i7CE00%0ARC5ZKpdPkMruroviP%2BWr59oIxEU9YzTVwv7B4jIr3I9ZxFrrdz5xIWwA3kfHoBs0%0Ay8H01tkzJVFlL0tRTd6SZOCMao9SXFa16SAd6boL2rzB4KhQPl2KYop4jFQGPvBa%0AZtlGgI8mjL5UH94YAO%2FpMQb5eB0fYxnZ5WCrjr3PMjg%2Fw9OB8y6DL7cpI1%2F9kxqP%0AfPlnDv%2B6U%2B8%2Bc%2B96s52C4QIpddeAqsyDbiUv3D7KfajhF0WDaf599YK1TAyOR3tX%0AtmCq4JtKQ9%2BHehztvwDM%2FvWf2Ku0hk%2FHjPwJ01ct%2FJLAGm1UeZ%2FjuhaqQldmOMBJ%0AbhSHT9U%2Ffy72GWNiDAeX6f4Fa6aJuOVKYjDUSAhdgGsfdfrPJ7kJPcOOyI%2B%2FcC1p%0Aasvfc9OvJWyZ716Md5j0hTVfKWfXtnhzKcGl8nrA4XYZGA8%2BlZYamefKzIVm46kw%0AowsB15NUI773ZDTddSCL8c6JQuOt5K0G60w9M0qxYouZEnWT4LE8eg1S61Vrbl6P%0A3yiG7MDy2p6%2FFlmCZgDHQRUqkiuCGUVpCwKiZwNzEMqe%2FMNx988dMknwadXEAt%2BI%0AR1xpkkyUDD8cdbb1%0A%3DWrMi%0A-----END%20PGP%20MESSAGE-----&message_id=15f7fd2fd072cff2&senderEmail=&is_outgoing=___cu_false___"
      });
    }));

    ava.default(`decrypt - [enigmail] encrypted+signed pgp/mime`, testWithBrowser('compatibility', async (t, browser) => {
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, {
        content: ["Message encrypted and signed using PGP/MIME."],
        encryption: 'encrypted',
        signature: 'COULD NOT VERIFY SIGNATURE: MISSING PUBKEY, MISSING SENDER INFO',
        params: "?account_email=flowcrypt.compatibility%40gmail.com&frame_id=frame_POsACRbHGk&message=-----BEGIN%20PGP%20MESSAGE-----%0AVersion%3A%20GnuPG%20v2%0A%0AhQIMA0taL%2FzmLZUBAQ%2F%2Feb40AmsR8djZANi63cCx4sk2TIlNauZ9OdnqMEbII7sB%0AYoK%2F0KDRnH5I0cNfwpFcmXkUhrSLKtn0%2BfyCrxrxo%2FQZZO8fD78OqUu3ZwC3hFPm%0AOiLlx9oI48hj3Hrw%2F4CU8FQtboMA%2FqPPLqtjnIJLDHQiZayCF6XnokHNF4Cj3wqn%0A4%2BGn8AakUGsAr7iUyIkZ%2B%2FpR0VbPSgejFgddu8H9296o21MR%2FtB%2BFN7DK%2FL7fa69%0ADZyLLdGp5vPHUB3GikAuS%2FpoyggRc%2BlSUa4T6jtjUSAUGtOUWtRgBFLAeeuHoskX%0A6tw5A7OyDBTGyQSWIRb1J5N7P5dXrU%2Fvt97pQhrVgRXxfbeq0OLkLm9G98thE%2B%2FG%0Amww5CQ%2BZNfRMouPzBDPT050TGB23JMTxTx8o3bPLb%2FUCmB2Qhtb90XNcUiyU3gyJ%0APnkI91fKGftT6bG%2F9lk76RusZnEqWhNEsvXS8KF59pj3Ea1cVeowwQZq%2F57C6pWQ%0ANSKMQJI0W3VCCyrxMXbedqbXfVuI%2BmOYt4%2ByRKp0mPWced4d5nV6O8qICrfr3%2Fkk%0And7VtWqRL7nDTbcPWZNSPOP%2FDHj5yZ4w%2Bcq%2BrOj5AtjRsbWIt3NR%2Fpo%2Bhyyu3zHD%0AM4GktXqPxtDZl2HsTC6gc00CFP8zqTKqnDpQRZ%2BKl6xfvemPQLmz4pnrzEyEsbSF%0AAgwDluAOlKXQo5sBD%2F9EObMtDbWnqtRpIIYXp3es47FPBKgR5Ouc%2Fcrtf3K9n168%0AMp7K%2Ftt1JsrCnO4o3ojiIK6O40IilqnhBN3hFYcRPJ2lW2jefJvKO1ksji1q7k6H%0AdmTz%2BjE3mow%2BPAn7D%2By1CVgTpvy%2BNg2Do%2F6UR0dny4Mm7lZhH2l2sCTH6FFXskBV%0A3IzAwSONtwkxpvT7%2BMqcq7k9D5P5hZTPuip8ck%2BIFr%2FEKUaJm8fAnTcbf5tRqgep%0Ac%2BVy4QxKXu6GgTDHwYwHLzVbiPD8GG5cApbpn8c%2BnfKqgjGua0zyYl0FUd023kZy%0A9c4Webi83NVMZDm8%2F5SCHvVJtiKJa0bquxy1aBO5nLlxxnIM6H3oB1UrQpij5oC1%0AktaW08rwBSkDHnaFLfW8bxdyAkjsibahvIW3epIK5aLoOiDkhMIhkKaBvBOOSVet%0AO04XJauG2rAeYF9JFV8FxexOncXBSZfBFWHjeN3b%2BcriKuD41FwLx1nIkVIZYd6a%0AYXxvby7jKTO4%2B8Xy%2B6QuDFPKmUIRbSZZ07n8D6ZsJzwcU4MIBCthM320oIFnD9W4%0Aq6dk56Jma%2BrWsLbQoqh4I1rJ2kJ3yT1jQWBuAwLWz5Hzdomz1Q9if%2BSDlQy9sjl%2B%0AO%2BzKB34vcqfet3wbA44P3ROhmanBa1TOoBG%2Bwkhh8xusHyJd5aU6AbuEoi6XrtLq%0AAS31F9NVnEjnCykrBZIj2B5TlC1mT0yENRyCkqEvmBWVjM%2FxfiW2vBpmEj%2F7rI%2F3%0Ap0eQabbyVSHXngz0IlAch%2FcV8wp58tXkVUpWzn6GU0B1KCxuc7FyPcdAAThNzZP0%0AREhuIRgjJSR%2Bj4okHgJhKnxfvIxqlrnKYNyGWEvvL61D2nBiRlCPGl38CMSlT8eP%0A87hU2ks2I9ztv4l9Z9Ob639nYFBLQ5UlesUgQND6d%2BfHqk3mdC6Hzm2kHHBdujgl%0AFuj66eGrfgHwcNCtQiNkYXcgh6TmcIMvFgOiE1PyE3v6x04N7I71cFgUNkoeo4ke%0A4jjOgGJJHRDofWvTGvT4JtCnoqLPahQWqtR%2BBNMY5phFEVtsfuMND6fJTkzYEDpQ%0ABVM3NmukPaw6LIjlN1EmoeSX2BleqvvDIk9rAt3iekOlioYKqvk%2B7xjS2O9otWX6%0A15mHWRx62Et4RSArvRJdGiUP6UTLqGd89Il574poQXBMBDfkTvf%2BEQwgpeb8WEha%0A%2BtFI2aTMj3mlgskEUXSxtO0ZB7aORfCQiy2Jkf36puEfHwOy0l5YnQshXa%2FyJCQR%0ACIc4H8dnSuQlkgRnSODOnYGqpSqfU%2F7%2BMcM2na1jhsVLX6MPzSr6bOSB3QwTbGTk%0ALdO89dD3dnMeHmVjaKTg5wo6i7k1ERE1Um2gHMlrtW58AZN4KPABp07BXgV4H7P9%0ArkIBP42cfkPoUNJXd0BCGEiOg4%2FNcTjSg1%2FvWuAvmWEN28sABfO81d7ucGZtt1Js%0AuyHpVmumoSD%2Fi1woR58iwSPd5L3a4Ax%2BBCg7t0yTP%2FPJRtX7hvSh3FajNkE%2BexSq%0AJZPLq5CYAPNagBWY%2BYzRWTJCz9nC%2BpuOpxZ08x%2FdzX4AEcwvAG8pg0%2B%2BBo7JwDd6%0A8tm0I5LUXXm%2F%2FVf3AQf0GTfpM61bru%2BTyvjvRhmQJ8S5qwozazZtrJUpDQJDKhPY%0A%2BeMHgrlBDTHtXVLXfT0qKhft1UNXCY2v%2FUUq4C5%2FNjm1KHfMnydhHg%2BvzEg9mE4W%0A2mdbWVSz53XdfzBspAYE88EIT%2F8W2biebllWIuxb1%2FIbIpnkV0u5Gja0OB5cVVmy%0A64zNOOk5sgOIlsEgpgxAU8nHrnmg9585XiSjTSMAfb5h2zbQU0sEkOHvADnn8Asx%0AEWM0iquK7lpMaQKpE554UgBcDMjbZnhss1tZf5uz6SX4YEI2y64kIHXiTEL6sqj%2B%0Ao1XWkq9SDZOuvbq%2BUOgB6yaXwZr%2BB1fj6fGqozyy%2BHbTdg1Y2a%2FbTOG7%2BrM%2Fdl%2B9%0A7BUVZsCiF5Cs%2BVRLNmIpfpH80U4AGHoTyATsybiH9ZCZn8qsFmZ2hNpeWGrM%2FbQU%0A93We0G5lmun1qd347UhncEvfhtyt449iHytWebexzDqDMLfuo5BZtVfe%2FXJFhriP%0A2zFLe9gZu%2FOjM%2Bl6Th6UGJ01jrUmqKI1veai2y4jqzqRZbSg2EinBAp%2B1hI%3D%0A%3DFgMR%0A-----END%20PGP%20MESSAGE-----&message_id=15f7fd3ba3f37cf3&senderEmail=&is_outgoing=___cu_false___"
      });
    }));

    ava.default(`decrypt - [enigmail] encrypted+signed+file pgp/mime + load from gmail`, testWithBrowser('compatibility', async (t, browser) => {
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, {
        content: ["Message encrypted and signed as a whole using PGP/MIME.", "cape-town-central.jpg", "185.69 kB"],
        encryption: 'encrypted',
        signature: 'COULD NOT VERIFY SIGNATURE: MISSING PUBKEY, MISSING SENDER INFO',
        params: "?account_email=flowcrypt.compatibility%40gmail.com&frame_id=frame_ZFnrtBtiit&message=&message_id=15f7fd7fe45fc026&senderEmail=&is_outgoing=___cu_false___"
      });
    }));

    ava.default(`decrypt - encrypted missing checksum`, testWithBrowser('compatibility', async (t, browser) => {
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, {
        content: ["400 library systems in 177 countries worldwide"],
        encryption: 'encrypted',
        signature: 'not signed',
        params: "?account_email=flowcrypt.compatibility%40gmail.com&frame_id=frame_DfGthWpEth&message=-----BEGIN%20PGP%20MESSAGE-----%0AVersion%3A%20FlowCrypt%205.0.4%20Gmail%20Encryption%20flowcrypt.com%0AComment%3A%20Seamlessly%20send%2C%20receive%20and%20search%20encrypted%20email%0A%0AwcFMA%2BADv%2F5v4RgKAQ%2F%2BK2rrAqhjMe9FLCfklI9Y30Woktg0Q%2Fxe71EVw6WO%0AtVD%2FVK%2Bxv4CHzi%2BHojtE0U2F%2BvqoPSO0q5TN9giKPMTiK25PnCzfd7Q%2BzXiF%0Aj%2B5RSHTVJxC62qLHhtKsAQtC4asub8cQIFXbZz3Ns4%2B7jKtSWPcRqhKTurWv%0AXVH0YAFJDsFYo26r2V9c%2BIe0uoQPx8graEGpKO9GtoQjXMKK32oApuBSSlmS%0AQ%2BnxyxMx1V%2BgxP4qgGBCxqkBFRYB%2FVe6ygNHL1KxxCVTEw9pgnxJscn89Iio%0AdO6qZ9EgIV0PVQN0Yw033MTgAhCHunlE%2FqXvDxib4tdihoNsLN0q5kdOeiMW%0A%2Bntm3kphjMpQ6TMCUGtdS7UmvnadZ%2Bdh5s785M8S9oY64mQd6QuYA2iy1IQv%0Aq3zpW4%2Fba2gqL36qCCw%2FOaruXpQ4NeBr3hMaJQjWgeSuMsQnNGYUn5Nn1%2B9X%0AwtlithO8eLi3M1dg19dpDky8CacWfGgHD7SNsZ2zqFqyd1qtdFcit5ynQUHS%0AIiJKeUknGv1dQAnPPJ1FdXyyqC%2FVDBZG6CNdnxjonmQDRh1YlqNwSnmrR%2FSy%0AX7n%2BnGra%2B%2F0EHJW6ohaSdep2jAwJDelq%2FDI1lqiN16ZXJ2%2FWH6pItA9tmkLU%0A61QUz6qwPAnd0t6iy%2FYkOi2%2Fs1%2BdwC0DwOcZoUPF8bTBwUwDS1ov%2FOYtlQEB%0AD%2F46rCPRZrX34ipseTkZxtw3YPhbNkNHo95Mzh9lpeaaZIqtUg2yiFUnhwLi%0AtYwyBCkXCb92l1GXXxGSmvSLDSKfQfIpZ0rV5j50MYKIpjSeJZyH%2F3qP%2BJXv%0AZ47GsTp0z5%2FoNau5XQwuhLhUtRoZd1WS9ahSJ1akiKeYJroLbTg10fjL25yp%0AiaoV16SqKA1H%2FJOuj6lT5z1nuez35JjeSpUc7ksdot60ZovMfWC%2BOGRnkYKb%0A7KxFd7uaxL6uOBOFyvRxYeohKd73aVkiKpcWd4orI18FhlftFNAwIdsmfzNc%0AmzTHZaUl89iYxEKR6ae6AKws1wzLq0noarsf2eKBVbTSfmK3S3xFqduKINnc%0Ae5Yb3F5adSj1dUjm1BZ4aqzsgKyBb%2BJ8keG9ESsnFOyxOIUXDM1nIo1IOgzC%0AM928Jb9GVa%2BuhdXRrb5cLjTihTusJN0I8oJrwKkwIpCJVgPMdDLkeubrMBQ4%0Afbpl4V76sOU2Nx%2B6nG2FnFBFBFohOL%2B0nTK5%2F6Ns9ateN7K9VP%2B%2BQcoeqfPk%0AIUO3%2BlCZW%2BtrTSvvFId3ziUVsPTeuAS%2B7nxSMfWZ%2FK9Ci6QV%2FXnx3F%2FqSmuS%0AAUm4zPQ1EjZf1N%2F5K%2BvhcCTN4MMx406VlqtedkXL2KPwZ6jDS%2Fww8RfcmPnD%0As94ct0WCZZtNlnQq%2B5h0ybwTJNLC2QFyrhhPqztVY95n9La2Mw5WITCWzg%2Fd%0AIBUceW%2FOwHYtePyaSQkCnegDw%2F2mN2%2FGC8d0OlwULcTYG6uVenGv2UOUbCr3%0APfy%2FEb%2FVqUEZK00PdvVQV7FWYAshuTFPTqidph04CgQvBpi3SDEEo8SkEIFS%0A%2FiEeRQaWjFEXKUI3FwKXPJQWvFpbrXBOAjnxXXbAFYOLxdydmq1GVl9Mm3GU%0AClc9g6t9vaYDBPx2gN562%2FCM%2FnT8Vq45VHe79XkrrcHDwLn7yeHJScNFsib%2B%0AVvwTPoUftlhC%2Fai21D403TsJpm7ZmPcDjagoIcXrS%2FlN03z79RBmSKFtYiXW%0A4obkKSGow61vMBh2%2FXLVYKJKpYKm%2FGnVlJxA0zQVl558x8I%2FnAMaxSzwx%2BZY%0AwaVU%2Fs5PLZ7Ghg3MOguiRTlflKUQyL0A7NR46OjFgUnHAZRxr4KO3GoxVPy4%0AXLeS4%2BWl68s7QlV6WF1IKCHWEUMEeRRea2%2FOvvlS%2FoLs2MNNWDemlJ4SiXHf%0AxINU38Txo84A00NALbKppsSyy9Gwj%2F%2FrO%2FFcerupkfeuOm9nHFwIQeeC5bWD%0AmmRlC90r2jY8gM%2Fv3Jjy9h8PbXWxh9MUpc7%2FkAcTwdGlMxiVjE29p065qTRr%0AOi6sJ7pWuYTfWldZqTVmaBjlv0zuXQ8Eo8o%2FUSvoTs%2BoihYIMcqReqdeqr%2FN%0Ae%2BsDtYKRg%2FLKp%2FJJ5nAQzVMP67DxkgwLNxx0ijBLysaQmvRlsiYWayxZB1Xd%0ABxA2bjZRvsmww%2BhgSKNlcsiubJGBqfqvgmlebZuJHHSC1L6mdMYgcihKmYAj%0Ap%2BHFLyqgyeRVMdjRHcrEdxNPG4fJmlk1bYiVQQ4XAd72w%2BAHS%2FseZ5HzbAK0%0AomuHYUD5PTEqZ1K9JObSsh3XMUkJK%2Bz3BnrOxnTOOyG2r%2B4FxizH6rfz%2FPgg%0AsPxqxE9ELUlgQe8plcPFge6aN9tUoSe%2BvMtDaEAqKw9JwofBF7jlxTqMMvQC%0AgWbn9x3W5o4VrnpjYGtPl8sh1QREu0A%2B0PUJAKL4A3GSMYRouGewLSMNJlOg%0A%2F0pPF6qB%2BFi4GJ7ju5C07tfr9z9UqRj09kDXJuoJd95NdSiCz6ndugn6gs8B%0AQf%2FXPxZVefeMLiB6p8pG0iZ%2FjcJjyYJLtTg6kA%2B1%2FffmJPfH%2F76ZA9dgEJLj%0A%2FW2u0Lp4NY8cwqcXuGKgl72TVJ34Iawl35Y0yr47k%2F7Y1vEQ5Q3bT7HP5A%3D%3D%0A-----END%20PGP%20MESSAGE-----&message_id=15f7ffbebc6ba296&senderEmail=&is_outgoing=___cu_true___"
      });
    }));

    ava.default(`decrypt - pgp/mime with large attachment - mismatch`, testWithBrowser('compatibility', async (t, browser) => {
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, {
        content: ["Your current key cannot open this message."],
        params: "?account_email=flowcrypt.compatibility%40gmail.com&frame_id=frame_yVMKFLRDiY&message=&message_id=162275c819bcbf9b&senderEmail=&is_outgoing=___cu_false___",
        expectPercentageProgress: true,
      });
    }));

    ava.default(`decrypt - pgp/mime with large attachment`, testWithBrowser('compatibility', async (t, browser) => {
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, {
        content: ["This will will have a larger attachment below", "image-large.jpg"],
        encryption: 'encrypted',
        signature: 'not signed',
        params: "?account_email=flowcrypt.compatibility%40gmail.com&frame_id=frame_yVMKFLRDiY&message=&message_id=1622ea42f3654ddc&senderEmail=&is_outgoing=___cu_false___",
        expectPercentageProgress: true
      });
    }));

    ava.default(`decrypt - pgp/mime with large attachment as message.asc`, testWithBrowser('compatibility', async (t, browser) => {
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, {
        content: ["This will will have a larger attachment below", "image-large.jpg"],
        encryption: 'encrypted',
        signature: 'not signed',
        params: "?account_email=flowcrypt.compatibility%40gmail.com&frame_id=frame_yVMKFLRDiY&message=&message_id=1622eaa286f90737&senderEmail=&is_outgoing=___cu_false___",
        expectPercentageProgress: true
      });
    }));

    ava.default(`decrypt - pgp/mime with small attachments as message.asc`, testWithBrowser('compatibility', async (t, browser) => {
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, {
        content: ["Can you confirm this works.", "Senior Consultant, Security"],
        encryption: 'encrypted',
        signature: 'not signed',
        params: "?account_email=flowcrypt.compatibility%40gmail.com&frame_id=frame_yVMKFLRDiY&message=&message_id=16224f57d26e038e&senderEmail=&is_outgoing=___cu_false___"
      });
    }));

    ava.default(`decrypt - [flowcrypt] escape and keep tags in plain text`, testWithBrowser('compatibility', async (t, browser) => {
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, {
        content: ["thispasswordhasa<tag>init"],
        encryption: 'encrypted',
        signature: 'not signed',
        params: "?frame_id=frame_ZsfVUZsdjN&message=-----BEGIN%20PGP%20MESSAGE-----%0AVersion%3A%20FlowCrypt%206.0.2%20Gmail%20Encryption%0AComment%3A%20Seamlessly%20send%20and%20receive%20encrypted%20email%0A%0AwcFMA0taL%2FzmLZUBAQ%2F%2BMC4kEIaAIdbuApd3CIf72DSEy9%2BA9%2BKlcXbhbFiP%0Ah6bT0x7PSzKMAraAgIRaUmuX3WojyYmeA3sZOtFw5I1TXo2wX0WUYlWGtXA8%0AsgsQvf3voy46DEhFYKjpk38OqK77GWnU1t4QrNUqjQJ6pBjslo99yx9RvYpv%0At1X%2BN0OLcIevTh0R7tjidPsjQx8PRejhuIAgM6mI39n5YUB%2FVCMqDRrqQzrj%0AcD7%2F%2F4X0eJhTYjDGzrSdLtK%2Fn2zDca2XeHe3je4OtLGqYP19n4YgmjcEVvit%0AQsDorTdXwoDKp3gZ27VmjkL4ua%2BA4j%2BeN78HXAbKCf3Hk0xxOlOaDmAdKvZa%0AXVb1KZNLaAeE62GiEombvFhyihvKBfXxmBCvXBz5x6g83r5idLd7U6Ndafyx%0AnZMPvxs7uutxeJ3HG2oMvWPOhr00FyiJvMG8mfHJh6Coh4RkK%2Fe8oxeZioS9%0AL0ZYNpmukffcxTyD%2Bwm13d%2Bfeu%2F5DFA8SbBfnhEOW80dzpA7COqx42HkOlRt%0AbAPn9Ao%2Bv9hzhDmOrHTYiGBGBzRO53b5Wyp55pyYCY6r4LyR2%2Bs6%2BRrCVBo0%0AD7yjez9AqPw65sYi1qeT4UHtBzTbi%2F7ll3EjtphzLxTv1DyytMjqDUHcg7Qi%0AvrqLY2mfFm%2BudqbdR99WX2WzJijJRBwt5hExJMMA8%2BbBwUwDvb12YPaZjcQB%0AEACdW7%2BIK3RgtLjJmo3V964JR8CQkXq50XzgiA%2BcJOXTN9Jsc72W3Vs1xZE2%0Ap5D%2BI3b9qQOMgzWNpYF6N5NiyWFDtKhGyeXL2zoG8x4COyZb25al%2B%2BPMtTkT%0AKooVSbpYaRif6Q3vWVZ9C29aeDqxa%2FMwxoI89q%2BB0mO1oAweNgk7%2BZmjOeYG%0AfwxkYm%2BOGevabDWZrxKLr3LhhWIFeewPxfzyi3TqAZjEnEwkD0FYssR%2BLtSX%0AIsbXTdkV6j3%2FcuDHLdJ4x9nEr0mefpSNfzIwq4iDYdWR7huGjE%2FTkw%2FSF7t6%0ALt7OwsO%2BDVr40fYOi0vnF5h6GMxCgsHpMy7LC9iCpd0jL9wWvR6IukHOVEwj%0AWPmZ34M627IC%2FOgiuFllVmXdJ%2FbtBVEnLOyr6hvsMKtKqD0cS83FoaY2h%2Bn5%0A%2FG9WzSWjABIZgsQijoAIJc1C9%2BwwN3uUFocrgdF54Z9pbwZHUrnBvCYrL%2FTQ%0AAN7iBvQNkkoFAWeS1JMmGKymR3tqiB8pSQU9SP8rYJhOMcj0oezuZxEZG8ge%0A%2FyUijaF8X%2F7NgfqLoBym2mfoLxk2pEGFuhk2Bbtxi2LeRl5nzpCvO6oEYdYi%0AI1ERyOA39BezaN1kw%2BQrmpqETKm%2BInprCxGA1vUOVmOHO%2F0YHZBaYOIvk2Xj%0Ajkq6kVFmQxjFE9L1IfxbaGkQ79JVAUV9w66wcSz0yULr2%2FU6knQPBnENobl4%0A6fwiBkiSGAvKd9%2Buu6wJaZ5tYPWUP0HAuKccawytNmGREWAsffz%2BnrMsEDUG%0AJi09JiLTQU4ACCacM3hPVw%3D%3D%0A%3De%2B8z%0A-----END%20PGP%20MESSAGE-----&message_id=1663ac8b70e22517&senderEmail=&is_outgoing=___cu_true___&account_email=flowcrypt.compatibility%40gmail.com"
      });
    }));

    ava.default(`decrypt - [symantec] base64 german umlauts`, testWithBrowser('compatibility', async (t, browser) => {
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, {
        content: ["verspätet die gewünschte", "Grüße", "ä, ü, ö or ß"],
        encryption: 'encrypted',
        signature: 'not signed',
        params: "?frame_id=frame_TWloVRhvZE&message=&message_id=166117c082a73905&senderEmail=&is_outgoing=___cu_false___&account_email=flowcrypt.compatibility%40gmail.com"
      });
    }));

    ava.default(`decrypt - [gnupg v2] thai text`, testWithBrowser('compatibility', async (t, browser) => {
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, {
        content: ["still can read your message ยังคงอ่านได้อยู่", "This is time I can't read ครั้งนี้อ่านไม่ได้แล้ว"],
        encryption: 'encrypted',
        signature: 'not signed',
        params: "?frame_id=frame_oGBJClmooG&message=&message_id=166147ea9bb6669d&senderEmail=&is_outgoing=___cu_false___&account_email=flowcrypt.compatibility%40gmail.com"
      });
    }));

    ava.default(`decrypt - [gnupg v2] thai text in html`, testWithBrowser('compatibility', async (t, browser) => {
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, {
        content: ["เทสไทย", "Vulnerability Assessment"],
        encryption: 'encrypted',
        signature: 'not signed',
        params: "?frame_id=frame_NBokFyMmgB&message=&message_id=16613ff9c3735102&senderEmail=&is_outgoing=___cu_false___&account_email=flowcrypt.compatibility%40gmail.com"
      });
    }));

    ava.default(`decrypt - [enigmail] basic html`, testWithBrowser('compatibility', async (t, browser) => {
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, {
        content: ["The following text is bold: this is bold"],
        encryption: 'encrypted',
        signature: 'COULD NOT VERIFY SIGNATURE: MISSING PUBKEY, MISSING SENDER INFO',
        params: "?frame_id=frame_aLOUYUkbNJ&message=&message_id=1663a65bbd73ce1a&senderEmail=&is_outgoing=___cu_false___&account_email=flowcrypt.compatibility%40gmail.com"
      });
    }));

    ava.default(`decrypt - [thunderbird] unicode chinese`, testWithBrowser('compatibility', async (t, browser) => {
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, {
        content: ["這封信是用 Thunderbird 做加密與簽章所寄出。", "第四屆董事會成員、認證委員會委員"],
        encryption: 'encrypted',
        signature: 'COULD NOT VERIFY SIGNATURE: MISSING PUBKEY, MISSING SENDER INFO',
        quoted: true,
        params: "?frame_id=frame_TgvZakuQNa&message=&message_id=164563dc9e3a8549&senderEmail=&is_outgoing=___cu_false___&account_email=flowcrypt.compatibility%40gmail.com"
      });
    }));

    ava.default(`decrypt - [flowcrypt] remote images get replaced with a button`, testWithBrowser('compatibility', async (t, browser) => {
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, {
        content: ["This includes a remote image", "show image", "It should not load"],
        encryption: 'encrypted',
        signature: 'not signed',
        params: "?frame_id=frame_obvAUTGAJU&message=-----BEGIN%20PGP%20MESSAGE-----%0AVersion%3A%20FlowCrypt%206.0.7%20Gmail%20Encryption%0AComment%3A%20Seamlessly%20send%20and%20receive%20encrypted%20email%0A%0AwcFMAzBfgamu0SA1AQ%2F%2FUx%2Bp8YjoeUUXHd9cd0rWntMM9eNkdWuOVpmURxSG%0A6ayF7lp5Tp26nDZvVmxQE0%2BYskt66vXpbT2BLjVnuhBrCiEkjvLuGMWcXLdc%0AidkaEXswVw9p31VeqrefKvMu4kCqwdHHpiWwf20PKhJQXAzXpmIjlJq1JHbE%0AVpZ5a76Qv2zh%2FxHDHvQQAGmvsjJFzjuClUKtIbqn%2BaQEx7q5zefKB2nObmQC%0AQ%2B5wup%2Bm%2BUaRZ2mwU8KVnjHizHb%2FLQXw8Ei93s0VVclHG2R9OYWZygToIJc3%0A05nk6RNQQYPSEWvsFC%2Bx%2FdkAhg9dpo0%2BPT4qnEdFQstkbzGAZXPxd4AfILPr%0A01OTfcp%2BDteZCaieFFlunwnCHjBRwA4R6zNeVt9N4lBu7Q9Tg0kso3cbkQTq%0AJckLlRQuKXIYK%2B29S6NBFsOndBBbQazGK%2FKlPYCh%2FTBRm6i%2BsQ7vbZOuX402%0Av1RviRc1HQ7Cl3ZZO4po4CtR3kDXcrERpRelUMcxKwQqmTeUQT3MNnZtOdXx%0A93SA9zqnklIuCrSkioL7g16i4cjKsFHwd5EmVdjAQCOSxXMKcbR4jE%2BmTP21%0Ae2nT%2BIIZmotruTp6Z3W4Pxh79BS8HKV8o9NxWlIjLa8xpS1YjA4l502z0vKi%0AFBUZxSC1Srdjlu6Zw4k2SntRDUASXQfMB6FlR20VV3zBwUwDvb12YPaZjcQB%0AD%2F9wEhZLgqSmrYu2dGN7xEE3lMNFuajttH3GDtan3M6LnQFe%2FAkvpFIYdS%2FH%0AgPVLZAJKgSGQySFpCrSc9LnoOlemQYbI4u97imi%2BP87WiZ4Cr%2Buv06NHBjFm%0AxDRIANTHqqatQja7X2mSXbCyXElZs8YKscz%2BaS9rK6S1m6vqmsilb2yRqw3Z%0AZr0eP4D7mpf1HZMZpKZ%2Bp%2BuV7H7FFddGEiekL7IlkyzeSZQYv5kUtXjyOwQG%0Atnx6bo2u99fG3yMa0RNK0enbMBviF5bcCWA6Z0HOfLmx9dIUYi4j%2Bp%2FG7w6z%0A0YeKMJjEFlpPNEhmeDsPJpbF41o%2B7iIzZdBYAhtxtrmZkYk%2BiMbhZtGZG5Yu%0A3v56OFdgXCvkOBMKK0oASoqzPXe0WrBsf41y4Ie97wBBLQ7OnYdR%2BQk0LWjM%0Atwjvm4GPvx3QO6sVi0sRHfRb97PB0QExw8Xk5vS0mKk9lO7pyYiTUiarjNze%0ADCTlCpyExHTNybxjUYcvDr9S9UebA4UzDQwL2V5y1GvPf5yPAV443pqQx6hW%0ApysptKiOg4Nud4b1Yfk4IAHtVesMJDMidowrdmOv1cU%2FgUe2f%2Frz14lErMYL%0AVCsQP7BIN6GkHnuPqrZybiZ02BNuOymNqsoxcQuphFV%2BNv1XyNAKSmbhtRjp%0AXhw%2BsZp0N0Fi9dKQ2ZmimK3nLNLFcQG17x7yBYzZkw04FLeKQCqHfJL%2BsE5U%0AbU%2BTeg1IQ%2FMMovXvZpJf7tNtPjx7%2BRKR0RwbRVyTLLKA6nUjOo34OJIaYHSk%0Ax1BUIC1YrXZTikDowlDNWYNpsySn05g3AFfWgRKhFzYTKX7BwDZnnWvyzi13%0Agpmh6SMbRMKaZSQ7%2FdfP67AyvBihu1B25FHQU0WEplEooMsvHONbHBECk7cg%0A%2F3FQriLkBIJ63YFpHpYBlqk%2FFtKEHioHxCu3noi7Kalkp3mSqLUjW27lmbOu%0A4YPVCw1xFupCglp5YgupuVTpnZt6FPF3uSWDipDgA3ECurBvH880ibOdPvxs%0AhIlouP2DotFvgSROgP5NKLska8a5dW5C%2BZwyEwQNEbok7vya%2BzRd6V7WExcA%0AR7cBywNLyEXgJJ%2FQa0rYd%2FHq%2FZ79HfrvVLvydk7DCRv5OomDaW8ipSI7DC5v%0AlSPLbkV6hghX7Cglv%2Bdnit2KqpzP78xoiQ4N5omUSun6ozS6aOu7zYC%2B4v2A%0AxhepY45%2B1Jc56MEinzq1gIgJ0TdzsnV8OaAnQn24X1g%2FkaWW%2Bb3tdsBfg7ec%0Ak5GLzOoMYopf4TkgJDpDX9oO8hXGFg2MoPEkhYjfsKMQd%2FOHd%2BFAOn3hl2m8%0AH5eC8lrOcaeWd%2B3Wp3wLXx5K4IWWSao1cnUhLWojFNDS2NJD3jItXzR2bTTy%0AbJlg4RgU%2Fxk2fJdMK0meKCsjlzU%2FXEcuv5aXMaUD9CM6XfBybFXyQ7eDzgm0%0AhjncOUw%2BaLsL%2FoHKffoOo53lp%2FiYDLNj35AVUScRCuhINuVUIVOZKpbUAnM6%0AuVuo%2BAgYt8ToSI7gmyNhFG7BDHirhPxFQsmW1IAv3D2g0NxflWD2f2uFralO%0A%2FQuJTaNEbKEOtsr4OKbY8Tnv9Tv%2B58Mf64D2H0KLg8vb8PWKaNA%2BfgRrWQ1V%0Af7s3yXOs6gGdK04995c1NZYsscSpN4X7XkIAmpRVp1nknY9%2FgIqlvjdBsQqI%0AKhBShbg7khtU7yeu1Seq9CTQFDFKPz%2FHG5CSx4OUVPIDnsuwxDCeTH3aNmGQ%0ALR8GVQ%2Fuu8g7eSjh7ab5w9KLyGwyX3VAEzLgdkItNu9pO%2FxPzYYBFWvzyZb4%0AbyjlxtSbe%2FvmHkItEIHZswsYRKPWWTAKqu2avqNw%2FFYI8GZvI8EPY2rxosaw%0AVVeAKn4fF07HxzVgPbWCxS3oJc5qXpUYVvR1B5nF9vHa2UEiJflJb2A7Udas%0A5LqDNcLogNWIhkPWQswIxml2bJVBV32x0YE2Prll6sr7Mtn%2F2PjDFonkebe6%0Az%2FnOOQ3JBC7rLxFjl6%2BQd8ieRKHvzkfOvjaaJEYIKb%2F1cD1mKQD4yfezVGdn%0AybLh45TTiLnWvahRNImkNuDKFGlGcfYYhifvlAVR7OAsPR9tZDJ8lx4vWhz7%0AoXdNDG2p4tzOzNoOw%2FmnuRolKnEOeMFDCKqAf%2Fh2W6YoWkp2yCAb2Ab37E4L%0AKL7zTAF%2Bp3KTpCEk58jaNAvR1TLKYMKB6ABdEQAhep7iG3vAM0wNh2LSVitX%0Ac%2BqOt3QzF5ucRchYnl33EHplwqewYPfwReSDcDZ9BdYZ65sOnj6H618RBUaU%0APEccylO1wv%2BTDwXrlFvdWBG1Gg0G7WhXuxdu2vY1PJj9z53lDZfGa0R1twsx%0A%2BU%2FBTa%2FNrJT1E9mxvUbZvUdI3eNO8LN6zokhqlj5uY2YaOj6%2BhRohMSltoRc%0AJvqXcbDYusQFhe6LjAJhRhywx57w5cqFwFp1ZAYmCay0eBoabHKrTCS6iOE8%0AS0B%2BdnnNq5vF%2BKk7Ch%2FZDLdqY0eQxupGct8vkgEOa5sLcU5GdIL4qYxskqqP%0Afj7hZkDxDWzBUhH%2Fha9GmShF46Ec%2FPDkXA%2FwZoxgJ18v%2BkZhuvl0uGPLWhjs%0ANNV6FD%2BGHFVqEEZxuaVqpVAKmeiFeeu9gErBFv3lbbbKL%2FAHcipCoslfnYib%0A826fC9NUStDxZUW4nqPPCbCBxgnlZn9GNXvjnXiGKi%2FKDVdiQYuiCvT%2FNKqn%0AfvH1X3RbMk64HzZC2Kf%2F0GLtiz0mySO2zS9vQQ4WZZRMyRcGCyAAd5R%2BY%2FjT%0ALsgp%2Bm21y3X05Oh6MVjZCLrmBsD%2B5MaI%2F3Nv%2BmXmKqg%3D%0A%3D%2F4SV%0A-----END%20PGP%20MESSAGE-----&message_id=166b194b21a0997c&senderEmail=&is_outgoing=___cu_false___&account_email=flowcrypt.compatibility%40gmail.com"
      });
    }));

    ava.default(`decrypt - [security] mdc - missing - error`, testWithBrowser('compatibility', async (t, browser) => {
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, {
        content: ["Security threat!", "MDC", "Display the message at your own risk."],
        params: "?frame_id=frame_obvAUTGAJU&message=-----BEGIN%20PGP%20MESSAGE-----%0AVersion%3A%20FlowCrypt%205.5.9%20Gmail%20Encryption%20flowcrypt.com%0AComment%3A%20Seamlessly%20send%2C%20receive%20and%20search%20encrypted%20email%0A%0AwcFMA0taL%2FzmLZUBAQ%2F7Bwida5vvhXv5Zi%2BqJbG%2FQPst11jWfljDQlw1VLzF%0Aou8ofoIEHpvoFgXegZUnoQXBmlHGD%2BXLs9jG%2FTV1mtE2RWq4hDtqiTQ6rEIa%0AbrN3Nx77Yr%2B4EN1aKI20aTLEPTIjVU2GH2i9DAmjHteBU3nkL9Z3yecB8Pn8%0AEdhpCRY6cj2yrhJ5MPwmXrus9OFv39wA2DqYpqW5Be%2BKD8mipZ2CtJo5xtin%0AaeEhpWSDsdg26rjx1nz4dA0NcFzZK2p%2FBPfPIFzRvmoXoWFigpUnwryEoCqX%0A%2Ftgmcrv7PqiYT5oziPmMuBc1lb7icI%2FAq69uXz2z6%2B4MJHOlcTEFygV36J%2B1%0A1opcjoX%2BJKJNn1nvHovBxuemcMwriJdmDj4Hmfo4zkd6ryUtGVrMVn8DbRp6%0ATWB%2F0MSE8cmfuiA5DgzdGbrevdL6RxnQDmalTHJ5oxurFQVoLwpmbgd36C4Q%0AxMfG1xEqFn5zvrCTGHg2OfS2cynal8CQDG0ZQCoWwdb0kT5D6bx7QKcuyy1%2F%0A1TXKnp1NamD5Uhu1%2BXuxD7EbvDYUWYh3bkqgslsoX%2BOUl%2BONdtMD5PswArd5%0AKisD9UJuddJShL4clBUPoXeNrRxrU6HqjP5T4fapK684MeizicHIRpAww7fu%0AZ8YtaySZ%2FhoOAKWsx0rV4grgJV7pryj4ARBRa1pLL9rBwUwDS1ov%2FOYtlQEB%0AD%2F47fyD%2F6BvepqWmZXj7VLl2y63eE0b%2F6hf5K%2BIzv5A%2F%2B5l%2FEnjFx0rq%2BqeX%0A6hftYZBUAbbBvKfxq9D5xsWg3tnhFv2sYIE3YpkCSzZpWJmahHwQOVNT0ASw%0AgbO25OiTPlYPqfSkGYe0palbL%2B4T5dLOwVilmrZ2bQf%2FrLePwA4RQpWDPYio%0ANDU0Xfi7TQcHQrZTpwFbVzNPXgCHnQkqF%2Bs0v8RDJHnt9vVs2KEpi49V%2FYgN%0A%2BgZnZOeADL0rbre%2FPrIck1YSjZLbrWtQVk4%2BsCf0TjvixJ7MNjA4NgdZPo0M%0AHke%2F9XBFie3NiZaW%2FcEIVZ7WnjB3IbhkmOMJd4LgdHKgmswJwCYm%2BXvpOI19%0AFzU1vzZmfOA1nEJSuuCDNVUoKYIQA5UEYJrVJeGnVN5sU5jkdlX9xPtYceww%0AYFmLisuf9Ev0HC7v27KwYQRDPNYRA8GeK%2FjY6aZdg%2BVccsnzEigdYL5Tm4JI%0AZrxp%2FG807bZvt0yZwWh0gpWOFgbVgrm4Hpji5ilDyulZSW%2B8nJxB5tDoPzL4%0Aj4w9malje0c60GWNtiyCPLURyN63C2q144UpQjSU5r66oP1yF2A97aXKbf4p%0AqO7cSNWEOTpqJkJrNFVKQdWvXZ%2BmvW1PQFmkkwish2HiQIXmWb04uV1pI8hR%0A6YWk2ox9aZiJ664MpncgyJ5uIMlzVfYrX%2BAZRtBW36RgCTprIv6l1M5NcHMy%0AzEscTaSY%2Fe%2BpM5HzQKSzX%2BzHLa5kk5L7veX%2B1G33saiqSJ%2FfK13%2Bk7qDNZQD%0Anbtaebfh2JS0Pdbub6FUFjPHR5PydU9ltuppGEeYrOe1SxwiZ6BZfIXO2%2F8M%0AhA%3D%3D%0A%3DB%2FNE%0A-----END%20PGP%20MESSAGE-----&message_id=166b194b21a0997c&senderEmail=&is_outgoing=___cu_false___&account_email=flowcrypt.compatibility%40gmail.com"
      });
    }));

    ava.default(`decrypt - [security] mdc - modification detected - error`, testWithBrowser('compatibility', async (t, browser) => {
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, {
        content: ["Security threat - opening this message is dangerous because it was modified in transit."],
        params: "?frame_id=frame_obvAUTGAJU&message=-----BEGIN%20PGP%20MESSAGE-----%0AVersion%3A%20FlowCrypt%205.5.9%20Gmail%20Encryption%20flowcrypt.com%0AComment%3A%20Seamlessly%20send%2C%20receive%20and%20search%20encrypted%20email%0A%0AwcFMA0taL%2FzmLZUBAQ%2F%2BKvSED2vb9fJMQd6lRTh0idC7srhg4ESSf4ggCXFE%0AdeOq2IkV5dNhgWGGawFVVUTewMh3L3JklDoONlatBthc2OGNu%2BFyu5No7hhG%0A3Jq1GkNwCqex0%2BG%2BGVhlZfN2LOAx855H9m%2FAGxYo6KLU%2BROmPZV8PZo5YJPr%0Ar8TrhhfHF%2FPG4ZmQIcuvPI1e0ivgF74wP4cG0qaPEacvSxQ1ZuDwzdqC1kGv%0AseOTJEhpBG%2FD8YfbzUXVrX4GiOzIu2OhnlKfU6c0BJCTz%2BqmQRqYOZXLvKgd%0AnU0RzfLgMsd7Sy1lCpld1syY3bT4l0FIRWUtVx1NrJ7cluicEPDiqJsEZntS%0AYy1ViiRZlnk2Xvx1Qpsh7fifUS8e9gfwPevYFhZ%2Fb6SeqpRFRDFGa0uP9L5C%0A%2FCcWqiUaLUL8nF51CYzfIMeIEGBk0TiVUAn19mkQTFbtbIB9K3uQHjFzgnrL%0AnLaJ08Eme5NugtJMUIW7bgo4CAddRjj0isFsoesUv75%2FmEsHJ7JRPICnWx4b%0ALPKOyP0anN6TYDgTC6IqvMOoNi0ZPEIpmGmf7ZOWjR4eUT%2B9uBmBHEPwGbLQ%0A85Mcjy1C7X%2B0uUkIPsqXgF7Ya%2FpwTuZ8mDtF%2FFU3kR87y3jlDZ%2B3ltq%2BY%2B5A%0ABJyMGXGf24%2BSquE1Q%2BONIzBwBqwXuYvRJwqA9vOtZ1PBwUwDS1ov%2FOYtlQEB%0AD%2F0R6LMWFQHZQCIFkvXcB5r4X3J68tcLffAIVs%2BJnoyR6JECUuCZJdKLc4Aa%0AF%2BA15GKiOnf5Z8RIg3Fn3nXuyN5rlWOu0yOO%2FXrnCSMHiYErTLUO6%2B6V6%2Bby%0Ai%2BPOAtAWptnJ7rGSAy17ZgIYD9WNPdX8Bv1fWEOJII2rj%2B5CVyBsOZWrnlnP%0AHjHOQ6gHop7bnQlrpmpA95PLhyoW1LkEIoC0jgrGF%2B0QXRqEfdwpQBCklZyL%0A%2FWAsG2GJLrHUgQALgpTys6%2F5P7VP%2BVSOaEnOJJExIZPkRVRFzWlYq1avgJWw%0AEFGmKeg335%2FiThKBFQ8JsH9U22G5DD1BcfX%2Bqtm4n640zC5pHRpLJO6ggiCJ%0AZA1SCtq6TBSF1FTa158ZNgjkiGZfS%2BoZvrMW%2BS1691vMmJrwqiRlPg9PXCA%2B%0AouGrU%2F1FVyRKGx1%2FUki%2Fh9SaxDX%2F3uHOOwJzytNxGMJP%2F4Y1Y6hbDwDzcrCM%0AFlFHXiNbfB3uxiHD9wWHE44z91MkqOb7%2FajoLXA8J8U3KJGFa%2B8JkZleRVnq%0Ar%2FUT8ppv0%2FozWzV59mTulYzRdIPSy6r4V0bH16XGwZtHVrljOi4TrkExB9cS%0ATdcX96RMMYpJ7p7dGcxoHaRBY120BD%2BsJ51jGi%2FYupoZBdbg7KcOAEelD2%2FF%0ALM1LzR9f3HUaYyKvdPL%2BC0OwINKCAZBPShfECZOiqrNWgHLWddAdXqexZFLH%0A0y7td11E7UNcCZegIlwOYksW7yuuCZ2ZLLnfx%2Fu1G18nKBCealqNkaow%2FPj7%0A4q%2B0UYxfZnAl%2FrFuTK9ndd8tWMSm%2F6xzWEbqe%2F8NKJrCwk%2Fnu%2BpvF%2BMuRvf5%0A9DuzZFiNRQSjSxSYvkyLuw%3D%3D%0A%3DvxOj%0A-----END%20PGP%20MESSAGE-----&message_id=166b194b21a0997c&senderEmail=&is_outgoing=___cu_false___&account_email=flowcrypt.compatibility%40gmail.com"
      });
    }));

    ava.default(`decrypt - [security] signed message - maliciously modified - should not pass`, testWithBrowser('compatibility', async (t, browser) => {
      const acctEmail = 'flowcrypt.compatibility@gmail.com';
      const msgId = '15f7f7c5979b5a26';
      const signerEmail = 'sender@domain.com';
      const params = `?frameId=none&account_email=${acctEmail}&senderEmail=${signerEmail}&msgId=${msgId}`;
      await PageRecipe.addPubkey(t, browser, acctEmail, `-----BEGIN PGP PUBLIC KEY BLOCK-----
Version: FlowCrypt Email Encryption 8.2.0
Comment: Seamlessly send and receive encrypted email

xsFNBFj/aG8BEADO625P5MArNIVlMBPp/HM1lYD1gcVwgYl4aHuXohDMS6dv
VAlSDXMVWwbsXJ9T3AxYIL3ZoOFDc1Jy0AqBKhYoOYm5miYHpOQtP/M4V6fK
3rhmc8C1LP1JXuaEXS0w7MQig8JZC08ECUH1/Gnhm3tyacRgrAr13s591Obj
oP/kwglOUjKDYvkXXk9iwouU85sh9HKwC4wR6idFhFSnsl8xp4FI4plLQPTy
Ea1nf3l+oVqCFT5moVtsew7qUD5mWkgytEdr728Sqh5vjiO+lc6cjqb0PK77
DAuhTel1bV5PRCtRom/qrqmOz4MbE5wd2kU/JxFPIXZ1BKyicT/Q6I9MXjni
77Bl91x0V9brnBqyhfY524Vlm/2AEb3H9I10rsTBtU4TT+SJOlwyU1V7hDkJ
Kq1zTrVjCvoPcTBXGx9xSZmJO4TI7frNZFiJ5uiYwTYPwp3Yze69y/NORwme
ZlXtXJbzpVvRzXUzex89c6pFiKE8mC5/DV/eJanBYKgSyGEiHq9U6kDJrTN4
/fSjiIJ0fWK3bcYwyYUbf9+/JcLSo2sG259FuRF75yxIe2u2RLSh62plEsyb
cpD545pvlrKIvwg/1hio999lMnSjj+hfNQ7A+Xm5BWiSzrJ1fR1Oo5rq68kY
1C4K8FUQwP3zEF2YDoqbBEnYaxaH7HUcbc34xQARAQABzSlDcnlwdFVwIFRl
c3RlciA8Y3J5cHR1cC50ZXN0ZXJAZ21haWwuY29tPsLBfwQQAQgAKQUCWP9o
cAYLCQcIAwIJEAbKVT7CRV1wBBUIAgoDFgIBAhkBAhsDAh4BAAoJEAbKVT7C
RV1wL8EP/iGk15uGa6gNYdjfoGElIjZCyp1VWTU3VSkkQhLxzWWmB6mQyuZj
vU0SpW89OGyJXoX2M7dDFuuQJmZub7adek0810FaRb9WBmxRZKJe6kdnIc13
Z2zgs9e9ltHCq1rvHsVa+F0dQu0elFXJJbX6LqvyRnuKQxcGLIZbi/GXswgl
g3p6OsuSSSa/fKGylrUjMNPtF6jKhbEz9/5Be+3Fn3memhO07oKtr0SFYNQr
mg2Sp6xmDwVm8GGQO69DEyxBzDZtzVhnJgOgWcgKli3u6HBvvg1pVwtgLEnF
KoNug9qZoeNPPdv4ueHnE4cM1ZrWsnFqLusexO4RKgxhnQ+UaK1SeRahDKuD
bAYreN5aFex6KNUeCFum1QDSKhRlL9FUtDAPPu3HtVDfbWgu+tn/YnUXzQWN
MovbuYaIp0qyaC5f+PPZ4cqi++B8npUoIStkLrGrxwnvQVbB0fh9JMLMwzLV
4wwSbZCkSPRXCv0H71ODr71SjTUm5M9c2l6xiNmDruKdwhyvmkApbkdz4ZXV
VEg0e8E/2rH1sTB+N47h/gtJF6J0asnu3A7Pt8IuKn6ycPxmLcAtCX82vzpc
rshPtQJVaRASle4BvuoikyJdhuQ5wTf7XX3JCzUrGA1W8u/mmVdwrVb7oX3g
IzfWJbjamWQUg6jspvPAVLBBSzncwS22zsFNBFj/aG8BEACilSpjULG6TZYb
hWcnR46n/gGgQULCW/UO8y0rlAAZgS1BvfqIUnW9bbCOTBKuy3ZLMtrBeCrG
OigR4NFSuDXbvCks3lRZYBEsos68rf2vCWnf3Wro2HSeX5YlceOl2ALlV0To
XrND5aWvGkBsFLpm1f7NiDV6qPB8A5HtFCONvpPzhtkpJIixk1NlEtzjJPOW
1qKh4vX2JJjO2EyUbenSYMI6nr3yLxBVI4d4uoqRUsKfgdbkt/0x7XP4tOus
FmcCFm9GdZ7AIVaYpC+nJGi4hIZL1BJC/5qk3yL9MCQLALEb1ymb5jvKkKyq
vFEKwA43zEj/+LHKIYrsIz0WKqbdzcqq5YgnE0VmUwS14+8NRNpuGXAHkVBR
b9S4XCz5Ed7gaJsWqCqm8E+g+uLM/ml6KSDKKXLFhX+uMxZ2AQCTe7WDpiEE
DB+WmRjVfvL+rlrz6YBMwBULrQ1Fa9rbQCH8ivhz7ue6RzgAedTfpdOHp/Vl
3lJk9XKqamlwClfXBB96EZKQUc+cGiFtS5hJVm7m4xFimXywfDYLxjLANJTK
rGmlXVdLMKHoUB7r1yEL9XngSyv7AC9/1QkrTMJFvIH2i/PmxCgyvpeCXdZo
V2vlQMs0wBLE08gGmD92NX0efeSwPGBwbH7uLoGM6nO/+9RMbxPu0vJHQb9M
DonpFrO81QARAQABwsFpBBgBCAATBQJY/2hzCRAGylU+wkVdcAIbDAAKCRAG
ylU+wkVdcMWLD/97wA3viAjYsP7zbuvfvjb9qxDvomeozrcYNPdz1Ono3mLs
czEHD4p1w+4SBAdYAN2kMFw+1EaRBQP23Laa28axhKDbsb8c/JvY5hIt/osX
sxA9seXRES8iPIYq8zSNXqx8ZADUOR9jkR1tAhqpqYHvcZmsbW+bBdhHg0EV
ge2qEPFy84k0NOVM1Fwj3nsblym9ZLrx3YWQIceVJGxl0u3UmSdNpR0JgCuC
QlItExJY8DBYMVmk8kkd/uWQSBTWq6qXf/vARKEMqp+aA5gPMFngrQfL/yNI
emIRaWAXoXwqXQcJGz4BGGgBuX8zjldvT5sOnfTEokygeSg7K95ZlbPYwdvT
QhLMOUoQF7YysI8l7qIdUW2qM8zepn3eHIhpgq7QfwdzceWpgHma683zQUVf
sU09dzg2IihGnk13oXaq8wye4P4Cw4oKBDgpxNrwmh7j5wnxtreuLMrjmS0+
+8k3NJ4HpmP2tIiIX2JThrj1ANSb2bMZIvH+kW0niR8WqJWzqG1u2hs4EoWN
RWuEm0qwW6TtrChMDpyX3K135ID5TFJ2pvpwUerliNH4LBEAbQcXZt13pe9i
1mePDNOQzBhDMbfRA8VOnL+e77I7CUB5GK/YQw1YoeOc1VamrACkYYfMVX6D
XZ8r4OC6sguP/yozWlkG+7dDxsgKQVBENeG6Lw==
=1oxZ
-----END PGP PUBLIC KEY BLOCK-----`, 'sender@domain.com');
      // as the verification pubkey is not known, this scenario doesn't trigger message re-fetch
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, {
        params,
        content: [],
        encryption: 'not encrypted',
        signature: 'ERROR VERIFYING SIGNATURE: MESSAGE DIGEST DID NOT MATCH'
      });
    }));

    ava.default(`decrypt - [everdesk] message encrypted for sub but claims encryptedFor:primary,sub`, testWithBrowser('compatibility', async (t, browser) => {
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, {
        content: ["this is a sample for FlowCrypt compatibility"],
        encryption: 'encrypted',
        signature: 'not signed',
        params: "?frame_id=frame_obvAUTGAJU&message=-----BEGIN%20PGP%20MESSAGE-----%0A%0AwcFMA62sJ5yVCTIHAQ%2F8CkcWeLmCy8lvANll0KbA9ymThNOmZjblBNRZvgT8DqaL%0AhaGXzHaMGHvi0d66P38RXfDc%2BH9l%2FjGtdS1zgiMJMpCUFtDc3OPgOuA93sReqBsq%0A7fv5a%2BLSdfFZUPgUkXM2ur0eA%2BniNE%2BG3mbDcr%2FcuILYI8xTs6xbHRIKVl2G09eS%0ABZMEyqH3duIAi0M42r4L%2FuvABTcEyVKvY%2FQHFmFTj1tSzqSD5PDv%2BnN0ihNR16R9%0AN56PMcZazvTdChhXuA3MNciKoJtbZ785c%2FdwRL8bz8rr7Wj6iF%2B3Qm6kgbkef%2Fo4%0A6D8u8G1eDfSWuwtXVqIOuokd%2FmYgNIVZwt1sJukuGv3eL76b7Mhk3lCEjE8uSOf9%0AN9mbLErel5VUTzNTVpA336aBnMKjEsJUIOg0sU0q8XAKeSjcrIuBrsaKpjq7WDXp%0AFA2eQkpHpwZnlWjVMOYRREdji3G%2Ft32ATTchNXl9zhQsioqQbfUtWkj2WvltE5oz%0AO85ddVUniqpQPdQaojZ5%2BdPZ8SBC%2F4eUp3z4J4%2Fb0fWSTPl%2FtLblFy1HJs0lKG5Z%0A8AaoCGF5TLPoygXjBk0ImikeIGlYIShVOqG36RJlMh4xOQCmY0g9nz9LdCEHJ%2BuC%0AkWh%2FoREBhSMnqlmn1ic%2FDG16h17E%2FtiOuOxsqTfIGlkLSShXDoiTjxgm527FA5HB%0AwUwDS1ov%2FOYtlQEBD%2F9f6jwJxYjdBo2pUy5c%2BgA47BtW%2Fzz12MKhRAHd%2B%2FbVbTv6%0A5JhlBw1Jow0ckjcbnDRqBP9EL%2BErAlc2UzGa%2B42Ahrc2HlDvyMJCcxLt0Fa2nhXG%0AYWGHsQbHxgbePWHozwun2RXaAvvBonhBaYtcn0QPNEtArB9uyO4YqXXoH1%2Fl0%2Fgh%0AIAzuR%2BLNymwdOBXpyiVFMJb6xyQF40aT31kI8Ge%2BUkBbkWDphcEPogd59krBEpwz%0AfBfPdlGoTrSwfbKbshM0kiEbPh%2BESMVvypg%2BPZo1Qp0eXYt7gjlYYqNzQHWobTTr%0AIQjY3T8vml7XlcPzxLFqvQliuIZyRLczvm%2BwDhTj%2BJ%2FdXAK0SHE%2F9XdqKY014j5t%0AWjUfy9iD6seZ85ntAWdxHmOkytANe3QfyVxbO3N31nFe4uqJmW0RaEDx0em3k9YM%0AYLe5OwK%2F49IpUj5gV1R3wnN0uNOZNOdhkyVJynLDJXV5DLoWO3yGMPM3iM%2BZGujk%0A4QrpXjVFscfTHy%2F5%2BbNFGHnapljzli9cbKqt3j610wLQa1pHj6K3xJOANwr0Vdjy%0ABFGwpREQDPceSNREFA%2B7FdPh7WQe7P5NbfYuBXGZZeIvRZ6R0EHi8Agxn1426qYJ%0AEJNr%2BqO2r49EhfCdwbizRLhBsqMJQIirkf5sI4w5RIgpI9ggkv%2FgQiqxvqFcDdK7%0AAVK%2BeZiB2bvY3SVaH49hWaCE1OZ28gDYPlce6ARxznq1eqQhvgUyOffjpDjPgSkF%0AQhQCj6%2Fle9lunPkNKEYUhFr2eBBabBejRAsdLTOslG3yltICpBjHGqOB2CaDlHgL%0Aa5eoeqHusBAx9fmYtd0Zi474cGay8RjGtq%2FE%2B8wDTsupnYGbsHF5pDXC7erW9gyZ%0AMzIE8wAZ%2BIxbhG7JXVtHaPWAbvl1ac7YBV7rpBYRKuvZvDQ9BL%2FtYy59HA%3D%3D%0A%3Dt1CY%0A-----END%20PGP%20MESSAGE-----&message_id=166b194b21a0997c&senderEmail=&is_outgoing=___cu_false___&account_email=flowcrypt.compatibility%40gmail.com"
      });
    }));

    ava.default(`decrypt - [pep] pgp/mime message with text encoded as inline attachment`, testWithBrowser('compatibility', async (t, browser) => {
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, {
        content: ["Subject: Re: Test from Tom iOS", "test again", "A message", "Testing"],
        encryption: 'encrypted',
        signature: 'COULD NOT VERIFY SIGNATURE: MISSING PUBKEY, MISSING SENDER INFO',
        quoted: true,
        params: "?frame_id=frame_obvAUTGAJU&message=-----BEGIN%20PGP%20MESSAGE-----%0A%0AhQEMA1HNSU%2BzzjQFAQf9GFHItnUD5A%2F2Abbh1qwdUdsl8i%2FhsgPwhONes2FIKxTg%0AsK9QbZSEBWh4GP3pPAaM84NvWEI%2FZFPR6Oy%2FYEOakzO681o2mk7mnf6doGnAy5P4%0AUqOoRCYuMxziyooMsWmwNqQLdazv3b5CkpT1uQjGjw9no%2B4038g2UZdyVw4w9m%2Fn%0AK65OHg544PcR3vuLZTiV%2BujQiwDsUddXYcbEOu2jZj3%2BwT6QZ3UoAni4VHQgSjBj%0AaVBgVHpGnBvTiMf%2FV3rEB0btPbBH2I4pE0ZEklXBCL2sMLz%2BGPQogo3FCTcT%2BBqL%0ALJ5AFFm%2FhXBNYg4ZXRl%2BgOhSi9NswPbQyWQ2OeJdDoUCDANLWi%2F85i2VAQEP%2FA5%2F%0AQqa26qcp1yeM%2FGBNMX7NeaZo0RrCqvBUho7Y7nwuwdMxpyN9mnDzcHPdgxe41OZ5%0AmKDD%2Bgjl7RHClEZBFpSxhc7pi4wIiodlIZ%2BGo3g9%2F7Z7XC7erewnc6BHSTrE5AJa%0AW%2FryxsRDrr9FzR1P3aHqssGXfD4J7%2B3BFASznQKPPaS8e%2BBj2ib6ZdKCyQLRFHZa%0A18RZPF6PprQ4oty%2BpqB8Jv8YTFCWQaYQYfVJLgO6pqwZzReOwcSwkipIraMoBSVn%0AsqAeup4ByOVYWmAhxvN5JP621cHPJbRcRgXqC5%2BRvSW8H0lxNVla7X755PhH0ret%0AKj4HR1o1PAJuPtdh0JMg0LSLiuOaHjfg1w5RtGE7ZyD1CbnF3EfLRmRTY3cLRdVV%0AJBvKj41lSd0EStnGxC2YaRTc50dzwE8ZF%2FvTzQbHc469AYvCOjECQW4kYNgusUia%0Aip7l0y2LYtm7S%2FWkNKCDoFF7gVGNOgtIM4nRlmPqp4D2tAGr3523RdzlRa8kQopo%0AqAHmLrS7%2B8HGESgzl452Pi2crm3J8wOTm3SyZOF2Eg7cyvbC75tNDWzK5ixs881X%0ASKNA2ti56JYd3Mg6Qi%2BsqdgJLLtXbsG0JB1%2B7GcBEVldmFBd1VAlM8cwJt6VNb%2Fr%0ADX4Sd5XpF9WyQbQuM9Np0Qi04UCrsnplG6ZaeJxQ0usBr8i9WKgr6EZg9CtNMD2i%0ARtx6wsjqbJ98oMFsDwGT4xauImVej8fiZiyiL4aJWb9RwLTwhNOjd%2Bgv9Ccw1zaF%0AAb%2F3ECc%2F4k%2FQgvPzWl0epomyZMNfYnw6KS%2FLfYARxJC3ckSFxrevPCfX19528WUC%0AdZ88bXAj1J2ktdDegMNlaltdevgz6uP%2B1dA%2FIYrr169AuOz0qsGhuXYSroa1kEhs%0AvvYB%2FpR55gme%2F5TouKH8baw1rK8tCHtn8N%2FUd0pjrc2P169LRt6SYoVqvvueYKdh%0A9rs%2B8KMdqlvzt99Qj9OcbjRIDe4TaoKcOaSFl2UhuMDWVHkgHDoEf4J5Pxb%2B12HW%0AKaxkKAIEZ7rOC5zS7FO3RfxRtQkXQ9TSZGQl1lRY78IJuDA9JByUKpmd7LuCMLJL%0AjE4b6mFx2lKCBFwoDVyPorr%2FkMvaA8idYV%2Fbj4gmiqaVMELjL58lOme%2FLRFFkV4F%0APXifXSeZG3od9bzCwN%2Fbj%2FVv1IlVL5tmh0%2F0FXinUM1LvIq4wk56KuDxCEM7LcTz%0ADyBzRt%2BW3qGiEeq4g6OKb%2BZL6izxBQTV9QW%2BBFe1oHByw9HIb4HStoi2g4ptUDwv%0AV0bvJqBGYfsTkar%2FUw%2Fm5x6CcW0hqd0pfzqTMIah87tNpCg87XTl0F%2BCt0Zbony9%0AzK9Emew4OB8QbVua4EhQlk1lFTw3kQzsmRKpuFrPac4vDI8jltzIfz6%2BCzNNE85m%0ADMiZUkYSgvuv6CRV2g1raAkVGx%2FNdkDdrc7wvM095A3nbfqnTbLYZ9162WRroCuK%0AW428mzpZ2ABLrRKYwGpE7iS%2FInXjyhrSoWRWXaHbUqpz9JS%2BuLhKOtWuony8T1tm%0AGezGvqZGnubcuGkRFgjELDxsgZG9GJ29r56UZ3ImsMXq148B9t63yW8VafVR%2BJvz%0Aywusa5FgAO69nLE38eAW8YpOgRy4swkowC5So2OWfAoZlTVxZpjpUSDTwXa4Uags%0ArnafwYtnU%2BR4fFt9FIoc6Ty3HvmwVGDV%2BfcMPrvzAfLuPgjNXPS7lB5BuZ2foPQP%0A158WD%2B%2BQoo2vDeTE8HOVpZBak595qJ%2FA27kMJrHPqKLcE9tVWplJ16%2FDVX4ceCs%2F%0AJ0viBtaPA19IHnBmkKyKvX3U5iXnLlwNlxwEdACONWbD3Y%2FwcpABwzeQaDJmFnoR%0ADQ77LtvRJodo34BWLYpx804fVqhQ0XyMaux3V9EeIhnTjFguWQze%2BA3gCYbKpVu5%0AQBxJsZagBOWtyVi8u%2FIu%2FxfaZzr%2B%2BzNPU9CCOuEQHK3H6OYjBSWLYOdYG6l2irUP%0A4ARDU0UKuWrRBQIup3y1EUJzdd6zYXBc5Y%2FUrk0VsikCzYOhXxC9H9W3Fn0pYCft%0AW5RlK3p8xKlRacHTlp4wtACvIuIhwhGDvXFe1iU53GfaKm8ZFaHcA7cbDpNTEvk5%0ArMO%2F0vlVxKmyOmgtnkFcgxdyi6vwp6hVMa59toPYqvZYitYRPcyOGx%2F%2FAITDCPHl%0AylTQGm9JCeG3kts8HC05N2QXKeUxhjHorOwhRc6anjmOdBba9z%2B6aK4Pv%2FJp5693%0A24vVNBIe4HlGmf4fAbPLh%2BG6GmN7QAD3z76RYubPmlFFkqqhIkDCc1awSySnsb06%0A9ZrS1kzcnzK8If2ejyL1n%2FuIx2koQp3LQTzZyCtoq8ho7ybdBhxVK5UfSxbAnJoj%0Agb7uTK1C6qh7iqeYvptt9tmcaQKPBOLIk1cpS9kScfTHTtdE9vqna733rx0kjEK1%0AjldIKwxxi5cc%2Fhd3DfsWQ4gHoprZdXdiUMLJqQTpDmVubx2vIiRAarkMNpd8hsy2%0AYFXUfa%2FGiNl2ax3UIX9zMDkaPESBLcjIcUbu%2F0C2YpDBBLKiwxm6QF1vbn5xOGdN%0AFtoraIzWsN93vJskaNAzi54dd2GL%2FAIVNg%2FhopG07B6Iwn5ZVYIBocAC40FmuQz2%0AyLpplIGqeQ6WSegRfRn8dpbii8IBpgYFrxiAD7uiCrZ9yP17hz%2FMhnXBgBBS9wIl%0AurfPaTitmEP7TaYQTpu9GKPtNjmREC0PN%2BoV7jvIofF1Z3s%2BJSnWaZvmLprcvCqD%0ALYplr%2BvCPeMyuSgLyAnGkmHCliKTGoqF%2BHQYXlPMuQcyoA41rIcQlVCv%2BlguzSDF%0AQNhBm8MKI2vaPTm0Y7hXgsDZ1stYftKC%2Bti0ge4vcelhJLisEYEeEMDNgoS%2Fw%2BLt%0AilRS8eJispykDW7GWdMog2La8wZRe0RH%2Fkcuj04IZTjYcLMxvmgk6zCFOlxxyF7I%0AcUJT%2FqKq0LsHyMABziErSsHJHij1bOw6sCaREXvTf6tDK86vNzuyBHTWVGqp1rZ9%0AyuhRuJ36EdbzuVEd0N6Z3RX4PQuG%2B4ueBfhbkfgLJrGJdTfNNhpVXuajv2ixJdU9%0AfVt4NQr2zIcdV9XNAdLRLuhLU5s5kl8E%2B2lB4%2FVWeb4ZA1oq3hCUIpJnZgRJgqSG%0A8%2FXD9%2FlZdzveihMaIJURQBWk2NbGnALQVrk2AjzspBonM2TbH9VugqzWNS66HUYf%0AE1tN0xe%2BahUhPDlD3GmpE5%2FgBnSUt%2BkQNZm1TOP7gocsOteLHfG31uAbXXACsM52%0A5BX%2BPrsnaTohmXnkFhkqJYtEjlsHI0rcUNQf0%2BueuctMyskb81MxCpP4aodpEuNC%0AtgEqwhgnwbiL68JRaao3Z6y7lbfREvJ0P7gevn0iwgtgdrP2nJdS8eUNQumRCYMs%0Am7qKQ28p8fuZ6f94oINHAoOJOe1wMD4j9vRftPtJU6sKT39ynHs2cylbYkFAqTOz%0Ai%2BRhdRbeuKybMoEx%2FSxfoEHh7RABWzN4DI9w2WhdH7L0hByuBT2GRocZDTYjYerh%0AaRrP6ZC4meeooFzGnurqgKIdEd5e76iYjqnVML1E%2Bw%2BCJSRDqhgG55z465ewZBdp%0AFEB%2FyQ%3D%3D%0A%3DVMeb%0A-----END%20PGP%20MESSAGE-----&message_id=166b194b21a0997c&senderEmail=&is_outgoing=___cu_false___&account_email=flowcrypt.compatibility%40gmail.com"
      });
    }));

    ava.default('decrypt - by entering pass phrase + remember in session', testWithBrowser('compatibility', async (t, browser) => {
      const pp = Config.key('flowcrypt.compatibility.1pp1').passphrase;
      const threadId = '15f7f5630573be2d';
      const expectedContent = 'The International DUBLIN Literary Award is an international literary award';
      const acctEmail = 'flowcrypt.compatibility@gmail.com';
      const settingsPage = await browser.newPage(t, TestUrls.extensionSettings());
      await SettingsPageRecipe.forgetAllPassPhrasesInStorage(settingsPage, pp);
      // requires pp entry
      await InboxPageRecipe.checkDecryptMsg(t, browser, {
        acctEmail, threadId, expectedContent,
        enterPp: {
          passphrase: Config.key('flowcrypt.compatibility.1pp1').passphrase,
          isForgetPpChecked: true,
          isForgetPpHidden: false
        }
      });
      // now remembers pp in session
      await InboxPageRecipe.checkDecryptMsg(t, browser, { acctEmail, threadId, expectedContent });
      // Finish session and check if it's finished
      await InboxPageRecipe.checkFinishingSession(t, browser, acctEmail, threadId);
    }));

    ava.default('decrypt - entering pass phrase should unlock all keys that match the pass phrase', testWithBrowser('compatibility', async (t, browser) => {
      const acctEmail = 'flowcrypt.compatibility@gmail.com';
      const passphrase = 'pa$$w0rd';
      await SettingsPageRecipe.addKeyTest(t, browser, acctEmail, testConstants.testkey17AD7D07, passphrase, {}, false);
      await SettingsPageRecipe.addKeyTest(t, browser, acctEmail, testConstants.testkey0389D3A7, passphrase, {}, false);
      await SettingsPageRecipe.addKeyTest(t, browser, acctEmail, testConstants.testKeyMultipleSmimeCEA2D53BB9D24871, passphrase, {}, false);
      const inboxPage = await browser.newPage(t, TestUrls.extensionInbox(acctEmail));
      await InboxPageRecipe.finishSessionOnInboxPage(inboxPage);
      await InboxPageRecipe.checkDecryptMsg(t, browser, {
        acctEmail,
        threadId: '17c0e50966d7877c',
        expectedContent: '1st key of of 2 keys with the same passphrase',
        enterPp: {
          passphrase,
          isForgetPpChecked: true,
          isForgetPpHidden: false
        }
      });
      await InboxPageRecipe.checkDecryptMsg(t, browser, {
        acctEmail,
        threadId: '17c0e55caaa4abb3',
        expectedContent: '2nd key of of 2 keys with the same passphrase',
        // passphrase for the 2nd key should not be needed because it's the same as for the 1st key
      });
      // as decrypted s/mime messages are not rendered yet (#4070), let's test signing instead
      const composeFrame = await InboxPageRecipe.openAndGetComposeFrame(inboxPage);
      await ComposePageRecipe.fillMsg(composeFrame, { to: 'smime@recipient.com' }, 'send signed and encrypted S/MIME without attachment');
      await ComposePageRecipe.pastePublicKeyManually(composeFrame, inboxPage, 'smime@recipient.com',
        testConstants.testCertificateMultipleSmimeCEA2D53BB9D24871);
      await composeFrame.waitAndClick('@action-send', { delay: 2 });
      await inboxPage.waitTillGone('@container-new-message');
    }));

    ava.default('decrypt - thunderbird - signedHtml verifyDetached doesn\'t duplicate PGP key section', testWithBrowser('compatibility', async (t, browser) => {
      const threadId = '17daefa0eb077da6';
      const acctEmail = 'flowcrypt.compatibility@gmail.com';
      const inboxPage = await browser.newPage(t, TestUrls.extension(`chrome/settings/inbox/inbox.htm?acctEmail=${acctEmail}&threadId=${threadId}`));
      await inboxPage.waitAll('iframe');
      const pgpBlock = await inboxPage.getFrame(['pgp_block.htm']);
      await pgpBlock.waitForSelTestState('ready');
      const urls = await inboxPage.getFramesUrls(['pgp_pubkey.htm'], { sleep: 3 });
      expect(urls.length).to.be.lessThan(2);
    }));

    ava.default('decrypt - thunderbird - signedMsg verifyDetached doesn\'t duplicate PGP key section', testWithBrowser('compatibility', async (t, browser) => {
      const threadId = '17dad75e63e47f97';
      const acctEmail = 'flowcrypt.compatibility@gmail.com';
      const inboxPage = await browser.newPage(t, TestUrls.extension(`chrome/settings/inbox/inbox.htm?acctEmail=${acctEmail}&threadId=${threadId}`));
      await inboxPage.waitAll('iframe');
      const pgpBlock = await inboxPage.getFrame(['pgp_block.htm']);
      await pgpBlock.waitForSelTestState('ready');
      const urls = await inboxPage.getFramesUrls(['pgp_pubkey.htm'], { sleep: 3 });
      expect(urls.length).to.be.equal(1);
    }));

    ava.default('decrypt - thunderbird - signing key is rendered in signed and encrypted message', testWithBrowser('ci.tests.gmail', async (t, browser) => {
      const threadId = '175adb163ac0d69b';
      const acctEmail = 'ci.tests.gmail@flowcrypt.test';
      const inboxPage = await browser.newPage(t, TestUrls.extension(`chrome/settings/inbox/inbox.htm?acctEmail=${acctEmail}&threadId=${threadId}`));
      await inboxPage.waitAll('iframe');
      const pgpBlock = await inboxPage.getFrame(['pgp_block.htm']);
      await pgpBlock.waitForSelTestState('ready');
      const urls = await inboxPage.getFramesUrls(['pgp_pubkey.htm'], { sleep: 3 });
      expect(urls.length).to.be.equal(1);
    }));

    ava.default('decrypt - thunderbird - signed text is recognized', testWithBrowser('compatibility', async (t, browser) => {
      const threadId = '17dad75e63e47f97';
      const acctEmail = 'flowcrypt.compatibility@gmail.com';
      const inboxPage = await browser.newPage(t, TestUrls.extension(`chrome/settings/inbox/inbox.htm?acctEmail=${acctEmail}&threadId=${threadId}`));
      await inboxPage.waitAll('iframe', { timeout: 2 });
      const urls = await inboxPage.getFramesUrls(['/chrome/elements/pgp_block.htm'], { sleep: 10, appearIn: 20 });
      expect(urls.length).to.equal(1);
      const url = urls[0].split('/chrome/elements/pgp_block.htm')[1];
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, { params: url, content: ['1234'], encryption: 'not encrypted', signature: 'signed' });
    }));

    ava.default('verification - message text is rendered prior to pubkey fetching', testWithBrowser('compatibility', async (t, browser) => {
      const msgId = '17dad75e63e47f97';
      const acctEmail = 'flowcrypt.compatibility@gmail.com';
      const senderEmail = 'this.pubkey.takes.long.time.to.load@sender.test';
      const params = `?frameId=none&acctEmail=${acctEmail}&msgId=${msgId}&signature=___cu_true___&senderEmail=${senderEmail}`;
      const pgpHostPage = await browser.newPage(t, `chrome/dev/ci_pgp_host_page.htm${params}`);
      const pgpBlockPage = await pgpHostPage.getFrame(['pgp_block.htm']);
      await pgpBlockPage.waitForContent('@pgp-block-content', '1234', 4, 10);
      await pgpBlockPage.waitForContent('@pgp-signature', 'VERIFYING SIGNATURE...', 3, 10);
      await pgpBlockPage.waitForContent('@pgp-signature', 'SIGNED', 10, 10);
    }));

    ava.default('decrypt - fetched pubkey is automatically saved to contacts', testWithBrowser('compatibility', async (t, browser) => {
      const msgId = '17dad75e63e47f97';
      const acctEmail = 'flowcrypt.compatibility@gmail.com';
      const senderEmail = 'some.sender@test.com';
      const acctAttr = acctEmail.replace(/[\.@]/g, '');
      const senderAttr = senderEmail.replace(/[\.@]/g, '');
      {
        const settingsPage = await browser.newPage(t, TestUrls.extensionSettings(acctEmail));
        await SettingsPageRecipe.toggleScreen(settingsPage, 'additional');
        const contactsFrame = await SettingsPageRecipe.awaitNewPageFrame(settingsPage, '@action-open-contacts-page', ['contacts.htm', 'placement=settings']);
        await contactsFrame.waitAll('@page-contacts');
        await Util.sleep(1);
        expect(await contactsFrame.isElementPresent(`@action-show-email-${acctAttr}`)).to.be.true;
        expect(await contactsFrame.isElementPresent(`@action-show-email-${senderAttr}`)).to.be.false;
      }
      const params = `?frameId=none&acctEmail=${acctEmail}&msgId=${msgId}&signature=___cu_true___&senderEmail=${senderEmail}`;
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, { params, content: ['1234'], encryption: 'not encrypted', signature: 'signed' });
      {
        const settingsPage = await browser.newPage(t, TestUrls.extensionSettings(acctEmail));
        await SettingsPageRecipe.toggleScreen(settingsPage, 'additional');
        const contactsFrame = await SettingsPageRecipe.awaitNewPageFrame(settingsPage, '@action-open-contacts-page', ['contacts.htm', 'placement=settings']);
        await contactsFrame.waitAll('@page-contacts');
        await Util.sleep(1);
        expect(await contactsFrame.isElementPresent(`@action-show-email-${acctAttr}`)).to.be.true;
        expect(await contactsFrame.isElementPresent(`@action-show-email-${senderAttr}`)).to.be.true;
        await contactsFrame.waitAndClick(`@action-show-email-${senderAttr}`);
        // contains the  newly fetched key
        await contactsFrame.waitForContent('@page-contacts', 'openpgp - active - 2BB2 1977 6F23 CE48 EBB8 609C 203F AE70 7600 5381');
      }
    }));

    ava.default('decrypt - unsigned encrypted message', testWithBrowser('compatibility', async (t, browser) => {
      const threadId = '17918a9d7ca2fbac';
      const acctEmail = 'flowcrypt.compatibility@gmail.com';
      const inboxPage = await browser.newPage(t, TestUrls.extension(`chrome/settings/inbox/inbox.htm?acctEmail=${acctEmail}&threadId=${threadId}`));
      await inboxPage.waitAll('iframe', { timeout: 2 });
      const urls = await inboxPage.getFramesUrls(['/chrome/elements/pgp_block.htm'], { sleep: 3 });
      expect(urls.length).to.equal(1);
      const url = urls[0].split('/chrome/elements/pgp_block.htm')[1];
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, {
        params: url,
        content: ['This is unsigned, encrypted message'],
        encryption: 'encrypted',
        signature: 'not signed'
      });
    }));

    ava.default('signature - sender is different from pubkey uid', testWithBrowser('ci.tests.gmail', async (t, browser) => {
      const threadId = '17bfe72dc4aab958';
      const acctEmail = 'flowcrypt.compatibility@gmail.com';
      const inboxPage = await browser.newPage(t, TestUrls.extension(
        `chrome/settings/inbox/inbox.htm?acctEmail=${acctEmail}&threadId=${threadId}`));
      await inboxPage.waitAll('iframe', { timeout: 2 });
      //const urls = await inboxPage.getFramesUrls(['/chrome/elements/pgp_block.htm'], { sleep: 3 });
      //expect(urls.length).to.equal(1);
      //const url = urls[0].split('/chrome/elements/pgp_block.htm')[1];
      // error - shows up as "not signed" for now
      //const signature = ['Message Not Signed'];
      //await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser,
      //  { params: url, content: ['Here is your random string:'], signature });
      await Util.sleep(6000); // >>>> debug
    }));

      const threadId = '1766644f13510f58';
      const acctEmail = 'ci.tests.gmail@flowcrypt.test';
      const inboxPage = await browser.newPage(t, TestUrls.extension(`chrome/settings/inbox/inbox.htm?acctEmail=${acctEmail}&threadId=${threadId}`));
      await inboxPage.waitAll('iframe', { timeout: 2 });
      const urls = await inboxPage.getFramesUrls(['/chrome/elements/pgp_block.htm'], { sleep: 10, appearIn: 20 });
      expect(urls.length).to.equal(1);
      const url = urls[0].split('/chrome/elements/pgp_block.htm')[1];
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, {
        params: url,
        content: ['How is my message signed?'],
        encryption: 'not encrypted',
        signature: 'signed'
      });
    }));

    ava.default('signature - verification succeeds when signed with a second-best key', testWithBrowser('ci.tests.gmail', async (t, browser) => {
      const threadId = '1766644f13510f58';
      const acctEmail = 'ci.tests.gmail@flowcrypt.test';
      await PageRecipe.addPubkey(t, browser, acctEmail, '-----BEGIN PGP PUBLIC KEY BLOCK-----\r\nVersion: FlowCrypt Email Encryption [BUILD_REPLACEABLE_VERSION]\r\nComment: Seamlessly send and receive encrypted email\r\n\r\nxjMEYZeW2RYJKwYBBAHaRw8BAQdAT5QfLVP3y1yukk3MM/oiuXLNe1f9az5M\r\nBnOlKdF0nKnNJVNvbWVib2R5IDxTYW1zNTBzYW1zNTBzZXB0QEdtYWlsLkNv\r\nbT7CjwQQFgoAIAUCYZeW2QYLCQcIAwIEFQgKAgQWAgEAAhkBAhsDAh4BACEJ\r\nEMrSTYqLk6SUFiEEBP90ux3d6kDwDdzvytJNiouTpJS27QEA7pFlkLfD0KFQ\r\nsH/dwb/NPzn5zCi2L9gjPAC3d8gv1fwA/0FjAy/vKct4D7QH8KwtEGQns5+D\r\nP1WxDr4YI2hp5TkAzjgEYZeW2RIKKwYBBAGXVQEFAQEHQKNLY/bXrhJMWA2+\r\nWTjk3I7KhawyZfLomJ4hovqr7UtOAwEIB8J4BBgWCAAJBQJhl5bZAhsMACEJ\r\nEMrSTYqLk6SUFiEEBP90ux3d6kDwDdzvytJNiouTpJQnpgD/c1CzfS3YzJUx\r\nnFMrhjiE0WVgqOV/3CkfI4m4RA30QUIA/ju8r4AD2h6lu3Mx/6I6PzIRZQty\r\nLvTkcu4UKodZa4kK\r\n=7C4A\r\n-----END PGP PUBLIC KEY BLOCK-----\r\n',
        'sender@example.com');
      const inboxPage = await browser.newPage(t, TestUrls.extension(`chrome/settings/inbox/inbox.htm?acctEmail=${acctEmail}&threadId=${threadId}`));
      await inboxPage.waitAll('iframe', { timeout: 2 });
      const urls = await inboxPage.getFramesUrls(['/chrome/elements/pgp_block.htm'], { sleep: 10, appearIn: 20 });
      expect(urls.length).to.equal(1);
      const url = urls[0].split('/chrome/elements/pgp_block.htm')[1];
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, {
        params: url,
        content: ['How is my message signed?'],
        encryption: 'not encrypted',
        signature: 'signed'
      });
    }));

    ava.default(`decrypt - missing pubkey in "incorrect message digest" scenario`, testWithBrowser('ci.tests.gmail', async (t, browser) => {
      const msgId = '1766644f13510f58';
      const acctEmail = 'ci.tests.gmail@flowcrypt.test';
      const signerEmail = 'sender.for.refetch@domain.com';
      const data = await GoogleData.withInitializedData(acctEmail);
      const msg = data.getMessage(msgId)!;
      const signature = Buf.fromBase64Str(msg!.raw!).toUtfStr()
        .match(/\-\-\-\-\-BEGIN PGP SIGNATURE\-\-\-\-\-.*\-\-\-\-\-END PGP SIGNATURE\-\-\-\-\-/s)![0];
      const params = `?frameId=none&account_email=${acctEmail}&senderEmail=${signerEmail}&msgId=${msgId}&message=Some%20corrupted%20message&signature=${encodeURIComponent(signature)}`;
      // as the verification pubkey is not known, this scenario doesn't trigger message re-fetch
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, {
        params, content: ['Some corrupted message'],
        encryption: 'not encrypted',
        signature: 'COULD NOT VERIFY SIGNATURE: MISSING PUBKEY 2864E326A5BE488A'
      });
    }));

    ava.default('decrypt - re-fetch signed-only message from API on non-fatal verification error', testWithBrowser('compatibility', async (t, browser) => {
      const msgId = '17daefa0eb077da6';
      const acctEmail = 'flowcrypt.compatibility@gmail.com';
      const signerEmail = 'some.sender@test.com';
      const data = await GoogleData.withInitializedData(acctEmail);
      const msg = data.getMessage(msgId)!;
      const signature = Buf.fromBase64Str(msg!.raw!).toUtfStr()
        .match(/\-\-\-\-\-BEGIN PGP SIGNATURE\-\-\-\-\-.*\-\-\-\-\-END PGP SIGNATURE\-\-\-\-\-/s)![0];
      const params = `?frameId=none&account_email=${acctEmail}&senderEmail=${signerEmail}&msgId=${msgId}&message=Some%20corrupted%20message&signature=${encodeURIComponent(signature)}`;
      // as the verification pubkey is retrieved from the attester, the incorrect message digest will trigger re-fetching from API
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, {
        params,
        content: [], // todo: #4164 I would expect '1234' here
        encryption: 'not encrypted',
        signature: 'signed'
      });
    }));

    ava.default('decrypt - protonmail - load pubkey into contact + verify detached msg', testWithBrowser('compatibility', async (t, browser) => {
      const textParams = `?frameId=none&message=&msgId=16a9c109bc51687d&` +
        `senderEmail=some.alias%40protonmail.com&isOutgoing=___cu_false___&signature=___cu_true___&acctEmail=flowcrypt.compatibility%40gmail.com`;
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, {
        params: textParams,
        content: ["1234"],
        encryption: 'not encrypted',
        signature: 'COULD NOT VERIFY SIGNATURE: MISSING PUBKEY 7ED43D79E9617655'
      });
      await PageRecipe.addPubkey(t, browser, 'flowcrypt.compatibility%40gmail.com', testConstants.protonCompatPub, 'some.alias@protonmail.com');
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, { params: textParams, content: ["1234"], encryption: 'not encrypted', signature: 'signed' });
      const htmlParams = `?frameId=none&message=&msgId=16a9c0fe4e034bc2&` +
        `senderEmail=some.alias%40protonmail.com&isOutgoing=___cu_false___&signature=___cu_true___&acctEmail=flowcrypt.compatibility%40gmail.com`;
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, { params: htmlParams, content: ["1234"], encryption: 'not encrypted', signature: 'signed' });
    }));

    ava.default('decrypt - protonmail - auto TOFU load matching pubkey first time', testWithBrowser('compatibility', async (t, browser) => {
      const params = `?frameId=none&message=&msgId=16a9c109bc51687d&` +
        `senderEmail=flowcrypt.compatibility%40protonmail.com&isOutgoing=___cu_false___&signature=___cu_true___&acctEmail=flowcrypt.compatibility%40gmail.com`;
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, { params, content: ["1234"], encryption: 'not encrypted', signature: 'signed' });
    }));

    ava.default('decrypt - verify encrypted+signed message', testWithBrowser('compatibility', async (t, browser) => {
      const params = `?frameId=none&message=&msgId=1617429dc55600db&senderEmail=martin%40politick.ca&isOutgoing=___cu_false___&acctEmail=flowcrypt.compatibility%40gmail.com`; // eslint-disable-line max-len
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, {
        params,
        content: ['4) signed + encrypted email if supported'],
        encryption: 'encrypted',
        signature: 'signed'
      });
    }));

    ava.default('decrypt - load key - expired key', testWithBrowser('compatibility', async (t, browser) => {
      const pubFrameUrl = `chrome/elements/pgp_pubkey.htm?frameId=none&armoredPubkey=${encodeURIComponent(testConstants.expiredPub)}&acctEmail=flowcrypt.compatibility%40gmail.com&parentTabId=0`;
      const pubFrame = await browser.newPage(t, pubFrameUrl);
      await pubFrame.waitAll('@action-add-contact');
      expect((await pubFrame.read('@action-add-contact')).toLowerCase()).to.include('expired');
      await pubFrame.click('@action-add-contact');
      await Util.sleep(1);
      await pubFrame.close();
    }));

    ava.default('decrypt - load key - unusable key', testWithBrowser('compatibility', async (t, browser) => {
      const pubFrameUrl = `chrome/elements/pgp_pubkey.htm?frameId=none&armoredPubkey=${encodeURIComponent(testConstants.unusableKey)}&acctEmail=flowcrypt.compatibility%40gmail.com&parentTabId=0`;
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

    ava.default('decrypt - inbox - check for rel="noopener noreferrer" attribute in PGP/MIME links', testWithBrowser('compatibility', async (t, browser) => {
      const inboxPage = await browser.newPage(t, 'chrome/settings/inbox/inbox.htm?acctEmail=flowcrypt.compatibility%40gmail.com&threadId=1762c9a49bedbf6f');
      await inboxPage.waitAll('iframe.pgp_block');
      const pgpBlock = await inboxPage.getFrame(['pgp_block.htm']);
      await pgpBlock.waitForSelTestState('ready');
      const htmlContent = await pgpBlock.readHtml('#pgp_block');
      expect(htmlContent).to.include('rel="noopener noreferrer"');
    }));

    ava.default('decrypt - inbox - Verify null window.opener object after opening PGP/MIME links', testWithBrowser('compatibility', async (t, browser) => {
      const inboxPage = await browser.newPage(t, 'chrome/settings/inbox/inbox.htm?acctEmail=flowcrypt.compatibility%40gmail.com&threadId=1762c9a49bedbf6f');
      await inboxPage.waitAll('iframe.pgp_block');
      const pgpBlock = await inboxPage.getFrame(['pgp_block.htm']);
      await pgpBlock.waitForSelTestState('ready');
      await pgpBlock.click('a');
      await Util.sleep(5);
      const flowcryptTab = (await browser.browser.pages()).find(p => p.url() === 'https://flowcrypt.com/');
      await flowcryptTab!.waitForSelector("body");
      flowcryptTab!.on('console', msg => expect((msg as any)._text).to.equal('Opener: null'));
      await Util.sleep(5);
      await flowcryptTab!.evaluate(() => console.log(`Opener: ${JSON.stringify(window.opener)}`));
      await Util.sleep(5);
    }));

    ava.todo('decrypt - by entering secondary pass phrase');

    ava.default(`decrypt - don't allow api path traversal`, testWithBrowser('compatibility', async (t, browser) => {
      const params = "?frame_id=frame_TWloVRhvZE&message=&message_id=../test&senderEmail=&is_outgoing=___cu_false___&account_email=flowcrypt.compatibility%40gmail.com";
      const pgpHostPage = await browser.newPage(t, `chrome/dev/ci_pgp_host_page.htm${params}`);
      const pgpBlockPage = await pgpHostPage.getFrame(['pgp_block.htm']);
      await pgpBlockPage.waitForSelTestState('ready', 5);
      await pgpBlockPage.waitForContent('@container-err-text', 'API path traversal forbidden');
    }));

    ava.default(`decrypt - try path traversal forward slash workaround`, testWithBrowser('compatibility', async (t, browser) => {
      const params = "?frame_id=frame_TWloVRhvZE&message=&message_id=..\\test&senderEmail=&is_outgoing=___cu_false___&account_email=flowcrypt.compatibility%40gmail.com";
      const pgpHostPage = await browser.newPage(t, `chrome/dev/ci_pgp_host_page.htm${params}`);
      const pgpBlockPage = await pgpHostPage.getFrame(['pgp_block.htm']);
      await pgpBlockPage.waitForSelTestState('ready', 5);
      await pgpBlockPage.waitForContent('@container-err-text', 'API path traversal forbidden');
    }));

    ava.default(`verify - sha1 shows error`, testWithBrowser('compatibility', async (t, browser) => {
      const msg = `-----BEGIN PGP MESSAGE-----

yMCxATvCy8zAxHhitbJOfXrcEcbTKkkMIOCRmpOTr6NQkpFZrABEiQolqcUlCrmpxcWJ6alchw5U
sjAwMjEoiymyhJfeapohyXRUYeazxTBjWJkSeOtDWJnBRnFxCsDEv33mYDjmdsuGPyx68g7tMwe3
tqlevvUo5EIap+wmZm6mRXcOGBplvJy1mfuq1plrt08qs97Y2ztB+/XbuyG3Ir48u7I3pmD+TWae
WSd5d26QYXcuusauc0Xy/fS1/FXbPJaYHlCeMCfnhrF9d2jyH33V+er6r3lS5i/mchOKffpglktT
d6Z36//MsmczN00Wd60t9T+qyLz0T4/UG2Y9lgf367f3d+kYPE0LS7mXuFmjlPXfw0nKyVsSeFiu
3duz+VfzU3HVZ65L4xc5PBYwWLlshdcG94VTt2oK3cuLC5zuy/3ks0sw1+MGzmKtjMeJrqXph+8p
5W5JmHL28qarbQvv+71V3ni6odk8Z2NDban2y1kA
=Ruyn
-----END PGP MESSAGE-----`;
      const params = `?frame_id=frame_TWloVRhvZE&message=${encodeURIComponent(msg)}&message_id=none&senderEmail=sha1%40sign.com&is_outgoing=___cu_false___&account_email=flowcrypt.compatibility%40gmail.com`;
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, {
        params,
        content: ['test'],
        encryption: 'not encrypted',
        signature: 'error verifying signature: Insecure message hash algorithm: SHA1. Sender is using old, insecure OpenPGP software.'
      });
    }));

    ava.default('verify - Kraken - urldecode signature', testWithBrowser('compatibility', async (t, browser) => {
      const params = `?frameId=frame_ZRxshLEFdc&message=&msgId=171d138c8750863b&senderEmail=Kraken%20%3Ccensored%40email.com%3E&isOutgoing=___cu_false___&signature=___cu_true___&acctEmail=flowcrypt.compatibility%40gmail.com&parentTabId=12%3A0`;
      const expectedContent = 'Kraken clients can now begin converting popular currencies';
      await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, {
        params,
        content: [expectedContent],
        encryption: 'not encrypted',
        signature: 'COULD NOT VERIFY SIGNATURE: MISSING PUBKEY A38042F607D623DA'
      });
    }));

  }

};
