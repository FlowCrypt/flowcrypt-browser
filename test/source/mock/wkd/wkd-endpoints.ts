/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

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

export const mockWkdEndpoints: HandlersDefinition = {
  '/.well-known/openpgpkey/hu/ihyath4noz8dsckzjbuyqnh4kbup6h4i?l=john.doe': async () => {
    return johnDoe1; // direct for john.doe@127.0.0.1
  },
  '/.well-known/openpgpkey/hu/ihyath4noz8dsckzjbuyqnh4kbup6h4i?l=John.Doe': async () => {
    return johnDoe1; // direct for John.Doe@127.0.0.1
  },
  '/.well-known/openpgpkey/hu/cb53pfqmbzc8mm3ecbjxyen65fdxos56?l=jack.advanced': async () => {
    return jackAdvanced; // direct for jack.advanced@localhost
  },
  '/.well-known/openpgpkey/127.0.0.1/hu/ihyath4noz8dsckzjbuyqnh4kbup6h4i?l=john.doe': async () => {
    return alice; // shouldn't be returned
  },
  '/.well-known/openpgpkey/127.0.0.1/hu/ihyath4noz8dsckzjbuyqnh4kbup6h4i?l=John.Doe': async () => {
    return alice; // shouldn't be returned
  },
  '/.well-known/openpgpkey/localhost/hu/ihyath4noz8dsckzjbuyqnh4kbup6h4i?l=john.doe': async () => {
    return johnDoe; // advanced for john.doe@localhost
  },
  '/.well-known/openpgpkey/localhost/hu/ihyath4noz8dsckzjbuyqnh4kbup6h4i?l=John.Doe': async () => {
    return johnDoe; // advanced for John.Doe@localhost
  },
  '/.well-known/openpgpkey/localhost/hu/pob4adi8roqdsmtmxikx68pi6ij35oca?l=incorrect': async () => {
    return alice; // advanced for incorrect@localhost
  },
  '/.well-known/openpgpkey/localhost/policy': async () => {
    return ''; // allow advanced for localhost
  },
  '/.well-known/openpgpkey/policy': async () => {
    return ''; // allow direct for 127.0.0.1
  },
};
