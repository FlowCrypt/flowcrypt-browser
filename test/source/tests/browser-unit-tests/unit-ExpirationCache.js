/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */
BROWSER_UNIT_TEST_NAME(`[unit][ExpirationCache] entry expires after configured interval`);
(async () => {
  const cache = new ExpirationCache(2000); // 2 seconds
  await cache.set('test-key', 'test-value');
  expect(await cache.get('test-key')).to.equal('test-value');
  await Util.sleep(2);
  expect(await cache.get('test-key')).to.be.an('undefined');
  return 'pass';
})();
