/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

export type MessageToReplyOrForward = {
    headers: {
        date?: string,
        from?: string
    },
    text?: string
};
