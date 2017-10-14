/* Business Source License 1.0 © 2016-2017 FlowCrypt Limited. Use limitations apply. Contact human@flowcrypt.com */

'use strict';

// plugins first installed as version 4.2.2 and up
localStorage.resolved_naked_key_vulnerability = true;

// plugins first installed as version 4.3.1 and up: will not use master_public_key and master_private_key in local storage
// instead, all keys in each account in one array
localStorage.uses_account_keys_array = true;

// let people know that name was changed to FlowCrypt only if they installed before v 5.0.0
window.flowcrypt_storage.set(null, { namechange_flowcrypt_notified: true });
