/* Business Source License 1.0 © 2016 FlowCrypt Limited (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/CryptUp/cryptup-browser/tree/master/src/LICENCE */

'use strict';

// plugins first installed as version 4.2.2 and up
localStorage.resolved_naked_key_vulnerability = true;

// plugins first installed as version 4.3.1 and up: will not use master_public_key and master_private_key in local storage
// instead, all keys in each account in one array
localStorage.uses_account_keys_array = true;