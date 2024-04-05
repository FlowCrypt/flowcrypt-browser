/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

BROWSER_UNIT_TEST_NAME(`[unit][ExpirationCache] entry expires after configured interval`);
(async () => {
  // Added sleep function here because we don't want to include Util library only for this case.
  const sleep = async seconds => {
    return await new Promise(resolve => setTimeout(resolve, seconds * 1000));
  };
  const cache = new ExpirationCache(2000); // 2 seconds
  await cache.set('test-key', 'test-value');
  let cacheValue = await cache.get('test-key');
  if (cacheValue !== 'test-value') {
    throw Error(`Expected cache value to be equal to "test-value" but got ${cacheValue}`);
  }
  await sleep(2);
  cacheValue = await cache.get('test-key');
  if (cacheValue) {
    throw Error(`Expected cache value to be undefined to "test-value" but got ${cacheValue}`);
  }
  return 'pass';
})();
