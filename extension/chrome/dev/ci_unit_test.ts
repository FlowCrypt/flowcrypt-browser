/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Buf } from '../../js/common/core/buf.js';
import { KeyUtil } from '../../js/common/core/crypto/key.js';
import { AttachmentUI } from '../../js/common/ui/attachment-ui.js';
import { ApiErr } from '../../js/common/api/shared/api-error.js';
import { Mime } from '../../js/common/core/mime.js';
import { Attachment } from '../../js/common/core/attachment.js';
import { Wkd } from '../../js/common/api/key-server/wkd.js';
import { MsgUtil } from '../../js/common/core/crypto/pgp/msg-util.js';
import { Sks } from '../../js/common/api/key-server/sks.js';
import { Ui } from '../../js/common/browser/ui.js';
import { AcctStore } from '../../js/common/platform/store/acct-store.js';
import { ContactStore } from '../../js/common/platform/store/contact-store.js';
import { Debug } from '../../js/common/platform/debug.js';
import { Catch } from '../../js/common/platform/catch.js';
import { Url } from '../../js/common/core/common.js';
import { Gmail } from '../../js/common/api/email-provider/gmail/gmail.js';
import { PgpHash } from '../../js/common/core/crypto/pgp/pgp-hash.js';
import { PgpArmor } from '../../js/common/core/crypto/pgp/pgp-armor.js';
import { Xss } from '../../js/common/platform/xss.js';
import { ExpirationCache } from '../../js/common/core/expiration-cache.js';

/**
 * importing all libs that are tested in ci tests
 * add lib name below, let the IDE resolve the actual import
 */
const libs: unknown[] = [
  ApiErr,
  Attachment,
  AttachmentUI,
  Buf,
  ExpirationCache,
  KeyUtil,
  Mime,
  Wkd,
  Sks,
  MsgUtil,
  Ui,
  Url,
  AcctStore,
  ContactStore,
  Debug,
  Catch,
  Gmail,
  PgpHash,
  PgpArmor,
  Xss,
];
/* eslint-disable @typescript-eslint/no-explicit-any */
// add them to global scope so ci can use them
for (const lib of libs) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  (window as any)[(lib as any).name] = lib;
}
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
(window as any).MOCK_PORT = '[TEST_REPLACEABLE_MOCK_PORT]';
/* eslint-enable @typescript-eslint/no-explicit-any */
