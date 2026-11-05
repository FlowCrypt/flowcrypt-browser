/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

BROWSER_UNIT_TEST_NAME(`[unit][migrateAccountStorageKeys] rejects colliding legacy namespaces before rewriting storage`);
(async () => {
  const accountEmailsKey = 'cryptup_global_account_emails';
  const migrationMarkerKey = 'cryptup_global_email_key_index_migrated';
  const legacyStorageKey = 'cryptup_abcorptest_keys';
  const keys = [accountEmailsKey, migrationMarkerKey, legacyStorageKey];
  const get = keys => new Promise(resolve => chrome.storage.local.get(keys, resolve));
  const set = values => new Promise(resolve => chrome.storage.local.set(values, resolve));
  const remove = keys => new Promise(resolve => chrome.storage.local.remove(keys, resolve));
  const previous = await get(keys);
  try {
    await remove(keys);
    await set({
      [accountEmailsKey]: JSON.stringify(['a-b@corp.test', 'ab@corp.test']),
      [legacyStorageKey]: { private: 'shared-data' },
    });
    let migrationError;
    try {
      await migrateAccountStorageKeys();
    } catch (e) {
      migrationError = e;
    }
    if (!migrationError || !String(migrationError).includes('legacy storage namespaces collide')) {
      throw Error('Expected migration to reject colliding legacy namespaces');
    }
    const storage = await get(keys);
    if (storage[legacyStorageKey]?.private !== 'shared-data') throw Error('Legacy data changed after collision');
    if (storage[migrationMarkerKey] !== undefined) throw Error('Migration marker was set after collision');
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
