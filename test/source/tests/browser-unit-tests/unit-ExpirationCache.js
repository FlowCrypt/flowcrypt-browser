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

BROWSER_UNIT_TEST_NAME(`[unit][ExpirationCache] awaits rejected promises and allows retry`);
(async () => {
  const cache = new ExpirationCache('test-cache-promise', 60000);
  const error = Error('test-error');
  const creating = cache.getOrCreate('test-key', async () => {
    throw error;
  });
  const getting = cache.get('test-key');
  const results = await Promise.allSettled([creating, getting]);
  if (results.some(result => result.status !== 'rejected' || result.reason !== error)) {
    throw Error('Both getOrCreate and get must reject with the original error');
  }
  if ((await cache.get('test-key')) !== undefined) throw Error('Rejected promise was retained');
  await cache.set('test-key', 'new-test-value');
  if ((await cache.get('test-key')) !== 'new-test-value') throw Error('Retry did not persist resolved value');
  const reloaded = new ExpirationCache('test-cache-promise', 60000);
  if ((await reloaded.get('test-key')) !== 'new-test-value') throw Error('Stored value was not serializable');
  return 'pass';
})();

BROWSER_UNIT_TEST_NAME(`[unit][ExpirationCache] deduplicates concurrent misses and retries failures`);
(async () => {
  const cache = new ExpirationCache('test-cache-dedup', 60000);
  let calls = 0;
  const create = async () => {
    calls++;
    throw Error('test-error');
  };
  const first = cache.getOrCreate('key', create);
  const second = cache.getOrCreate('key', create);
  if (first !== second) throw Error('Concurrent requests did not share a promise');
  const results = await Promise.allSettled([first, second]);
  if (calls !== 1 || results.some(result => result.status !== 'rejected')) throw Error('Failure was not deduplicated');
  const value = await cache.getOrCreate('key', async () => {
    calls++;
    return 'success';
  });
  if (value !== 'success' || calls !== 2) throw Error('Failure prevented retry');
  await cache.getOrCreate('key', async () => {
    throw Error('Should read session storage');
  });
  return 'pass';
})();

BROWSER_UNIT_TEST_NAME(`[unit][ExpirationCache] downloader retries full messages without evicting raw messages`);
(async () => {
  const { Downloader } = await import('/js/common/downloader.js');
  let fullCalls = 0;
  let rawCalls = 0;
  const downloader = new Downloader({
    msgGet: async (id, format) => {
      if (format === 'raw') {
        rawCalls++;
        return { id, raw: 'raw-value' };
      }
      fullCalls++;
      if (fullCalls === 1) throw Error('test-error');
      return { id, payload: { mimeType: 'text/plain' } };
    },
  });
  const id = 'cache-rejection-test';
  await downloader.msgGetRaw(id);
  const results = await Promise.allSettled([downloader.msgGetFull(id), downloader.msgGetFull(id)]);
  if (fullCalls !== 1 || results.some(result => result.status !== 'rejected')) throw Error('Full requests were not deduplicated');
  if ((await downloader.msgGetFull(id)).id !== id || fullCalls !== 2) throw Error('Full request did not retry');
  if ((await downloader.msgGetRaw(id)) !== 'raw-value' || rawCalls !== 1) throw Error('Raw cache was evicted');
  return 'pass';
})();

BROWSER_UNIT_TEST_NAME(`[unit][ExpirationCache] downloader restores serialized and cached attachment buffers`);
(async () => {
  const { Downloader } = await import('/js/common/downloader.js');
  let calls = 0;
  const downloader = new Downloader({
    attachmentGetChunk: async () => {
      calls++;
      return JSON.parse(JSON.stringify(Buf.fromUtfStr('attachment data')));
    },
  });
  const attachment = { id: 'cache-buffer-test', msgId: 'message', hasData: () => false };
  const first = await downloader.waitForAttachmentChunkDownload(attachment, 'plainFile');
  const second = await downloader.waitForAttachmentChunkDownload(attachment, 'plainFile');
  if (calls !== 1 || first.toUtfStr() !== 'attachment data' || second.toUtfStr() !== 'attachment data') {
    throw Error('Cached buffer did not retain its data and methods');
  }
  return 'pass';
})();
