/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

BROWSER_UNIT_TEST_NAME(`[unit][migrateAccountStorageKeys] preserves colliding legacy namespaces and migrates other accounts`);
(async () => {
  const accountEmailsKey = 'cryptup_global_account_emails';
  const migrationMarkerKey = 'cryptup_global_email_key_index_migrated';
  const skippedAccountsKey = 'cryptup_global_email_key_index_skipped_accounts';
  const legacyStorageKey = 'cryptup_abcorptest_keys';
  const sharedDestinations = ['cryptup_a~2db~40corp~2etest_keys', 'cryptup_ab~40corp~2etest_keys'];
  const unaffectedLegacyKey = 'cryptup_othercorptest_keys';
  const unaffectedNewKey = 'cryptup_other~40corp~2etest_keys';
  const keys = [accountEmailsKey, migrationMarkerKey, skippedAccountsKey, legacyStorageKey, ...sharedDestinations, unaffectedLegacyKey, unaffectedNewKey];
  const get = keys => new Promise(resolve => chrome.storage.local.get(keys, resolve));
  const set = values => new Promise(resolve => chrome.storage.local.set(values, resolve));
  const remove = keys => new Promise(resolve => chrome.storage.local.remove(keys, resolve));
  const previous = await get(keys);
  try {
    await remove(keys);
    await set({
      [accountEmailsKey]: JSON.stringify(['a-b@corp.test', 'ab@corp.test', 'other@corp.test']),
      [legacyStorageKey]: { private: 'shared-data' },
      [unaffectedLegacyKey]: { private: 'unaffected-data' },
    });
    await migrateAccountStorageKeys();
    const storage = await get(keys);
    if (storage[legacyStorageKey]?.private !== 'shared-data') throw Error('Legacy data changed after collision');
    if (sharedDestinations.some(key => storage[key] !== undefined)) throw Error('Shared data was copied to an account');
    if (storage[unaffectedLegacyKey] !== undefined || storage[unaffectedNewKey]?.private !== 'unaffected-data') {
      throw Error('Unaffected account did not migrate');
    }
    if (storage[migrationMarkerKey] !== true) throw Error('Migration did not complete');
    if (JSON.stringify(storage[skippedAccountsKey]) !== JSON.stringify(['a-b@corp.test', 'ab@corp.test'])) {
      throw Error('Skipped accounts were not recorded');
    }
    return 'pass';
  } finally {
    await remove(keys);
    const restore = {};
    for (const key of keys) {
      if (previous[key] !== undefined) restore[key] = previous[key];
    }
    if (Object.keys(restore).length) await set(restore);
  }
})();

BROWSER_UNIT_TEST_NAME(`[unit][migrateAccountStorageKeys] preserves legacy data and retries after a failed write`);
(async () => {
  const accountEmailsKey = 'cryptup_global_account_emails';
  const migrationMarkerKey = 'cryptup_global_email_key_index_migrated';
  const skippedAccountsKey = 'cryptup_global_email_key_index_skipped_accounts';
  const legacyKey = 'cryptup_aliceexamplecom_keys';
  const destinationKey = 'cryptup_alice~40example~2ecom_keys';
  const keys = [accountEmailsKey, migrationMarkerKey, skippedAccountsKey, legacyKey, destinationKey];
  const get = keys => new Promise(resolve => chrome.storage.local.get(keys, resolve));
  const set = values => new Promise(resolve => chrome.storage.local.set(values, resolve));
  const remove = keys => new Promise(resolve => chrome.storage.local.remove(keys, resolve));
  const previous = await get(keys);
  const originalSet = chrome.storage.local.set;
  const lastErrorDescriptor = Object.getOwnPropertyDescriptor(chrome.runtime, 'lastError');
  try {
    await remove(keys);
    await set({
      [accountEmailsKey]: JSON.stringify(['alice@example.com']),
      [legacyKey]: { private: 'existing-private-key' },
    });
    chrome.storage.local.set = (values, callback) => {
      Object.defineProperty(chrome.runtime, 'lastError', {
        configurable: true,
        value: { message: 'IO error: test: Unable to create sequential file' },
      });
      try {
        callback();
      } finally {
        if (lastErrorDescriptor) Object.defineProperty(chrome.runtime, 'lastError', lastErrorDescriptor);
        else delete chrome.runtime.lastError;
      }
    };
    let migrationError;
    try {
      await migrateAccountStorageKeys();
    } catch (e) {
      migrationError = e;
    } finally {
      chrome.storage.local.set = originalSet;
    }
    if (!migrationError || !String(migrationError).includes('Unable to create sequential file')) throw Error('Expected write failure to reject migration');
    const failedStorage = await get(keys);
    if (failedStorage[legacyKey]?.private !== 'existing-private-key') throw Error('Legacy data removed after write failure');
    if (failedStorage[destinationKey] !== undefined) throw Error('Failed write unexpectedly saved destination data');
    if (failedStorage[migrationMarkerKey] !== undefined) throw Error('Failed migration marked complete');

    await migrateAccountStorageKeys();
    const retriedStorage = await get(keys);
    if (retriedStorage[destinationKey]?.private !== 'existing-private-key') throw Error('Retry did not migrate private key');
    if (retriedStorage[legacyKey] !== undefined) throw Error('Retry did not remove legacy data');
    if (retriedStorage[migrationMarkerKey] !== true) throw Error('Retry did not complete');
    return 'pass';
  } finally {
    chrome.storage.local.set = originalSet;
    await remove(keys);
    const restore = {};
    for (const key of keys) {
      if (previous[key] !== undefined) restore[key] = previous[key];
    }
    if (Object.keys(restore).length) await set(restore);
  }
})();

BROWSER_UNIT_TEST_NAME(`[unit][migrateAccountStorageKeys] retries failed reads, removals, and completion writes`);
(async () => {
  const accountList = 'cryptup_global_account_emails';
  const marker = 'cryptup_global_email_key_index_migrated';
  const skipped = 'cryptup_global_email_key_index_skipped_accounts';
  const legacy = 'cryptup_aliceexamplecom_keys';
  const destination = 'cryptup_alice~40example~2ecom_keys';
  const storage = chrome.storage.local;
  const { get, set, remove } = storage;
  const keys = [accountList, marker, skipped, legacy, destination];
  const error = { message: 'IO error: test: Unable to create sequential file' };
  const fail = (callback, ...args) => {
    Object.defineProperty(chrome.runtime, 'lastError', { configurable: true, value: error });
    try {
      callback(...args);
    } finally {
      delete chrome.runtime.lastError;
    }
  };

  for (const stage of ['read', 'remove', 'complete']) {
    await storage.remove(keys);
    await storage.set({ [accountList]: JSON.stringify(['alice@example.com']), [legacy]: 'legacy key' });
    let rejected = false;
    try {
      if (stage === 'read') {
        storage.get = (...args) => (args.length === 1 ? fail(args[0], {}) : get.call(storage, ...args));
      } else if (stage === 'remove') {
        storage.remove = (keys, callback) => fail(callback);
      } else {
        storage.set = (values, callback) => (marker in values ? fail(callback) : set.call(storage, values, callback));
      }
      await migrateAccountStorageKeys();
    } catch (e) {
      if (!String(e).includes(error.message)) throw e;
      rejected = true;
    } finally {
      Object.assign(storage, { get, set, remove });
    }
    if (!rejected) throw Error(`Expected ${stage} to reject`);
    const failed = await storage.get(keys);
    if (marker in failed || skipped in failed) throw Error(`Migration marked complete after failed ${stage}`);
    if (stage !== 'complete' && failed[legacy] !== 'legacy key') throw Error(`Lost legacy key after failed ${stage}`);
    if (stage !== 'read' && failed[destination] !== 'legacy key') throw Error(`Lost copied key after failed ${stage}`);

    if (stage === 'remove') await storage.set({ [destination]: 'newer key' });
    await migrateAccountStorageKeys();
    const expected = stage === 'remove' ? 'newer key' : 'legacy key';
    const retried = await storage.get(keys);
    if (retried[marker] !== true || retried[destination] !== expected || legacy in retried) {
      throw Error(`Retry did not safely finish after failed ${stage}`);
    }
  }

  await storage.set({ [legacy]: 'late legacy value' });
  await migrateAccountStorageKeys();
  if ((await storage.get(legacy))[legacy] !== 'late legacy value') throw Error('Completed migration ran again');
  return 'pass';
})();

BROWSER_UNIT_TEST_NAME(`[unit][migrateAccountStorageKeys] preserves all values in a large storage snapshot`);
(async () => {
  const accounts = Array.from({ length: 20 }, (_, i) => `account${i}@example.com`);
  const colliding = ['a@bc.test', 'ab@c.test'];
  const fixture = {
    cryptup_global_account_emails: JSON.stringify([...accounts, ...colliding]),
    cryptup_abctest_keys: 'ambiguous',
    cryptup_account0examplecomextra_keys: 'different prefix',
    unrelated: 'x'.repeat(4 * 1024 * 1024),
  };
  const expected = {};
  const legacyKeys = [];
  for (const [i, email] of accounts.entries()) {
    const oldPrefix = `cryptup_account${i}examplecom_`;
    const newPrefix = `cryptup_account${i}~40example~2ecom_`;
    const values = {
      keys: [{ private: 'k'.repeat(800 * 1024) + email }],
      passphrase_AABB: `passphrase${i}`,
      google_token_refresh: `refresh${i}`,
      rules: { flags: [`rule${i}`] },
      setup_done: true,
    };
    for (const [key, value] of Object.entries(values)) {
      fixture[oldPrefix + key] = value;
      expected[newPrefix + key] = value;
      legacyKeys.push(oldPrefix + key);
    }
  }
  const storage = chrome.storage.local;
  await storage.remove(['cryptup_global_email_key_index_migrated']);
  await storage.set(fixture);
  const start = performance.now();
  await migrateAccountStorageKeys();
  const elapsed = Math.round(performance.now() - start);
  const result = await storage.get();
  if (legacyKeys.some(key => key in result)) throw Error('Legacy account values remain');
  for (const [key, value] of Object.entries(expected)) {
    if (JSON.stringify(result[key]) !== JSON.stringify(value)) throw Error(`Unexpected migrated value for ${key}`);
  }
  for (const key of ['unrelated', 'cryptup_abctest_keys', 'cryptup_account0examplecomextra_keys', 'cryptup_global_account_emails']) {
    if (result[key] !== fixture[key]) throw Error(`Unexpected change to ${key}`);
  }
  if ('cryptup_a~40bc~2etest_keys' in result || 'cryptup_ab~40c~2etest_keys' in result) throw Error('Ambiguous key was copied');
  if (JSON.stringify(result.cryptup_global_email_key_index_skipped_accounts) !== JSON.stringify(colliding)) {
    throw Error('Boundary collision was not recorded');
  }
  await migrateAccountStorageKeys();
  if (JSON.stringify(await storage.get()) !== JSON.stringify(result)) throw Error('Completed migration changed storage');
  console.info(`Migrated large fixture in ${elapsed} ms`);
  return 'pass';
})();

BROWSER_UNIT_TEST_NAME(`[unit][accountStorageReady] dispatches readiness only after successful background initialization`);
(async () => {
  const { BrowserMsg } = await import('/js/common/browser/browser-msg.js');
  const message = { name: 'account_storage_ready', data: { bm: {} } };
  const onMessage = chrome.runtime.onMessage;
  const originalAddListener = onMessage.addListener;
  try {
    for (const succeeds of [true, false]) {
      const initialization = Promise.withResolvers();
      let calls = 0;
      BrowserMsg.bgAddListener(message.name, async () => {
        calls++;
      });
      let listener;
      onMessage.addListener = callback => (listener = callback);
      BrowserMsg.bgListen(initialization.promise);

      const response = Promise.withResolvers();
      let responded = false;
      const channelOpen = listener(message, {}, rawResponse => {
        responded = true;
        response.resolve(rawResponse);
      });
      if (!channelOpen) throw Error('Dispatcher did not keep the response channel open');
      await new Promise(resolve => setTimeout(resolve, 0));
      if (responded || calls) throw Error('Readiness request was dispatched before initialization completed');

      if (succeeds) {
        initialization.resolve();
        if ((await response.promise).exception || calls !== 1) throw Error('Expected readiness acknowledgement');
      } else {
        initialization.reject(new Error('Account storage migration failed'));
        const { exception } = await response.promise;
        if (!exception?.message.includes('Account storage migration failed') || calls) {
          throw Error('Expected initialization failure to reach the caller without running the readiness handler');
        }
      }
    }
    return 'pass';
  } finally {
    onMessage.addListener = originalAddListener;
  }
})();

BROWSER_UNIT_TEST_NAME(`[unit][accountStorageReady] shares readiness, retries transient failures, and propagates errors`);
(async () => {
  const { BrowserMsg, BgNotReadyErr } = await import('/js/common/browser/browser-msg.js');
  const { Time } = await import('/js/common/browser/time.js');
  const marker = 'cryptup_global_email_key_index_migrated';
  const key = 'cryptup_alice~40example~2ecom_setup_done';
  const storage = chrome.storage.local;
  await storage.remove([marker, key]);

  const originalReady = BrowserMsg.send.bg.await.accountStorageReady;
  const originalSleep = Time.sleep;
  const originalReload = chrome.runtime.reload;
  let reloads = 0;
  let requests = 0;
  let delays = 0;
  chrome.runtime.reload = () => reloads++;
  Time.sleep = async ms => {
    if (ms !== 300) throw Error(`Unexpected retry delay: ${ms}`);
    delays++;
  };

  try {
    BrowserMsg.send.bg.await.accountStorageReady = async () => {
      requests++;
      throw new BgNotReadyErr('background disconnected');
    };
    const failed = await Promise.allSettled([AcctStore.get('alice@example.com', ['setup_done']), AcctStore.set('alice@example.com', { setup_done: true })]);
    if (failed.some(result => result.status !== 'rejected' || !(result.reason instanceof BgNotReadyErr))) throw Error('Expected both operations to reject');
    if (requests !== 10 || delays !== 9 || reloads !== 0 || key in (await storage.get(key))) throw Error('Incorrect retry or write behavior');

    const initError = new Error('initialization failed');
    BrowserMsg.send.bg.await.accountStorageReady = async () => {
      requests++;
      throw initError;
    };
    const [failure] = await Promise.allSettled([AcctStore.get('alice@example.com', ['setup_done'])]);
    if (failure.status !== 'rejected' || failure.reason !== initError || requests !== 11) throw Error('Initialization failure was not propagated');

    const { promise, resolve } = Promise.withResolvers();
    const { promise: waiting, resolve: started } = Promise.withResolvers();
    BrowserMsg.send.bg.await.accountStorageReady = () => {
      requests++;
      started();
      return promise;
    };
    const read = AcctStore.get('alice@example.com', ['setup_done']);
    const write = AcctStore.set('alice@example.com', { setup_done: true });
    await waiting;
    if (key in (await storage.get(key))) throw Error('Write ran before readiness');
    await storage.set({ [marker]: true, [key]: true });
    resolve();
    if (!(await read).setup_done) throw Error('Read did not see migrated state');
    await write;
    await AcctStore.get('alice@example.com', ['setup_done']);
    if (requests !== 12) throw Error('Expected concurrent and later access to reuse readiness');
    return 'pass';
  } finally {
    BrowserMsg.send.bg.await.accountStorageReady = originalReady;
    Time.sleep = originalSleep;
    chrome.runtime.reload = originalReload;
  }
})();
