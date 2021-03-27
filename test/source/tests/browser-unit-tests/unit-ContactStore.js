/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

/* eslint-disable max-len */

/**
 * These tests use JavaScript instead of TypeScript to avoid dealing with types in cross-environment setup.
 * (tests are injected from NodeJS through puppeteer into a browser environment)
 * While this makes them less convenient to write, the result is more flexible.
 * 
 * Import your lib to `ci_unit_test.ts` to resolve `ReferenceError: SomeClass is not defined`
 * 
 * Each test must return "pass" to pass. To reject, throw an Error.
 * 
 * Each test must start with one of (depending on which flavors you want it to run): 
 *  - BROWSER_UNIT_TEST_NAME(`some test name`);
 *  - BROWSER_UNIT_TEST_NAME(`some test name`).enterprise;
 *  - BROWSER_UNIT_TEST_NAME(`some test name`).consumer;
 * 
 * This is not a JavaScript file. It's a text file that gets parsed, split into chunks, and
 *    parts of it executed as javascript. The structure is very rigid. The only flexible place is inside
 *    the async functions. For the rest, do not change the structure or our parser will get confused.
 *    Do not put any code whatsoever outside of the async functions.
 */

BROWSER_UNIT_TEST_NAME(`ContactStore is able to search by partial email address`);
(async () => {
  const contactABBDEF = await ContactStore.obj({
    email: 'abbdef@test.com', pubkey: `-----BEGIN PGP PUBLIC KEY BLOCK-----

xsBNBGBKJpABCAC/EABGGXizvq4j96YsI0olYqS+9wSydO2Wn1AkoCCsyY9d7xrqG8UONylrTv0/
FpF951TnpQiWK3Z0RZcUhtVvLvmgF9+RwW1G2/KMc5SrjcAEhlIqPlXwd3hJfJgD03XtKT4mr8Y/
MVKLcIZyfn/45I/kWY88qVIKKkeG6NbCoV0zBczqTUsx+Tfij6eAo9iYb+ml2vyuEgZiNTdfkCxI
CzBo7udOcamziz9x8KINJidjwCv0vGO8vhmTQav1sJP71vd5T/t1jghK3DA6uz5GNFoaGG5F3Pl9
JrgNWkmufuJVMFyC19GUPxm8EPys9yvo8n4Lf1FugeRuIBZPU8K7ABEBAAHND2FiYmRlZkB0ZXN0
LmNvbcLAiQQTAQgAMxYhBLeQro9CXcRGM6jAht9jZZw7SoH7BQJgSiaUAhsDBQsJCAcCBhUICQoL
AgUWAgMBAAAKCRDfY2WcO0qB+2ADB/94z3/Y0OQAJqvJSIaPtw7NJdyrsh7guahyGKdMFxVLeGmp
dCbW9wHwBJ4vDd4sSt6ufX3iQfrwZn5RHtX97AAJ0kZOPJBTlhDPClU1sDudbStde4UpJ6EtYWV6
o2CLiFQA8OT0endU1b6uiGDOGkUz98lzyqvKlP6lT3EwW68xSL3NrewNoYJDQox7N9ATznGSbGaG
Jl2STYYA082bpXbgi2cKKwKo3WkSn4iEBEVdrO5yj8PyoOUwE5RK3mCbNLW5KEhY7hHWLz6IO+NC
7xHj4UZdVxtLjZVtui0Ha9qGO5iTs/S3KwhQ/9uA22RUc438vPBdVJ7kDAD+m2SPobWkzsBNBGBK
JpQBCAC+zvtIhjKvb8tYaDXHJPivBNhWYq2xOuUt/yXZs2DPYLEGbiELz/URPW1ew8aYmrtqHg7z
Q47kXz/P5HxZsrMq3bal4mRW02cC9jZT7FrCNI/IE3og3PbHd43spTR8IAz0PDM1huZ/IU0OOBU5
xjgTRFTGv7eaA39xY0KU8GKtTCXuzPa/3gYby3em2E6tgrCKoicnMtf4uaWIsd6fJ5i5scSBFD93
0c44U7QgAKuoB90n6887PtNH0voRfrRpLPGQg55WWCHUsx4WdZvPQOw8UPgNVdu+O4+k2xdJ6mEA
Nz0et1bXDy1b91ywpBTqXzdnwBZ2dFxqsiSTTn11i4XlABEBAAHCwHYEGAEIACAWIQS3kK6PQl3E
RjOowIbfY2WcO0qB+wUCYEommAIbDAAKCRDfY2WcO0qB+6OQB/wInDNjHfjnqiorwbAg7mOg5qUl
a9Lrqz9o6ysw9UUV2aof366sy1B3SaYO6gd5vvLF9TTxpgk4ciAjJ8A0m5Xwywmz0chQ766aye/J
IKcMsL1I47EpMbuxMfZWYEamNxEtpuPVuKpJOwVW//obiqTYBBpsPovi9s1j66aSBO6Ij9h9V8FQ
TIxPYXu77fCgpVkxh4RffsGQ8l7H/aRQp8a9sKdCe5X7uOF/6Amw25Rfzm1RN9Yg04bVPxtjD2L1
SqxF5hZCC16HX1SL4GLY9MjLv2JUw6vlMqjASXKI5MyAlpKAicSe1P5yd/ysM9YiLQHriF3+hYxX
PsqHPr70z6If
=ack7
-----END PGP PUBLIC KEY BLOCK-----
` });
  const contactABCDEF = await ContactStore.obj({
    email: 'abcdef@test.com', pubkey: `-----BEGIN PGP PUBLIC KEY BLOCK-----

xsBNBGBKJS4BCADxtPTToUQsjy8G88QBeU3a+B0l2CHy6OhsHJkuUOEzM0S++rZqLJJCGdgVAdAF
o+vk1SyaQRQRMMl3mmFc0Qf3kDWARAT7TCvnYGfiR6PyAn7jcyFsY6y88jF6YrjEs30Tz0I8pItC
rmsYGWtoDyBBfaXhZUAAHlRELaG/KzhIt66zowJkP4UwrBnOYzkw7yu4KUcmsOrG7t8XXqJ3LHuQ
Hi6eyWceuFz7Ybsy9qw7GYWxU60NfSnUssQTzRZL9ZeNDzxIjKlpC02SeAyexF9bHuoRbR5GB4QW
byLLcH15U9FTxlf8oHVgP8pD4AEwBrhc+rqLXX6wwT/3G0nFX+LhABEBAAHND2FiY2RlZkB0ZXN0
LmNvbcLAiQQTAQgAMxYhBDFV8Ri25zKzY4oc4WCLzXl6I/uRBQJgSiUyAhsDBQsJCAcCBhUICQoL
AgUWAgMBAAAKCRBgi815eiP7kdFlCACf7Qf9NZAHfE/CfiZHTTvw+RoLLYKu/Xg4s1uKfGVIe6+w
1wtdy/NHTtf2wWRU/oPC5PK8+P2GjpvwaJIIGCS7sdkeRrRfICxvhYSEGDfvZ2ojLBAz4IGggVcu
YkUc8ZLq1wOgh02wbjbkvIbDPLtPFoK/3hWswPPs+UoheCg1QfEKEpzvvg0NDxO8YhmFqedLYBBu
TSH/b1tIXAdujO2o8U7yUtOe+HZ5f9DHrXf8jiySJ1rZehb2srOt+H9+g7zUXBojqsqzJupuaj8f
5i7g0Hb0c4Kq2NdvoEU7dzFu/Tqy6Pv+ZpgktlOqiFyAwXH8sDBLqeWe8gGAk68lPe/tzsBNBGBK
JTIBCADI7CylGW0udtxCk2FM4lgcjEp1IAbcsarLd8TrxRRus/OTCm9e4FEmB5+nYX3uWhh5WSm7
zxX3ufjGyIx3fEPOrvjvdiZEUjTansMz+smuMk9+4sWVZcGT1BC0f7zGNfu3Hd2VbXOA763HdQnd
4S4oycj/aOBCjth1pgVMaEJEJAozC8uzzYBp4guMolreC2Xu1UixpPn2N/+ZjJzHDdIwC4yXjYT4
xz3IoPwl/XVsXZOofQR+v88AhmsHtXbJy0pGpY9jtd8gncq3DMFcOhACoU0o1wu7FwRDLtjR5W8R
yBAShf78spBzuBCunSfxw2Bv3ak+b43jtN77TrTZrF2xABEBAAHCwHYEGAEIACAWIQQxVfEYtucy
s2OKHOFgi815eiP7kQUCYEolOQIbDAAKCRBgi815eiP7kUMoB/0SvYvjthGGhzrHXHC2WusC6rEN
Szp7FrUbc5upp2dktVmH62jC649K9lsoJUhitcE8E2C+lLToIJMhsNIXgPP7Ai+a6dJn6LKwT95b
RZGNIk/dQehU53g0BNdsWDCBUa92vFmtngQ34nwM40iiYLraioCah9/yZGdANFAEFr4iA2mmfBlt
j3kOljjta/iqbEO0hWSVwUT7D7ljitU4/BOmyT0n10ra7FtUMfMzVHrvJZGjEkrk8DjVLunPkkqj
kM3d32EJ1lZdub6GcDURdWNaOd9FmNGizKYYu1Wgeik0SnrhCy6DGLT+JDfv1/arwK2s1Usi2SOq
X7O4C+D4oKVA
=a/tS
-----END PGP PUBLIC KEY BLOCK-----
` });
  const contactABCDDF = await ContactStore.obj({
    email: 'abcddf@test.com', pubkey: `-----BEGIN PGP PUBLIC KEY BLOCK-----

xsBNBGBKJS4BCADxtPTToUQsjy8G88QBeU3a+B0l2CHy6OhsHJkuUOEzM0S++rZqLJJCGdgVAdAF
o+vk1SyaQRQRMMl3mmFc0Qf3kDWARAT7TCvnYGfiR6PyAn7jcyFsY6y88jF6YrjEs30Tz0I8pItC
rmsYGWtoDyBBfaXhZUAAHlRELaG/KzhIt66zowJkP4UwrBnOYzkw7yu4KUcmsOrG7t8XXqJ3LHuQ
Hi6eyWceuFz7Ybsy9qw7GYWxU60NfSnUssQTzRZL9ZeNDzxIjKlpC02SeAyexF9bHuoRbR5GB4QW
byLLcH15U9FTxlf8oHVgP8pD4AEwBrhc+rqLXX6wwT/3G0nFX+LhABEBAAHND2FiY2RlZkB0ZXN0
LmNvbcLAiQQTAQgAMxYhBDFV8Ri25zKzY4oc4WCLzXl6I/uRBQJgSiUyAhsDBQsJCAcCBhUICQoL
AgUWAgMBAAAKCRBgi815eiP7kdFlCACf7Qf9NZAHfE/CfiZHTTvw+RoLLYKu/Xg4s1uKfGVIe6+w
1wtdy/NHTtf2wWRU/oPC5PK8+P2GjpvwaJIIGCS7sdkeRrRfICxvhYSEGDfvZ2ojLBAz4IGggVcu
YkUc8ZLq1wOgh02wbjbkvIbDPLtPFoK/3hWswPPs+UoheCg1QfEKEpzvvg0NDxO8YhmFqedLYBBu
TSH/b1tIXAdujO2o8U7yUtOe+HZ5f9DHrXf8jiySJ1rZehb2srOt+H9+g7zUXBojqsqzJupuaj8f
5i7g0Hb0c4Kq2NdvoEU7dzFu/Tqy6Pv+ZpgktlOqiFyAwXH8sDBLqeWe8gGAk68lPe/tzsBNBGBK
JTIBCADI7CylGW0udtxCk2FM4lgcjEp1IAbcsarLd8TrxRRus/OTCm9e4FEmB5+nYX3uWhh5WSm7
zxX3ufjGyIx3fEPOrvjvdiZEUjTansMz+smuMk9+4sWVZcGT1BC0f7zGNfu3Hd2VbXOA763HdQnd
4S4oycj/aOBCjth1pgVMaEJEJAozC8uzzYBp4guMolreC2Xu1UixpPn2N/+ZjJzHDdIwC4yXjYT4
xz3IoPwl/XVsXZOofQR+v88AhmsHtXbJy0pGpY9jtd8gncq3DMFcOhACoU0o1wu7FwRDLtjR5W8R
yBAShf78spBzuBCunSfxw2Bv3ak+b43jtN77TrTZrF2xABEBAAHCwHYEGAEIACAWIQQxVfEYtucy
s2OKHOFgi815eiP7kQUCYEolOQIbDAAKCRBgi815eiP7kUMoB/0SvYvjthGGhzrHXHC2WusC6rEN
Szp7FrUbc5upp2dktVmH62jC649K9lsoJUhitcE8E2C+lLToIJMhsNIXgPP7Ai+a6dJn6LKwT95b
RZGNIk/dQehU53g0BNdsWDCBUa92vFmtngQ34nwM40iiYLraioCah9/yZGdANFAEFr4iA2mmfBlt
j3kOljjta/iqbEO0hWSVwUT7D7ljitU4/BOmyT0n10ra7FtUMfMzVHrvJZGjEkrk8DjVLunPkkqj
kM3d32EJ1lZdub6GcDURdWNaOd9FmNGizKYYu1Wgeik0SnrhCy6DGLT+JDfv1/arwK2s1Usi2SOq
X7O4C+D4oKVA
=a/tS
-----END PGP PUBLIC KEY BLOCK-----
` });
  const contactABDDEF = await ContactStore.obj({
    email: 'abddef@test.com', pubkey: `-----BEGIN PGP PUBLIC KEY BLOCK-----

xsBNBGBKJqQBCACzNxbtfJMZdrhzTpV34rEy4t50Q/8jwo4+z7GLPX6vSmHGy/Y4fOBsae5rXMr9
v02IAdoLgGTbPqSa5fDPWAbiyNL/M/5ojBwAzHBChWyD2543M1XOOOAgUm2dKospBww4RyavkE4t
Ng3HIY/eWtm0sDGuYYkwvrgu5Puc+1kMegdBkE1CkkNd/jC/EJnnYs3WDaVd1h1is/IxKJ8xjTQD
Rc2+YJYxCT5+KxRFlApqXogJDhPQEK+S8Rl/nMunxMVq9ls2ixdsnWdvA3+4xbRN6WLDKy/mx8XD
OqvOpXQ8f9rXiwwjW8EsoCFrTvCdh2JaY0uPqRtfcrQodhidAUMXABEBAAHND2FiZGRlZkB0ZXN0
LmNvbcLAiQQTAQgAMxYhBJ4CDZt1L9P/8X7Ztl/MFUHPKClRBQJgSiaoAhsDBQsJCAcCBhUICQoL
AgUWAgMBAAAKCRBfzBVBzygpUYZ7CACxwRjeDlaHQCNsV+yG3gwXorKBHmMVZ++pO2fjCWRIwQA6
DfkQ//tjudLwLIZRNFgdn9T04XEX3p65wkhK8vbyhTk18VS57NPLFpSjOrkhXd0JNgMNI0LVcOp9
gPkgQZ7qBlRh1rpZiZyO/sccJAb0RfLzbaMl7BOKOKsAvUOGT4eiIjp+37/HsrYvOaJkzt8vI4dx
RPuJ5rWJPrlnJuPO1im0hsi7dj9XrVdWth58AyMvQ5JjbAid9b42VZ4HuB1P+PSiDeUQq4O9ISWA
ZtKsfTusZSQP/Bq9jZf+ucdRIM7eo6NCY3X4jFefjsWdi7mofcFZCowMTc+PkCMCBsmlzsBNBGBK
JqgBCADSGmHgTuMTfCvoRbzJ14i2WtFFODl7BwY4U8NZG6YcNv7QsCWIqJkwBIzX1OquO8PiZd4D
AKuYpuG2KCF/vLNFkkq5BWkiMrGIZ7QYvtQFD+BwbAfREcs6ZUMm22eTrdqgs1o5vsDYGGsN36Qh
ClIDFcUwlpb/35ryrp50GjLFaKjdgBFhksKOY6ZJRJNZcq+i+ii4FizEiJ23vfrPWPByVip1jx4L
+MlYCG102pNPrnaBnU02tj+tXwfHDXVT5QygO7nX2YM96wTIVxH8seatyjDUK668PQYmT5vGQKl2
Ikr+orTzqJhMWN0gjA/EHRcpuQn2EJrTVi4+4oU6dZBzABEBAAHCwHYEGAEIACAWIQSeAg2bdS/T
//F+2bZfzBVBzygpUQUCYEomrQIbDAAKCRBfzBVBzygpUQFYB/9WfGAfJb3lIWEBIUE8viIH74B1
/E1lpWbGbyzSjJAUsFiEAwM0gRaYr9pY2iVsRJwr0dmmhSsESwSy0/dD97jCqjD4d/AkiSxmEMlA
F9PCnKC7HizaM33lA1S0pADBBEVtwfLd4t0bAo4TnJWnjb/fd9osyPEZGU1zF/fFsfLAIb9GC9VB
5nRZgXIUeTZDCypk0fCc25kGVO3i8H37eRXonV3TcmNEgYUBvi/3Pk3s/7GUkpp1cKtn4s7MnHzO
wBff8jybIDc7uGSzTW5qc/3qcgbfH0FGCoIy20H7zgnEJ6PnkENlb/WfynSHAXvfMc8r9YLTCrkv
WmiyOmaRmLP+
=Iusd
-----END PGP PUBLIC KEY BLOCK-----` });
  await ContactStore.save(undefined, contactABBDEF);
  await ContactStore.save(undefined, contactABCDEF);
  await ContactStore.save(undefined, contactABCDDF);
  await ContactStore.save(undefined, contactABDDEF);
  const contactsABC = await ContactStore.search(undefined, { has_pgp: true, substring: 'abc' });
  if (contactsABC.length !== 2) {
    throw Error(`Expected 2 contacts to match "abc" but got "${contactsABC.length}"`);
  }
  const contactsABCD = await ContactStore.search(undefined, { has_pgp: true, substring: 'abcd' });
  if (contactsABCD.length !== 2) {
    throw Error(`Expected 2 contacts to match "abcd" but got "${contactsABCD.length}"`);
  }
  const contactsABCDE = await ContactStore.search(undefined, { has_pgp: true, substring: 'abcde' });
  if (contactsABCDE.length !== 1) {
    throw Error(`Expected 1 contact to match "abcde" but got "${contactsABCDE.length}"`);
  }
  if (contactsABCDE[0].email !== 'abcdef@test.com') {
    throw Error(`Expected "abcdef@test.com" but got "${contactsABCDE[0].email}"`);
  }
  return 'pass';
})();

BROWSER_UNIT_TEST_NAME(`ContactStore doesn't store duplicates in searchable`);
(async () => {
  const db = await ContactStore.dbOpen();
  const contact = await ContactStore.obj({
    email: 'this.word.this.word@this.word.this.word', name: 'This Word THIS WORD this word'
  });
  await ContactStore.save(db, contact);
  // extract the entity from the database to see the actual field
  const entity = await new Promise((resolve, reject) => {
    const req = db.transaction(['emails'], 'readonly').objectStore('emails').get(contact.email);
    ContactStore.setReqPipe(req, () => resolve(req.result), reject);
  });
  if (entity?.searchable.length !== 2) {
    throw Error(`Expected 2 entries in 'searchable' but got "${entity?.searchable}"`);
  }
  return 'pass';
})();

BROWSER_UNIT_TEST_NAME(`ContactStore doesn't store smaller words in searchable when there is a bigger one that starts with it`);
(async () => {
  const db = await ContactStore.dbOpen();
  const contact = await ContactStore.obj({
    email: 'a@big.one', name: 'Bigger'
  });
  await ContactStore.save(db, contact);
  // extract the entity from the database to see the actual field
  const entity = await new Promise((resolve, reject) => {
    const req = db.transaction(['emails'], 'readonly').objectStore('emails').get(contact.email);
    ContactStore.setReqPipe(req, () => resolve(req.result), reject);
  });
  if (entity?.searchable.length !== 3 || !entity.searchable.includes('f:a')
    || !entity.searchable.includes('f:bigger') || !entity.searchable.includes('f:one')) {
    throw Error(`Expected "a bigger one" entries in 'searchable' but got "${entity?.searchable}"`);
  }
  return 'pass';
})();

BROWSER_UNIT_TEST_NAME(`ContactStore.update updates correct 'pubkey_last_check'`);
(async () => {
  const db = await ContactStore.dbOpen();
  const email = 'flowcrypt.compatibility@gmail.com';
  const date2_0 = Date.now();
  const contacts = [
  await ContactStore.obj({
    email,
    pubkey: testConstants.flowcryptcompatibilityPublicKey7FDE685548AEA788
  }),
  await ContactStore.obj({
    email,
    pubkey: testConstants.flowcryptcompatibilityPublicKeyADAC279C95093207,
    lastCheck: date2_0
  })];
  await ContactStore.save(db, contacts);
  // extract the entities from the database
  const fp1 = '5520CACE2CB61EA713E5B0057FDE685548AEA788';
  const fp2 = 'E8F0517BA6D7DAB6081C96E4ADAC279C95093207';
  const getEntity = async(fp) => { return await new Promise((resolve, reject) => {
    const req = db.transaction(['pubkeys'], 'readonly').objectStore('pubkeys').get(fp);
    ContactStore.setReqPipe(req, () => resolve(req.result), reject);
  }); };
  let entity1 = await getEntity(fp1);
  let entity2 = await getEntity(fp2);
  if (entity1.fingerprint !== fp1) {
    throw Error(`Failed to extract pubkey ${fp1}`);
  }
  if (entity2.fingerprint !== fp2) {
    throw Error(`Failed to extract pubkey ${fp2}`);
  }
  if (entity1.lastCheck) {
    throw Error(`Expected undefined lastCheck for ${fp1} but got ${entity1.lastCheck}`);
  }
  if (entity2.lastCheck !== date2_0) {
    throw Error(`Expected lastCheck=${date2_0} for ${fp2} but got ${entity2.lastCheck}`);
  }
  const pubkey1 = await KeyUtil.parse(testConstants.flowcryptcompatibilityPublicKey7FDE685548AEA788);
  const pubkey2 = await KeyUtil.parse(testConstants.flowcryptcompatibilityPublicKeyADAC279C95093207);
  const date1_1 = date2_0 + 1000;
  // update entity 1 with pubkey_last_check = date1_1
  await ContactStore.update(db, email, { pubkey_last_check: date1_1, pubkey: pubkey1 });
  // extract the entities from the database
  entity1 = await getEntity(fp1);
  entity2 = await getEntity(fp2);
  if (entity1.lastCheck !== date1_1) {
    throw Error(`Expected lastCheck=${date1_1} for ${fp1} but got ${entity1.lastCheck}`);
  }
  if (entity2.lastCheck !== date2_0) {
    throw Error(`Expected lastCheck=${date2_0} for ${fp2} but got ${entity2.lastCheck}`);
  }
  const date2_2 = date1_1 + 10000;
  // updating with undefined value shouldn't modify pubkey_last_check
  await ContactStore.update(db, email, { pubkey_last_check: undefined, pubkey: pubkey1 });
  await ContactStore.update(db, email, { pubkey_last_check: date2_2, pubkey: pubkey2 });
  // extract the entities from the database
  entity1 = await getEntity(fp1);
  entity2 = await getEntity(fp2);
  if (entity1.lastCheck !== date1_1) {
    throw Error(`Expected lastCheck=${date1_1} for ${fp1} but got ${entity1.lastCheck}`);
  }
  if (entity2.lastCheck !== date2_2) {
    throw Error(`Expected lastCheck=${date2_2} for ${fp2} but got ${entity2.lastCheck}`);
  }
  // updating contact details without specifying a pubkey shouln't update pubkey_last_check
  await ContactStore.update(db, email, { name: 'Some Name' });
  // extract the entities from the database
  entity1 = await getEntity(fp1);
  entity2 = await getEntity(fp2);
  if (entity1.lastCheck !== date1_1) {
    throw Error(`Expected lastCheck=${date1_1} for ${fp1} but got ${entity1.lastCheck}`);
  }
  if (entity2.lastCheck !== date2_2) {
    throw Error(`Expected lastCheck=${date2_2} for ${fp2} but got ${entity2.lastCheck}`);
  }
  return 'pass';
})();

BROWSER_UNIT_TEST_NAME(`ContactStore.update tests`);
(async () => {
  const db = await ContactStore.dbOpen();
  const email1 = 'email1@test.com';
  const email2 = 'email2@test.com';
  const contacts = [
    await ContactStore.obj({ email: email1 }),
    await ContactStore.obj({ email: email2 })];
  await ContactStore.save(db, contacts);
  const expectedObj1 = {
    email: email1,
    name: undefined,
    pendingLookup: 0,
    lastUse: undefined
  }
  const expectedObj2 = {
    email: email2,
    name: undefined,
    pendingLookup: 0,
    lastUse: undefined
  }
  const getEntity = async(email) => { return await new Promise((resolve, reject) => {
    const req = db.transaction(['emails'], 'readonly').objectStore('emails').get(email);
    ContactStore.setReqPipe(req, () => resolve(req.result), reject);
  }); };
  const compareEntity = async(expectedObj) => { 
    const loaded = await getEntity(expectedObj.email);
    if (loaded.name != expectedObj.name) {
      throw Error(`name field mismatch, expected ${expectedObj.name} but got ${loaded.name}`);
    }
    if (loaded.pendingLookup != expectedObj.pendingLookup) {
      throw Error(`pendingLookup field mismatch, expected ${expectedObj.pendingLookup} but got ${loaded.pendingLookup}`);
    }
    if (loaded.lastUse != expectedObj.lastUse) {
      throw Error(`lastUse field mismatch, expected ${expectedObj.lastUse} but got ${loaded.lastUse}`);
    }
  };
  const compareEntities = async() => {
    await compareEntity(expectedObj1);
    await compareEntity(expectedObj2);
  }
  await compareEntities();
  expectedObj1.name = 'New Name for contact 1';
  await ContactStore.update(db, email1, { name: expectedObj1.name });
  await compareEntities();
  expectedObj2.pendingLookup = 1;
  // provide any non-zero value
  await ContactStore.update(db, email2, { pending_lookup: 4 });
  await compareEntities();
  expectedObj2.pendingLookup = 0;
  // provide a "zero" value
  await ContactStore.update(db, email2, { pending_lookup: undefined });
  await compareEntities();
  const date = new Date();
  expectedObj1.lastUse = date.getTime();
  await ContactStore.update(db, email1, {last_use: date });
  await compareEntities();
  expectedObj1.lastUse = undefined;
  await ContactStore.update(db, email1, {last_use: undefined });
  await compareEntities();
  return 'pass';
})();

BROWSER_UNIT_TEST_NAME(`ContactStore saves and returns dates as numbers`);
(async () => {
  // we'll use background operation to make sure the date isn't transformed on its way
  const email = 'test@expired.com';
  const lastCheck = Date.now();
  const lastUse = lastCheck + 1000;
  const contact = await ContactStore.obj({ email, pubkey:testConstants.expiredPub, lastCheck, lastUse });
  await ContactStore.save(undefined, [contact]);
  const [loaded] = await ContactStore.get(undefined, [email]);
  if (typeof loaded.last_use !== 'number') {
    throw Error(`last_use was expected to be a number, but got ${typeof loaded.last_use}`);
  }
  if (typeof loaded.pubkey_last_check !== 'number') {
    throw Error(`pubkey_last_check was expected to be a number, but got ${typeof loaded.pubkey_last_check}`);
  }
  if (typeof loaded.last_use !== 'number') {
    throw Error(`expiresOn was expected to be a number, but got ${typeof loaded.expiresOn}`);
  }
  return 'pass';
})();
