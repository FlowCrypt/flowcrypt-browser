/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

BROWSER_UNIT_TEST_NAME(`[unit][ExpirationCache] entry expires after configured interval`);
(async () => {
  // Added sleep function here because we don't want to include Util library only for this case.
  const sleep = async seconds => {
    return await new Promise(resolve => setTimeout(resolve, seconds * 1000));
  };
  const cache = new ExpirationCache('test-cache', 2000); // 2 seconds
  await cache.set('test-key', 'test-value');
  let cacheValue = await cache.get('test-key');
  if (cacheValue !== 'test-value') {
    throw Error(`Expected cache value to be equal to "test-value" but got ${cacheValue}`);
  }
  await sleep(2);
  cacheValue = await cache.get('test-key');
  if (cacheValue) {
    throw Error(`Expected cache value to be undefined but got ${cacheValue}`);
  }
  return 'pass';
})();

BROWSER_UNIT_TEST_NAME(`[unit][ExpirationCache.await] removes rejected promises from cache`);
(async () => {
  const cache = new ExpirationCache('test-cache-promise', 24 * 60 * 60 * 1000); // 24 hours
  const rejectionPromise = Promise.reject(Error('test-error'));
  cache.set('test-key', rejectionPromise);
  let cacheValue = cache.get('test-key');
  if (cacheValue?.length) {
    throw Error(`Expected cache value to be undefined but got ${JSON.stringify(cacheValue)}`);
  } // next call simply returns undefined
  const fulfilledPromise = Promise.resolve('new-test-value');
  cache.set('test-key', fulfilledPromise);
  cacheValue = await cache.await('test-key', fulfilledPromise);
  // good value is returned indefinitely
  if (cacheValue !== 'new-test-value') {
    throw Error(`Expected cache value to be "new-test-value" but got ${cacheValue}`);
  }
  cacheValue = await cache.await('test-key', fulfilledPromise);
  // good value is returned indefinitely
  if (cacheValue !== 'new-test-value') {
    throw Error(`Expected cache value to be "new-test-value" but got ${cacheValue}`);
  }
  return 'pass';
})();
