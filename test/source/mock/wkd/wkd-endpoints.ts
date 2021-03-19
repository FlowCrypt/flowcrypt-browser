/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { KeyUtil } from '../../core/crypto/key.js';
import { PgpArmor } from '../../core/crypto/pgp/pgp-armor.js';
import { testConstants } from '../../tests/tooling/consts.js';
import { HandlersDefinition } from '../all-apis-mock';

const alice = `-----BEGIN PGP PUBLIC KEY BLOCK-----

mDMEXgS/LxYJKwYBBAHaRw8BAQdAJ/BnDcmcOCED/rW3y1zPHSX6lABI7G19R6mP
hgfIgj+0EUFsaWNlIDxhbGljZUBybnA+iJAEExYIADgWIQRz7cyRGa/I4tu9zeUE
UUCWaf/ePAUCXgS/LwIbAwULCQgHAgYVCgkICwIEFgIDAQIeAQIXgAAKCRAEUUCW
af/ePCSdAP9OWq8uOk5B5LUtPvFnxqGkrZlAHt+tgR271QSggRV3MAEAvtL/ru5o
ss9jx26EqYj2GUgHGtsYqsz8j1y97S5lMQo=
=H16D
-----END PGP PUBLIC KEY BLOCK-----`;

const johnDoe = `-----BEGIN PGP PUBLIC KEY BLOCK-----

xsBNBF+IiY4BCADiCm145EEu8QALcex4OY+K7AEof4w2ZFW0Xj9wRodRj5WMEk0h5TOXlCr9Fzah
N75pl7W7jkYJUSUWucSga2tiIphR3JkPVDod6QUgwKSw/ZbXef9IY10bg4k+jobWToy4FmhOxUoZ
MfYGRMJKAwWBXajygbFp3XLV08BTToK4VRzA5/jZqjTmBnQ4Dut+F+TtdEve4WII/vtKYdpt7uSp
C3beifG0GD+bwoHit1hlsawN7iHGNjvszSGm9gXSRvF2dBskSgR2mtMC2HkgkhxR8Xrc5lBJAqPd
V05wvzjg26BXBEhe8AhJbqmnwUuEt40MleWuQPUMM0MBHtWfDIMxABEBAAHNEmpvaG4uZG9lQGxv
Y2FsaG9zdMLAiQQTAQgAMxYhBMsbekG6fBy6oIphZrkCy2XGlNa0BQJfiImUAhsDBQsJCAcCBhUI
CQoLAgUWAgMBAAAKCRC5AstlxpTWtCOMCACS/BgBU+/11SCzKcyjXHECPoJC2zxjBHZELaA8YRAP
CX9SIdWiaP06F7HTRrvBUqFuPtebA62GmF6PCyWv3wM7iY8HWrNNWnRgclfn203s6LpkIO8myzPi
itH15+2+CoKRD9QnGbkLZqOe+20ZG8AalciSnQm2QNMMd5RXyUhI8YxWFwzmd9rw18yA5r+P2g2y
uwC0PHbJDeRPzVsX5ZPVty00MCCOtJxcjTMszEVrndae78i2X7lI4WllGXvouw5nYJ4QCJxnE7IN
trwEW2/oqt1deeKAzDqtBlaz5eKameQhzCfIQ9yIvIxmS4GS25FScIBCqQktncKhujI2HfPbzsBN
BF+IiZQBCADAyDpTiMghfyWWqdqM09afztzzePk02xJJYRO/p09wgmqPaWgxfe//NqiFPDfiTyvc
nDLCDKuFktU5uD+I6UGVj7511r9veDh9Q+YB81qria0NONJtYN+bJ0T+depUAlOfNRSf9U79iuck
EHQR0j+4WLXHfqNR+CP9uobXZeAuyU47/KGXLvpO0GV1f8oDIxHW/ZnArFjXFHCbEwFg2Gbdedd6
7gFMc18Q4brfhA4XbMyN0rybipmuylWGIXM30O7cJDBg7+wM3CGRU/aiPCuFkGyknJvRMcjd2XnK
JxqRhvtIF4ZFoXMTi3U2ZqBjkrInECEIVxo0ImNmugzPFyCHABEBAAHCwHYEGAEIACAWIQTLG3pB
unwcuqCKYWa5AstlxpTWtAUCX4iJmQIbDAAKCRC5AstlxpTWtBJiB/9HkI+URaTsMYA+Jh98Ia9J
U57naEB/iugXGiStORK/QQfa3/aSnVeCI/NU2Ja0QKwb/QkjeTA8J6pSXjz5BqQs6Ydgww/cTHfZ
eqx9TuETieW/vzdBtkEHPNAWk4h6uB3KlE+WiaErLqMp/ibp3XlDizDzIanxBGwJH3n0xbsII2c4
Sk0/2pKhkHZeombiFhL4Ius6Ym82DsaHg/ngq0Alm9lUrZd2bhKWuOlUXF/kl1BtFuxQSNhAD13r
GOcKZI9WfvN8IV5P8oh/ldHcF8WUumQEFIAR3WGk8P9v1XfHtBFeDQ70ZoE+KV7Uy7UKAzcVni4O
AwMwBxWpyLaH6xjb
=mswb
-----END PGP PUBLIC KEY BLOCK-----`;

const johnDoe1 = `-----BEGIN PGP PUBLIC KEY BLOCK-----

xsBNBF+Jz04BCACYEg0Fkg4NLnTxzuyF3gnz2pMfp+BelG/IHvIg9mls4U8OJcjGyq3bVpPDKDDQ
4ZuhRtrMy5K0ZnyiGsmzMKXvVS3FUPQ5EJD2Laveo5ohtM6t49jlloQvv7aMUBVpjTskaY06lJuV
2f1CCCDteh3G8qNpKvziUc4a8PzeIItktHTCa0MNdDRxq19DUs2eQGGXqBDm/mQjVMZ1Zgt55Ymu
BpPLytJXOjRoDYsTj+OdOv+aQ4Td7JnicTDVQR4Uc9x02lMPsBF3K0N0cnITyiKCV/QdgdSQkL8N
zFVgvt5QPGhlGA0sAl1wiBFeNZrrd+VXg4FmuGrWd9YLS01AyRSJABEBAAHNEmpvaG4uZG9lQDEy
Ny4wLjAuMcLAiQQTAQgAMxYhBGWfN6kiReeNpwCbUy2oGOH1OKOdBQJfic9SAhsDBQsJCAcCBhUI
CQoLAgUWAgMBAAAKCRAtqBjh9TijnU1JB/wPcImnOmo42gu8YBKe18d9HyCQNs4q4pw/bYXshLe7
aMjx+XgUvWHBcoTtz+4g2QjmhmL3ROkGs/vBriZZqhZz4636s7RAlyU0yyzcH4rvNq/ByNm+Ol7x
Bwo3EbaRh46Q4mbctslfQ/jd42cUzwEOnY2HSPH+tgfTjd8xciBL5tH0+YinCuqSi/sAOkBoNAkv
kgiA+cRH4scVsW2KwWuZPOJINO8nJVu0at64sZib8/UJ4Zku5w7i1dnmWu6C9aqz+Ddu/xcDUW8j
2GFXECJX0deXZmhEZ8wLt5P+ke3Wt1gttGCigVzPvpXHkpZpC7zlykcMeE2ywRBqypauZUjPzsBN
BF+Jz1IBCACjRVxKy2aU49H95g8LM1Dsqmc+KCSOl9/kC1pyzKl4xUEYQ+ok5OKHt9tf42a1z9SM
oUicFkSOwBMtjOhWjrghxVBHIc4NtDewFXY6IifG6BvewOiNat2mYzfLF852idBbhnN82p4NWd2g
oUwDcqOvZ3Z5qg4eKiH2l+UzlHuFXmSfFP3g7Pm3UTaYhOWRBwOO/u7JN9rMHBcLxfp7T745C8dT
UmrZEpfTEGgwhmYfBFyMZFxzgtZwt4UUTnyLFtqhROPx6ji4ecSDNAD7yVjd9uJSNbxIRV4SUPCG
/vR39Lm8dXiFEek47DYGPaPyid/zfFkfhLndQ70W2GkhGdLnABEBAAHCwHYEGAEIACAWIQRlnzep
IkXnjacAm1MtqBjh9TijnQUCX4nPVwIbDAAKCRAtqBjh9Tijna+wB/4tsj016eBsQGb3xGs/BBa6
06VLL9tjrTV9TdZj3DfpE9xSPiNC+Jah09uW//VNRzNTDYctGXEGIYm2tx2q8QAX/rWBC/UYi16l
4lHnvlHa4NNA+O22uQpMlwmbTVSPTs4kVUSpNyuOtE6SXY6UyzcyvwTpffXiQkfICW7BXmykUXHx
HZ8Ddq/syp3eBitlmNZHGwRWKD5ihd96o5dCw/Dgpz/p6dxka1627j013wov65p1NbXiV1kM7G7s
ZccLrjYxOL/1Rc1ac9TdfXX7lVeZtbpSVhSl9Z1YMhth+oWVJ79iQQ8OPKEvt471Qwk1LH7k4a9O
nT5+WNnpAkcxrjMd
=fISM
-----END PGP PUBLIC KEY BLOCK-----
`;

const jackAdvanced = `-----BEGIN PGP PUBLIC KEY BLOCK-----

xsBNBF+J56IBCADSvEei1mAEQCEXHxaOKzsxvM8Qvgjj0vr+zHE+hUFg1znRAyjQ9XSDGwJ4+dut
kKh8P2Ibu8hhX01eHiqW85IXO2yvLDo19+8TnRHQGfn895Ptxs150Xcg4gwXPzvY9tIXV4+z+vm2
ek7tM3zI4IXpT/VCasVHHn34C6qupkJSviZwC+SoXPS5flFXNSGktALC9OIpDzW1qqtIpl2niG2I
4Df4yn3iiRVM8Zt4SGxsvcSXbsAAVEev7BQTUgxin5DlWkA7R9zaiBQ/DkO1JCEXJVvqpK1ETxi3
K/3rkmmob3mICp0QXpgpllik6jH5YXGtK0Dbly9IXPH03smrpBS7ABEBAAHNF2phY2suYWR2YW5j
ZWRAbG9jYWxob3N0wsCJBBMBCAAzFiEEFpnGj5ZL0Um8kGZee64HZY9qWHgFAl+J56cCGwMFCwkI
BwIGFQgJCgsCBRYCAwEAAAoJEHuuB2WPalh4frQH/jWdjU1OPy0mMToZFRF81j4v1eyziyBSPjWV
MxvqNMSeBxHBmDWsfcWesvUi24kodiAYnJW8zAN9N99BATgGgvGNkghq4AFneOWBXDwQi8t+5H0v
c9JXSUbE/NH1JuqkPoF6p2flcR3VIhmfOEKMfKcCSyLRykiDQxGjkGwBMo/Dmv6iC0qJu95u/8PG
C8hnLmkORJFs0Ql0lTTqKrZQdhdyS34Ad99YwbNjtZvZcfIRljiMaJlwsj9e/kj9Ppn7PZWgs20X
/reafSKWyPFsgQyNzWnmXggrodvVKrj2NHlFlAqYyKNujbz0NdpwBx4U4WBFIpSZ2HLNT+chHdnr
NlfOwE0EX4nnpwEIALRviWiViluglkUGltBX6rWwYjY8niPbBaXC+xus4uH08IlDO/aDD2t4efkP
t0QMeQE9WYsRk8hHUC+isJRF+jbwVhAW1fkv4R3WWkwXQFsr0wXW4Krp30m9JaOW9EolDwv8/Fik
XmkBhWviByqBDvZ9CPtEt5Nwd6XT49Cf4HycQvrkKC3ytYohs2iyf+T7BLKJr6y3zDlaBtXaoqpA
wIXBduoccL01MyrGxLeLF56W75SZmtE4CK0G6g/zjjwmawKDSfK6DZHARYC/ZguUocnpB3Ui7B8d
sprqB1QmQZJQt7By6EUvhnw1WYAiDD05xryFPNhXYt3+Ypid/N/A2eEAEQEAAcLAdgQYAQgAIBYh
BBaZxo+WS9FJvJBmXnuuB2WPalh4BQJfieetAhsMAAoJEHuuB2WPalh4TvgIAIRkAuvvl+9p8xPg
pfMp5muIpVFjWmMUBIT8MEXZvVSr3YUpDmHxTgbL78Hf9Fk7rAw7tkFFz+cZltnIDITUCyGdIJaF
dow3a+ImNZ/eo6zcftWJiyH1zM5w5aEcWNUnHpy8TDRIFgomt1K1DcAo2zoutpGylCF5ZeL6vqFw
afV6xkjQ9+neZ2LahN5cYNOKAeeI73hvoGFSCYp9Ih8JaEhG6seU9lskg2qQDvVEJaHHp0nPxbU/
mhejIVi+pinqouXEqSb+84n2dNQ7HdgGe1YBM8kvNzq9SLfcYWjpnkchoL+5KGksjgbOvKFDz1Ek
nmusEeYtrrMytL4oUohBVZk=
=bbav
-----END PGP PUBLIC KEY BLOCK-----
`;

const validAmongRevokedRevoked1 = `
-----BEGIN PGP PUBLIC KEY BLOCK-----

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
=vqJ0
-----END PGP PUBLIC KEY BLOCK-----`;

const validAmongRevokedValid = `-----BEGIN PGP PUBLIC KEY BLOCK-----

xsBNBGAeYQ0BCADHMOjbN/X/TH4JpTz7Sj1VTGIeXzWUVZIbsjLgp8U0dFo2zWXMsgLsnNAZuL43
pUAnIqw+wvUcSpndEO79upVvUzc1qgvp2DTJuDrVGAPx1cqKOi3A/XPO0uIxTyCChcQBQ+YUvwc6
7ZU69irRC320AQC5aFrL+yP7RmlWQgslJ0qJXPa3On6Cp71GL26iADPXnQOqZtmhv87nYlHhimOv
bKLtC/YMTqGk0h7HqNQPcP8B6bylofS/7Rgy+JKsqWmlng+U/0uQWsnfIua0BPkrZYwJdaF77cs1
7A2LV2glUiG7XzPkHPTMtG3xV7ZbiAsLSwWN7x1mG3uvpppeXkd1ABEBAAHNFnNvbWUucmV2b2tl
ZEBsb2NhbGhvc3TCwIkEEwEIADMWIQTWZixfub3p2gHzmUqqHvgy2Myk8gUCYB5hFQIbAwULCQgH
AgYVCAkKCwIFFgIDAQAACgkQqh74MtjMpPI7JQf8Dnw4XZLgR8lZV0S4e9JhG/cQqhIzXKVAFcMF
EPWVEHfUYTBCDmTPpi4m9rl5P9T70TXjMbpb6BzvuTS+OZHfyaj8YB39C5FKtqEemoMyO+VO5t7b
I4jUMG3Uu2kuwgN6I2g8jYeA6SYcoUN6NHIpQTkS2BW2IICWqUh09EfcVvdQbZKbMLaoQLfJvTze
gH7LPuNxsvfuhVPtL9WzOIgSFKDmfQnpHluJRKcAhK+aahtUetdsBemBrP7JbNIreIb6+qhmX4q5
8uGVUFrucSjRwFqqlxSo63ze1jsyzpOvfdzsaDMOG1yIX28cqfOZJpDft5nQjnznjSTJ3I6tGHtL
qs7ATQRgHmEVAQgArN5xkxz80Cbfm9UOT3U5wPkYyn/LA7UAfcdqk+rgLy+3dGItnUs2Lqa87fbT
YMf2Zj2fFnuIJ29DcPxRBF9s8FbeLx04wmzvw5TRE8AKvg4wGFlWm+pTOuik6069k/09rgCb5fOf
xEH6NKApQldaZGLWm8ThNX6jv30PwIjB/NwfCaGug6ehLyXGVSJuPhP5oYWUr/d+ppY5cNuObE83
ZAcOEYgdXFzERzTz25DnO38vhGlkBZZkBaGpLNfIbT7g9Ur4AVkMzJeOLIRtd7HDjWT8mww3DWly
UbdOhQoFEbQE2oVmYBBYXYMyS5wtRTufpcNYT+UC81W8nsX3rD2J3wARAQABwsB2BBgBCAAgFiEE
1mYsX7m96doB85lKqh74MtjMpPIFAmAeYRoCGwwACgkQqh74MtjMpPJp5QgApZ+Bm8v/EiwhIBnv
yAsXlVeMnKjnX8pjJouYtIwk4MoryZ6Ris/VD0WGG5nmgD5x9CbWNLh+pUj4I41uyMIbt++q5xlc
6qw4GsZVUkcTKIARKpPVvxkcZHlBbtkNj+US31lvkBlLPoIyn0/TB3aw9Sxu+DY0+tORGNI6VkAO
wPK57RZ8W/IQ7x76k7S44m634e6usKnD+reitX1QWi3vel8HC4qxviu/xLbIJyjMR1IgPsUWaMAe
DC024L0txF5zDnbODx9X1LM+/8D1pVizUjOwt1liPq0hh2JKU8iLqzdSkv0dte0UbEUPMyCVp8h6
scbnq9KEwLGCMJ0IkCSUNA==
=iXGJ
-----END PGP PUBLIC KEY BLOCK-----`;
const validAmongRevokedRevoked2 = `-----BEGIN PGP PUBLIC KEY BLOCK-----

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
=vKdv
-----END PGP PUBLIC KEY BLOCK-----
`;
// todo - add a not found test with: throw new HttpClientErr('Pubkey not found', 404);

export const mockWkdEndpoints: HandlersDefinition = {
  '/.well-known/openpgpkey/hu/st5or5guodbnsiqbzp6i34xw59h1sgmw?l=wkd': async () => {
    // direct for wkd@google.mock.flowcryptlocal.com:8001
    const pub = await KeyUtil.asPublicKey(await KeyUtil.parse(testConstants.wkdAtgooglemockflowcryptlocalcom8001Private));
    return Buffer.from((await PgpArmor.dearmor(KeyUtil.armor(pub))).data);
  },
  '/.well-known/openpgpkey/hu/ihyath4noz8dsckzjbuyqnh4kbup6h4i?l=john.doe': async () => {
    return Buffer.from((await PgpArmor.dearmor(johnDoe1)).data); // direct for john.doe@localhost
  },
  '/.well-known/openpgpkey/hu/ihyath4noz8dsckzjbuyqnh4kbup6h4i?l=John.Doe': async () => {
    return Buffer.from((await PgpArmor.dearmor(johnDoe1)).data); // direct for John.Doe@localhost
  },
  '/.well-known/openpgpkey/hu/cb53pfqmbzc8mm3ecbjxyen65fdxos56?l=jack.advanced': async () => {
    return Buffer.from((await PgpArmor.dearmor(jackAdvanced)).data); // direct for jack.advanced@localhost
  },
  '/.well-known/openpgpkey/localhost/hu/ihyath4noz8dsckzjbuyqnh4kbup6h4i?l=john.doe': async () => {
    return Buffer.from((await PgpArmor.dearmor(johnDoe)).data); // advanced for john.doe@localhost
  },
  '/.well-known/openpgpkey/localhost/hu/ihyath4noz8dsckzjbuyqnh4kbup6h4i?l=John.Doe': async () => {
    return Buffer.from((await PgpArmor.dearmor(johnDoe)).data); // advanced for John.Doe@localhost
  },
  '/.well-known/openpgpkey/localhost/hu/pob4adi8roqdsmtmxikx68pi6ij35oca?l=incorrect': async () => {
    return Buffer.from((await PgpArmor.dearmor(alice)).data); // advanced for incorrect@localhost
  },
  '/.well-known/openpgpkey/localhost/hu/66iu18j7mk6hod4wqzf6qd37u6wejx4y?l=some.revoked': async () => {
    return Buffer.from([
      ...(await PgpArmor.dearmor(validAmongRevokedRevoked1)).data,
      ...(await PgpArmor.dearmor(validAmongRevokedValid)).data,
      ...(await PgpArmor.dearmor(validAmongRevokedRevoked2)).data,
    ]);
  },
  '/.well-known/openpgpkey/localhost/policy': async () => {
    return ''; // allow advanced for localhost
  },
  '/.well-known/openpgpkey/policy': async () => {
    return ''; // allow direct for all
  },
};
