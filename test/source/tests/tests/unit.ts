/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import * as ava from 'ava';

import { MsgBlock } from '../../core/msg-block';
import { MsgBlockParser } from '../../core/msg-block-parser';
import { PgpHash } from '../../core/pgp-hash';
import { TestVariant } from '../../util';
import { TestWithBrowser } from '../../test';
import { expect } from 'chai';

// tslint:disable:no-blank-lines-func
/* eslint-disable max-len */

export let defineUnitTests = (testVariant: TestVariant, testWithBrowser: TestWithBrowser) => {

  if (testVariant !== 'CONSUMER-LIVE-GMAIL') {

    ava.default(`[unit][MsgBlockParser.detectBlocks] does not get tripped on non-pgp certs`, async t => {
      expect(MsgBlockParser.detectBlocks("This text breaks email and Gmail web app.\n\n-----BEGIN CERTIFICATE-----\n\nEven though it's not a vaild PGP m\n\nMuhahah")).to.deep.equal({
        "blocks": [
          MsgBlock.fromContent("plainText", "This text breaks email and Gmail web app.\n\n-----BEGIN CERTIFICATE-----\n\nEven though it's not a vaild PGP m\n\nMuhahah"),
        ],
        "normalized": "This text breaks email and Gmail web app.\n\n-----BEGIN CERTIFICATE-----\n\nEven though it's not a vaild PGP m\n\nMuhahah"
      });
      t.pass();
    });

    ava.default(`[unit][MsgBlockParser.detectBlocks] ignores false-positive blocks`, async t => {
      const input = `Hello, sending you the promised json:
      {
        "entries" : [ {
          "id" : "1,email-key-manager,evaluation.org,pgp-key-private,106988520142055188323",
          "content" : "-----BEGIN PGP PRIVATE KEY BLOCK-----\r\nVersion: FlowCrypt 7.6.9 Gmail Encryption\r\nComment: Seamlessly send and receive encrypted email\r\n\r\nxcLYBF5mRKEBCADX62s0p6mI6yrxB/ui/LqxfG4RcQzZJf8ah52Ynu1n8V7Y\r\n7143LmT3MfCDw1bfHu2k1OK7hT+BOi6sXas1D/fVtjz5WwuoBvwf1DBZ7eq8\r\ntMQbLqQ7m/A8uwrVFOhWfuxulM7RuzIPIgv4HqtKKEugprUd80bPus45+f80\r\nH6ZSgEpmZD6t9JShY6f8pU1OHcnPqFsFF0sLyOk7WcCG5Li3WjkwU/lIu18q\r\nR26oLb5UM8z6vv6JD29GmqCj+OLYaPk8b00kdpGEvTjw3VzGM+tXOgUf2y1T\r\nK9UfhMNkyswxUZw543CMTdw9V0+AzM0q70T/p0fP9nlJCv6M3bQm6D/vABEB\r\nAAEAB/sG3UWhvWjO4QcS9ZmC43z98oI/TLRHXQVgrwoMFZVflhVZWTbKE1AD\r\nadOHJNkoq7+LW3c/1esgbRyZvzqXq8PJyArlNIdI1rwCOQk2erFZQXfwk0mG\r\nWZ1IGPwtrQX75foXQ+TVVxmu0HrH7xWr/F73IwWkB51rMjmnLzL1UcJEYh/I\r\nVS5a4+KhCHf4k7GNewLdTd74ERNfL/BPRS2vye4oxJCr9Qx2nwB9a8WMk7X4\r\nIYIH0zpo5/Eu5nXUZyZ2D/72UlOmsox376J8B4lkoRMQPmIvfLBqyX4w7EG6\r\ngwBF+gib/hyHm8aAgkwPs931CDDJNf0wq17dqbDN0Uk8q1SRBADtHbjT2Utl\r\ns6R0g8BRakCh4FT1t/fvlFXO14T0O28vfGroWtbd0q/2XJF1WcRU9NXdo2DG\r\n3z5dQJzKz/nb8G9/LDpWcuBfYWXT3YZVOSiIUSp9SwYGTHIXCxqYev+ALc1b\r\nO3PYpbYgadnPeu/7qRTIzN9Wrnplp5PO7RcBGGWY/wQA6R2L8IEz1wZuiUqd\r\nFsb7Rzpe2bp4sQNsCdaX69Ci0fHsIOltku52K4A1hEqCaPZBGh7gnYGYSx2w\r\nF3UklJxaaxh3EjaxJT0R6+fHpkdhjnsKIgyhjwnuZSHQYINah00jupIZRjn7\r\n67XnOKKnWajodAojfgsdZqAbZ/WHSq8X6RED/i5Q4xaoa72VT3hMTYRkR6R9\r\nhBVjmR6NsUq9cIZoV6txFbpijj79qzrlY7yAl1NA7bkuHxvE+uHVBqFtBo2I\r\n3f9cINbCWWdgsAvNtYEwUnpgzDoL5UF0TCZvtmF2r0R7zVniuDTeKyEoUZYF\r\nJA1o6k3hnwCQDFLfWchcVPIra2pVPZrNL0VrbSBVc2VyIDxla21AZWttLW9y\r\nZy1ydWxlcy10ZXN0LmZsb3djcnlwdC5jb20+wsB1BBABCAAfBQJeZkShBgsJ\r\nBwgDAgQVCAoCAxYCAQIZAQIbAwIeAQAKCRDESadeBea4P0KvCACD5uOgGxwG\r\nEmUWfH8EXPK7npDKulmoZnSWYrfCX3ctUKXjwPBWRXYid7LChnQAR6SRcyxy\r\nD1Eoel5ZVrJyKHqRkxcanFHeqRU1OyOgtsQyPIGtLipmOgc6i5JYhqbQ4mNu\r\n10CGS6ZKhjf6rFIqLl/8f4lnBc28UqVuP20Ru6KJZTVVQRF28FweMByR/3Ly\r\nAWfObMwXJ0+uFEV941VEDv5MGdIdfePTP2cHRSJxPqVhpPWtfzYLStUzLFvt\r\nLfE45hympok4lZeKfLVtZVVQEgT+ojEImdiZQJ0dT+jeJhmuTjzURQcLapXv\r\n2GLBUZaY2zfoAXR31QNYjADOxlrOutSUx8LYBF5mRKEBCACVNQTzI2Cf1+G3\r\nq38OtXO89tuBI/a5TjcHh/sFIJB6PPuEg/uW+EsjkgI3yk+UZZd6iYohO2mJ\r\ncJ7MnaFHOu7tmOEaaHSiYsA0RTnVqUBlbHbsl2oSlQJ/mjJ4cWq5ateuLHhx\r\n2RV0t1bm2anHJnqKGkqYqXA72m5grLzRSJ9M43wQRheGWGNoNdg4kPxU+PjY\r\nwfk2ARX5SCUKoG0qp0RhRMplX74uYi+Ek/9qSyZevmhK55sXIUNwLsuEhejl\r\nr0iucOt2vcIybQ9EbMXz62yYMRjYgy4SxW5aQJxXFeWkSo6wzMqQ1ZiSArRC\r\nezBk+mftxNrmwmtCcJajQt2uAQQVABEBAAEAB/sFz/fuZM1pzKYdWo/ricQF\r\nc3RfloAQ/ewE3hY4P+mA6Yk+w0l0ux1qOFDfzYDGHiMFggAghUj6Mqns/KMA\r\nvFn8ZX03YyRQAxrLrnqvSRWaHdyQIOHf8XAUenRG3twydugJ/+99N+CvGElJ\r\nWudTO7uAT7/iLI+TtVGhcHk2ieayvwaleWfQd9eVw37xi58hMWV/NSBOIZhW\r\n2Lv/aldPr8ld8vlWYN4xbTCLF45FoetBrGjDkXb3BCELHSj/ot7I+wZ1uGIF\r\n33wh8Q0EWFgqQtMBnyL6m/XO0U1sOrJADVGQsOQ1/5+3AnpUJOHnP9rnhy8A\r\n2glYg3+2sRRupRG4n/6NBADJKA4RsHwvOeRx1pnuOD8B2fP0r5qJ4gi+tsRq\r\nIXOY1dpPbhzo4AAn+RVwo6JC3aUWtt2yUsJ9eTyWG432LkM9eUwL4Z//ymXf\r\nVFIfl4ySyEvbSujNfreEYM7FUr7kxpBfGE1c86J+AX6MZpfw9hIGs+8IHr/j\r\ngoZe8+CD+1xBuwQAveMZgrB+CoGjQMaVa6/GoWagV20KjHKXDhI/Aogjnu/B\r\nlwHemh1pJucI5kvnq+SaupFO8dgDt+bhwJxsH6d/Wj/J80+TR7pvYFSkk3LV\r\nP3IGRUy7U11LKEqno5n9/4/EuXvV/lixalIGNOGgpnoHgwPIkT9AYGxOlF21\r\n8T4nTG8D/R/URs9vxc9nmTDm9ykw0cHDMmSqLl1a5Dzl2VpQitFBgmaCEo5L\r\ne+QN/nX0KWMFttKXo++N/sU988sOhxQyEzeTq6B+9YJVnaaxAZByDRzrMgG+\r\nq/5XGxzbwsCta5NxE3iY9CWDrPm20KUkBF3ZKoDrlV0Uck6wX+XLipoDc4AX\r\nRfHCwF8EGAEIAAkFAl5mRKECGwwACgkQxEmnXgXmuD/7VAf+IMJMoADcdWNh\r\nn45AvkwbzSmYt4i2aRGe+qojswwYzvFBFZtyZ/FKV2+LHfKUBI18FRmHmKEb\r\na1UUetflytxiAwZxSJSf7Yz/NDiWaVn0eOLopmFMiPb02a5i3CjbLsDeex2y\r\n/69R0+fQc+rE3HZ04C8H/YAqFV0VOv3L+2EztOGK7KOZOx4toR05oDqbZbiD\r\nzwhsa2MugHLPLZuGl3eGk+n/EcINhopHg+HU8MHQE6rADvrok6QiYVhpGqi8\r\nksD3kBAk43hGRSD2m/WDPWa/h2sh5rVswTKUDtv1fd1H6Ff5FnK21LHjEk0f\r\n+P9DgunMb5OtkDwm6WWxpzV150LJcA==\r\n=FAco\r\n-----END PGP PRIVATE KEY BLOCK-----\r\n"
        }, {
          "id" : "1,email-key-manager,evaluation.org,pgp-key-public,ekm%40ekm-org-rules-test.flowcrypt.com",
          "content" : "-----BEGIN PGP PUBLIC KEY BLOCK-----\r\nVersion: FlowCrypt 7.6.9 Gmail Encryption\r\nComment: Seamlessly send and receive encrypted email\r\n\r\nxsBNBF5mRKEBCADX62s0p6mI6yrxB/ui/LqxfG4RcQzZJf8ah52Ynu1n8V7Y\r\n7143LmT3MfCDw1bfHu2k1OK7hT+BOi6sXas1D/fVtjz5WwuoBvwf1DBZ7eq8\r\ntMQbLqQ7m/A8uwrVFOhWfuxulM7RuzIPIgv4HqtKKEugprUd80bPus45+f80\r\nH6ZSgEpmZD6t9JShY6f8pU1OHcnPqFsFF0sLyOk7WcCG5Li3WjkwU/lIu18q\r\nR26oLb5UM8z6vv6JD29GmqCj+OLYaPk8b00kdpGEvTjw3VzGM+tXOgUf2y1T\r\nK9UfhMNkyswxUZw543CMTdw9V0+AzM0q70T/p0fP9nlJCv6M3bQm6D/vABEB\r\nAAHNL0VrbSBVc2VyIDxla21AZWttLW9yZy1ydWxlcy10ZXN0LmZsb3djcnlw\r\ndC5jb20+wsB1BBABCAAfBQJeZkShBgsJBwgDAgQVCAoCAxYCAQIZAQIbAwIe\r\nAQAKCRDESadeBea4P0KvCACD5uOgGxwGEmUWfH8EXPK7npDKulmoZnSWYrfC\r\nX3ctUKXjwPBWRXYid7LChnQAR6SRcyxyD1Eoel5ZVrJyKHqRkxcanFHeqRU1\r\nOyOgtsQyPIGtLipmOgc6i5JYhqbQ4mNu10CGS6ZKhjf6rFIqLl/8f4lnBc28\r\nUqVuP20Ru6KJZTVVQRF28FweMByR/3LyAWfObMwXJ0+uFEV941VEDv5MGdId\r\nfePTP2cHRSJxPqVhpPWtfzYLStUzLFvtLfE45hympok4lZeKfLVtZVVQEgT+\r\nojEImdiZQJ0dT+jeJhmuTjzURQcLapXv2GLBUZaY2zfoAXR31QNYjADOxlrO\r\nutSUzsBNBF5mRKEBCACVNQTzI2Cf1+G3q38OtXO89tuBI/a5TjcHh/sFIJB6\r\nPPuEg/uW+EsjkgI3yk+UZZd6iYohO2mJcJ7MnaFHOu7tmOEaaHSiYsA0RTnV\r\nqUBlbHbsl2oSlQJ/mjJ4cWq5ateuLHhx2RV0t1bm2anHJnqKGkqYqXA72m5g\r\nrLzRSJ9M43wQRheGWGNoNdg4kPxU+PjYwfk2ARX5SCUKoG0qp0RhRMplX74u\r\nYi+Ek/9qSyZevmhK55sXIUNwLsuEhejlr0iucOt2vcIybQ9EbMXz62yYMRjY\r\ngy4SxW5aQJxXFeWkSo6wzMqQ1ZiSArRCezBk+mftxNrmwmtCcJajQt2uAQQV\r\nABEBAAHCwF8EGAEIAAkFAl5mRKECGwwACgkQxEmnXgXmuD/7VAf+IMJMoADc\r\ndWNhn45AvkwbzSmYt4i2aRGe+qojswwYzvFBFZtyZ/FKV2+LHfKUBI18FRmH\r\nmKEba1UUetflytxiAwZxSJSf7Yz/NDiWaVn0eOLopmFMiPb02a5i3CjbLsDe\r\nex2y/69R0+fQc+rE3HZ04C8H/YAqFV0VOv3L+2EztOGK7KOZOx4toR05oDqb\r\nZbiDzwhsa2MugHLPLZuGl3eGk+n/EcINhopHg+HU8MHQE6rADvrok6QiYVhp\r\nGqi8ksD3kBAk43hGRSD2m/WDPWa/h2sh5rVswTKUDtv1fd1H6Ff5FnK21LHj\r\nEk0f+P9DgunMb5OtkDwm6WWxpzV150LJcA==\r\n=Hcoc\r\n-----END PGP PUBLIC KEY BLOCK-----\r\n"
        }, {
          "id" : "1,email-key-manager,evaluation.org,pgp-key-fingerprint,C05803F40E0B9FE4FE9B4822C449A75E05E6B83F",
          "content" : "1,email-key-manager,evaluation.org,pgp-key-private,106988520142055188323\n1,email-key-manager,evaluation.org,pgp-key-public,ekm%40ekm-org-rules-test.flowcrypt.com"
        } ]
      }`;
      const { blocks, normalized } = MsgBlockParser.detectBlocks(input);
      expect(normalized).to.equal(input);
      expect(blocks).to.have.property('length').that.equals(1);
      expect(blocks[0]).to.deep.equal(MsgBlock.fromContent("plainText", input));
      t.pass();
    });

    ava.default(`[unit][MsgBlockParser.detectBlocks] replaces intended blocks`, async t => {
      const prv = `-----BEGIN PGP PRIVATE KEY BLOCK-----\r\nVersion: FlowCrypt 7.6.9 Gmail Encryption\r\nComment: Seamlessly send and receive encrypted email\r\n\r\nxcLYBF5mRKEBCADX62s0p6mI6yrxB/ui/LqxfG4RcQzZJf8ah52Ynu1n8V7Y\r\n7143LmT3MfCDw1bfHu2k1OK7hT+BOi6sXas1D/fVtjz5WwuoBvwf1DBZ7eq8\r\ntMQbLqQ7m/A8uwrVFOhWfuxulM7RuzIPIgv4HqtKKEugprUd80bPus45+f80\r\nH6ZSgEpmZD6t9JShY6f8pU1OHcnPqFsFF0sLyOk7WcCG5Li3WjkwU/lIu18q\r\nR26oLb5UM8z6vv6JD29GmqCj+OLYaPk8b00kdpGEvTjw3VzGM+tXOgUf2y1T\r\nK9UfhMNkyswxUZw543CMTdw9V0+AzM0q70T/p0fP9nlJCv6M3bQm6D/vABEB\r\nAAEAB/sG3UWhvWjO4QcS9ZmC43z98oI/TLRHXQVgrwoMFZVflhVZWTbKE1AD\r\nadOHJNkoq7+LW3c/1esgbRyZvzqXq8PJyArlNIdI1rwCOQk2erFZQXfwk0mG\r\nWZ1IGPwtrQX75foXQ+TVVxmu0HrH7xWr/F73IwWkB51rMjmnLzL1UcJEYh/I\r\nVS5a4+KhCHf4k7GNewLdTd74ERNfL/BPRS2vye4oxJCr9Qx2nwB9a8WMk7X4\r\nIYIH0zpo5/Eu5nXUZyZ2D/72UlOmsox376J8B4lkoRMQPmIvfLBqyX4w7EG6\r\ngwBF+gib/hyHm8aAgkwPs931CDDJNf0wq17dqbDN0Uk8q1SRBADtHbjT2Utl\r\ns6R0g8BRakCh4FT1t/fvlFXO14T0O28vfGroWtbd0q/2XJF1WcRU9NXdo2DG\r\n3z5dQJzKz/nb8G9/LDpWcuBfYWXT3YZVOSiIUSp9SwYGTHIXCxqYev+ALc1b\r\nO3PYpbYgadnPeu/7qRTIzN9Wrnplp5PO7RcBGGWY/wQA6R2L8IEz1wZuiUqd\r\nFsb7Rzpe2bp4sQNsCdaX69Ci0fHsIOltku52K4A1hEqCaPZBGh7gnYGYSx2w\r\nF3UklJxaaxh3EjaxJT0R6+fHpkdhjnsKIgyhjwnuZSHQYINah00jupIZRjn7\r\n67XnOKKnWajodAojfgsdZqAbZ/WHSq8X6RED/i5Q4xaoa72VT3hMTYRkR6R9\r\nhBVjmR6NsUq9cIZoV6txFbpijj79qzrlY7yAl1NA7bkuHxvE+uHVBqFtBo2I\r\n3f9cINbCWWdgsAvNtYEwUnpgzDoL5UF0TCZvtmF2r0R7zVniuDTeKyEoUZYF\r\nJA1o6k3hnwCQDFLfWchcVPIra2pVPZrNL0VrbSBVc2VyIDxla21AZWttLW9y\r\nZy1ydWxlcy10ZXN0LmZsb3djcnlwdC5jb20+wsB1BBABCAAfBQJeZkShBgsJ\r\nBwgDAgQVCAoCAxYCAQIZAQIbAwIeAQAKCRDESadeBea4P0KvCACD5uOgGxwG\r\nEmUWfH8EXPK7npDKulmoZnSWYrfCX3ctUKXjwPBWRXYid7LChnQAR6SRcyxy\r\nD1Eoel5ZVrJyKHqRkxcanFHeqRU1OyOgtsQyPIGtLipmOgc6i5JYhqbQ4mNu\r\n10CGS6ZKhjf6rFIqLl/8f4lnBc28UqVuP20Ru6KJZTVVQRF28FweMByR/3Ly\r\nAWfObMwXJ0+uFEV941VEDv5MGdIdfePTP2cHRSJxPqVhpPWtfzYLStUzLFvt\r\nLfE45hympok4lZeKfLVtZVVQEgT+ojEImdiZQJ0dT+jeJhmuTjzURQcLapXv\r\n2GLBUZaY2zfoAXR31QNYjADOxlrOutSUx8LYBF5mRKEBCACVNQTzI2Cf1+G3\r\nq38OtXO89tuBI/a5TjcHh/sFIJB6PPuEg/uW+EsjkgI3yk+UZZd6iYohO2mJ\r\ncJ7MnaFHOu7tmOEaaHSiYsA0RTnVqUBlbHbsl2oSlQJ/mjJ4cWq5ateuLHhx\r\n2RV0t1bm2anHJnqKGkqYqXA72m5grLzRSJ9M43wQRheGWGNoNdg4kPxU+PjY\r\nwfk2ARX5SCUKoG0qp0RhRMplX74uYi+Ek/9qSyZevmhK55sXIUNwLsuEhejl\r\nr0iucOt2vcIybQ9EbMXz62yYMRjYgy4SxW5aQJxXFeWkSo6wzMqQ1ZiSArRC\r\nezBk+mftxNrmwmtCcJajQt2uAQQVABEBAAEAB/sFz/fuZM1pzKYdWo/ricQF\r\nc3RfloAQ/ewE3hY4P+mA6Yk+w0l0ux1qOFDfzYDGHiMFggAghUj6Mqns/KMA\r\nvFn8ZX03YyRQAxrLrnqvSRWaHdyQIOHf8XAUenRG3twydugJ/+99N+CvGElJ\r\nWudTO7uAT7/iLI+TtVGhcHk2ieayvwaleWfQd9eVw37xi58hMWV/NSBOIZhW\r\n2Lv/aldPr8ld8vlWYN4xbTCLF45FoetBrGjDkXb3BCELHSj/ot7I+wZ1uGIF\r\n33wh8Q0EWFgqQtMBnyL6m/XO0U1sOrJADVGQsOQ1/5+3AnpUJOHnP9rnhy8A\r\n2glYg3+2sRRupRG4n/6NBADJKA4RsHwvOeRx1pnuOD8B2fP0r5qJ4gi+tsRq\r\nIXOY1dpPbhzo4AAn+RVwo6JC3aUWtt2yUsJ9eTyWG432LkM9eUwL4Z//ymXf\r\nVFIfl4ySyEvbSujNfreEYM7FUr7kxpBfGE1c86J+AX6MZpfw9hIGs+8IHr/j\r\ngoZe8+CD+1xBuwQAveMZgrB+CoGjQMaVa6/GoWagV20KjHKXDhI/Aogjnu/B\r\nlwHemh1pJucI5kvnq+SaupFO8dgDt+bhwJxsH6d/Wj/J80+TR7pvYFSkk3LV\r\nP3IGRUy7U11LKEqno5n9/4/EuXvV/lixalIGNOGgpnoHgwPIkT9AYGxOlF21\r\n8T4nTG8D/R/URs9vxc9nmTDm9ykw0cHDMmSqLl1a5Dzl2VpQitFBgmaCEo5L\r\ne+QN/nX0KWMFttKXo++N/sU988sOhxQyEzeTq6B+9YJVnaaxAZByDRzrMgG+\r\nq/5XGxzbwsCta5NxE3iY9CWDrPm20KUkBF3ZKoDrlV0Uck6wX+XLipoDc4AX\r\nRfHCwF8EGAEIAAkFAl5mRKECGwwACgkQxEmnXgXmuD/7VAf+IMJMoADcdWNh\r\nn45AvkwbzSmYt4i2aRGe+qojswwYzvFBFZtyZ/FKV2+LHfKUBI18FRmHmKEb\r\na1UUetflytxiAwZxSJSf7Yz/NDiWaVn0eOLopmFMiPb02a5i3CjbLsDeex2y\r\n/69R0+fQc+rE3HZ04C8H/YAqFV0VOv3L+2EztOGK7KOZOx4toR05oDqbZbiD\r\nzwhsa2MugHLPLZuGl3eGk+n/EcINhopHg+HU8MHQE6rADvrok6QiYVhpGqi8\r\nksD3kBAk43hGRSD2m/WDPWa/h2sh5rVswTKUDtv1fd1H6Ff5FnK21LHjEk0f\r\n+P9DgunMb5OtkDwm6WWxpzV150LJcA==\r\n=FAco\r\n-----END PGP PRIVATE KEY BLOCK-----`;
      const pub = `-----BEGIN PGP PUBLIC KEY BLOCK-----\r\nVersion: FlowCrypt 7.6.9 Gmail Encryption\r\nComment: Seamlessly send and receive encrypted email\r\n\r\nxsBNBF5mRKEBCADX62s0p6mI6yrxB/ui/LqxfG4RcQzZJf8ah52Ynu1n8V7Y\r\n7143LmT3MfCDw1bfHu2k1OK7hT+BOi6sXas1D/fVtjz5WwuoBvwf1DBZ7eq8\r\ntMQbLqQ7m/A8uwrVFOhWfuxulM7RuzIPIgv4HqtKKEugprUd80bPus45+f80\r\nH6ZSgEpmZD6t9JShY6f8pU1OHcnPqFsFF0sLyOk7WcCG5Li3WjkwU/lIu18q\r\nR26oLb5UM8z6vv6JD29GmqCj+OLYaPk8b00kdpGEvTjw3VzGM+tXOgUf2y1T\r\nK9UfhMNkyswxUZw543CMTdw9V0+AzM0q70T/p0fP9nlJCv6M3bQm6D/vABEB\r\nAAHNL0VrbSBVc2VyIDxla21AZWttLW9yZy1ydWxlcy10ZXN0LmZsb3djcnlw\r\ndC5jb20+wsB1BBABCAAfBQJeZkShBgsJBwgDAgQVCAoCAxYCAQIZAQIbAwIe\r\nAQAKCRDESadeBea4P0KvCACD5uOgGxwGEmUWfH8EXPK7npDKulmoZnSWYrfC\r\nX3ctUKXjwPBWRXYid7LChnQAR6SRcyxyD1Eoel5ZVrJyKHqRkxcanFHeqRU1\r\nOyOgtsQyPIGtLipmOgc6i5JYhqbQ4mNu10CGS6ZKhjf6rFIqLl/8f4lnBc28\r\nUqVuP20Ru6KJZTVVQRF28FweMByR/3LyAWfObMwXJ0+uFEV941VEDv5MGdId\r\nfePTP2cHRSJxPqVhpPWtfzYLStUzLFvtLfE45hympok4lZeKfLVtZVVQEgT+\r\nojEImdiZQJ0dT+jeJhmuTjzURQcLapXv2GLBUZaY2zfoAXR31QNYjADOxlrO\r\nutSUzsBNBF5mRKEBCACVNQTzI2Cf1+G3q38OtXO89tuBI/a5TjcHh/sFIJB6\r\nPPuEg/uW+EsjkgI3yk+UZZd6iYohO2mJcJ7MnaFHOu7tmOEaaHSiYsA0RTnV\r\nqUBlbHbsl2oSlQJ/mjJ4cWq5ateuLHhx2RV0t1bm2anHJnqKGkqYqXA72m5g\r\nrLzRSJ9M43wQRheGWGNoNdg4kPxU+PjYwfk2ARX5SCUKoG0qp0RhRMplX74u\r\nYi+Ek/9qSyZevmhK55sXIUNwLsuEhejlr0iucOt2vcIybQ9EbMXz62yYMRjY\r\ngy4SxW5aQJxXFeWkSo6wzMqQ1ZiSArRCezBk+mftxNrmwmtCcJajQt2uAQQV\r\nABEBAAHCwF8EGAEIAAkFAl5mRKECGwwACgkQxEmnXgXmuD/7VAf+IMJMoADc\r\ndWNhn45AvkwbzSmYt4i2aRGe+qojswwYzvFBFZtyZ/FKV2+LHfKUBI18FRmH\r\nmKEba1UUetflytxiAwZxSJSf7Yz/NDiWaVn0eOLopmFMiPb02a5i3CjbLsDe\r\nex2y/69R0+fQc+rE3HZ04C8H/YAqFV0VOv3L+2EztOGK7KOZOx4toR05oDqb\r\nZbiDzwhsa2MugHLPLZuGl3eGk+n/EcINhopHg+HU8MHQE6rADvrok6QiYVhp\r\nGqi8ksD3kBAk43hGRSD2m/WDPWa/h2sh5rVswTKUDtv1fd1H6Ff5FnK21LHj\r\nEk0f+P9DgunMb5OtkDwm6WWxpzV150LJcA==\r\n=Hcoc\r\n-----END PGP PUBLIC KEY BLOCK-----`;
      const input = `Hello, these should get replaced:\n${prv}\n\nAnd this one too:\n\n${pub}`;
      const { blocks, normalized } = MsgBlockParser.detectBlocks(input);
      expect(normalized).to.equal(input);
      expect(blocks).to.have.property('length').that.equals(4);
      expect(blocks[0]).to.deep.equal(MsgBlock.fromContent('plainText', 'Hello, these should get replaced:'));
      expect(blocks[1]).to.deep.equal(MsgBlock.fromContent('privateKey', prv));
      expect(blocks[2]).to.deep.equal(MsgBlock.fromContent('plainText', 'And this one too:'));
      expect(blocks[3]).to.deep.equal(MsgBlock.fromContent('publicKey', pub));
      t.pass();
    });

    ava.default(`[unit][Pgp.hash.sha1] hello`, async t => {
      expect(await PgpHash.sha1UtfStr("hello")).to.equal("aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d");
      t.pass();
    });

    ava.default(`[unit][Pgp.hash.sha256] hello`, async t => {
      expect(await PgpHash.sha256UtfStr("hello")).to.equal('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
      t.pass();
    });

    ava.default(`[unit][Pgp.hash.doubleSha1Upper] hello`, async t => {
      expect(await PgpHash.doubleSha1Upper("hello")).to.equal("9CF5CAF6C36F5CCCDE8C73FAD8894C958F4983DA");
      t.pass();
    });

    ava.default(`[unit][Pgp.hash.challengeAnswer] hello`, async t => {
      expect(await PgpHash.challengeAnswer("hello")).to.equal('3b2d9ab4b38fe0bc24c1b5f094a45910b9d4539e8963ae8c79c8d76c5fb24978');
      t.pass();
    });

  }
};
