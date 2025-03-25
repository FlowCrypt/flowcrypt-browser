/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { HttpClientErr, Status } from '../lib/api';
import Parse, { ParseMsgResult } from '../../util/parse';
import { isDelete, isGet, isPost, isPut, parsePort, parseResourceId } from '../lib/mock-util';
import { GmailMsg, GoogleData } from './google-data';
import { HandlersDefinition } from '../all-apis-mock';
import { AddressObject, ParsedMail } from 'mailparser';
import { TestBySubjectStrategyContext } from './strategies/send-message-strategy';
import { UnsupportableStrategyError } from './strategies/strategy-base';
import { OauthMock } from '../lib/oauth';
import { Util } from '../../util';
import { Dict } from '../../core/common';

type DraftSaveModel = { message: { raw: string; threadId: string } };

/* eslint-disable @typescript-eslint/naming-convention */
type OAuthTokenRequestModel = {
  grant_type: string;
  code: string;
  client_id: string;
  client_secret: string;
  redirect_uri: string;
};
/* eslint-enable @typescript-eslint/naming-convention */

const allowedRecipients: string[] = [
  'flowcrypt.compatibility@gmail.com',
  'manualcopypgp@flowcrypt.com',
  'censored@email.com',
  'test@email.com',
  'human@flowcrypt.com',
  'human+nopgp@flowcrypt.com',
  'expired.on.attester@domain.com',
  'ci.tests.gmail@flowcrypt.test',
  'smime1@recipient.com',
  'smime2@recipient.com',
  'smime@recipient.com',
  'smime.attachment@recipient.com',
  'auto.refresh.expired.key@recipient.com',
  'to@example.com',
  'cc@example.com',
  'bcc@example.com',
  'gatewayfailure@example.com',
  'flowcrypt.test.key.multiple.inbox1@gmail.com',
  'flowcrypt.test.key.multiple.inbox2@gmail.com',
  'mock.only.pubkey@flowcrypt.com',
  'vladimir@flowcrypt.com',
  'limon.monte@gmail.com',
  'sweetalert2@gmail.com',
  'sender@domain.com',
  'invalid@example.com',
  'timeout@example.com',
  'flowcrypt.test.key.new.manual.1@gmail.com',
  'user@prv-backup-to-designated-mailbox.flowcrypt.test',
  'admin@prv-backup-to-designated-mailbox.flowcrypt.test',
];

export type MockUserAlias = {
  sendAsEmail: string;
  displayName: string;
  replyToAddress: string;
  signature: string;
  isDefault: boolean;
  isPrimary: boolean;
  treatAsAlias: boolean;
  verificationStatus: string;
};

export interface GoogleConfig {
  contacts?: string[];
  othercontacts?: string[];
  aliases?: Dict<MockUserAlias[]>;
  primarySignature?: Dict<string>;
  getMsg?: Dict<Dict<{ error: Error } | { msg: GmailMsg }>>;
  getAttachment?: Dict<{ error: Error } | { data: string }>;
  draftIdToSave?: string;
  threadNotFoundError?: Record<string, number>;
  htmlRenderer?: (msgId: string, prerendered?: string) => string | undefined;
}

export const multipleEmailAliasList: MockUserAlias[] = [
  {
    sendAsEmail: 'alias1@example.com',
    displayName: 'An Alias1',
    replyToAddress: 'alias2@example.com',
    signature: '',
    isDefault: false,
    isPrimary: false,
    treatAsAlias: false,
    verificationStatus: 'accepted',
  },
  {
    sendAsEmail: 'alias2@example.com',
    displayName: 'An Alias1',
    replyToAddress: 'alias2@example.com',
    signature: 'Test signature 2',
    isDefault: false,
    isPrimary: false,
    treatAsAlias: false,
    verificationStatus: 'accepted',
  },
];

export const flowcryptCompatibilityPrimarySignature =
  '<div dir="ltr"><font size="2">flowcrypt.compatibility test footer with an img<br></font><div><font size="2">and second line</font></div<br><img src="https://flowcrypt.com/assets/imgs/svgs/flowcrypt-logo.svg" alt="Image result for small image"><br></div>';

export const flowcryptCompatibilityAliasList = [
  {
    sendAsEmail: 'flowcryptcompatibility@gmail.com',
    displayName: 'An Alias',
    replyToAddress: 'flowcryptcompatibility@gmail.com',
    signature: '',
    isDefault: false,
    isPrimary: false,
    treatAsAlias: false,
    verificationStatus: 'accepted',
  },
];
export const getMockGoogleEndpoints = (oauth: OauthMock, config: GoogleConfig | undefined): HandlersDefinition => {
  return {
    '/o/oauth2/auth': async (
      // eslint-disable-next-line @typescript-eslint/naming-convention
      { query: { client_id, response_type, access_type, state, scope, login_hint, proceed, redirect_uri } },
      req
    ) => {
      if (isGet(req) && response_type === 'code' && access_type === 'offline' && state && scope) {
        if (client_id === oauth.clientId) {
          // auth screen
          if (!login_hint) {
            return oauth.renderText('choose account with login_hint');
          } else if (!proceed) {
            return oauth.renderText('redirect with proceed=true to continue');
          } else {
            return oauth.successResult(parsePort(req), login_hint, state, scope);
          }
        } else if (client_id === OauthMock.customIDPClientId) {
          if (!proceed) {
            return oauth.renderText('redirect with proceed=true to continue');
          }
          return oauth.successResult(parsePort(req), login_hint, state, scope, redirect_uri);
        }
      }
      throw new HttpClientErr(`Method not implemented for ${req.url}: ${req.method}`);
    },
    // eslint-disable-next-line @typescript-eslint/naming-convention
    '/token': async ({ query: { grant_type, refreshToken, client_id, code }, body }, req) => {
      if (isPost(req)) {
        if (grant_type === 'authorization_code' && code && client_id === oauth.clientId) {
          // auth code from auth screen gets exchanged for access and refresh tokens
          return oauth.getRefreshTokenResponse(code, false);
        } else if (grant_type === 'refresh_token' && refreshToken && client_id === oauth.clientId) {
          // here also later refresh token gets exchanged for access token
          return oauth.getTokenResponse(refreshToken, false);
        }
        const parsedBody = body as OAuthTokenRequestModel;
        // Above is for Google OAuth and this is for normal OAuth
        if (parsedBody.grant_type === 'authorization_code' && parsedBody.code && parsedBody.client_id === OauthMock.customIDPClientId) {
          return oauth.getRefreshTokenResponse(parsedBody.code, true);
        }
      }
      throw new Error(`Method not implemented for ${req.url}: ${req.method}`);
    },
    // eslint-disable-next-line @typescript-eslint/naming-convention
    '/tokeninfo': async ({ query: { access_token } }, req) => {
      if (isGet(req)) {
        return oauth.getTokenInfo(access_token);
      }
      throw new Error(`Method not implemented for ${req.url}: ${req.method}`);
    },
    '/v1/people:searchContacts': async ({ query: { query } }, req) => {
      if (!isGet(req)) {
        throw new HttpClientErr(`Method not implemented for ${req.url}: ${req.method}`);
      }
      if (!config?.contacts) {
        return { results: [] };
      }
      const results = config.contacts
        .filter(email => email.includes(query))
        .map(email => ({ person: { emailAddresses: [{ metadata: { primary: true }, value: email }] } }));
      return { results };
    },
    '/v1/people/me': async ({ query: { personFields } }, req) => {
      if (!isGet(req) || personFields !== 'names') {
        throw new HttpClientErr(`Method not implemented for ${req.url}: ${req.method}`);
      }
      return {
        resourceName: 'people/resourceId',
        etag: '%EgUBAi43PRoEAQIFByIMSFMydTZETy9IEFE9',
        names: [
          {
            metadata: {
              primary: true,
            },
            displayName: 'First Last',
            familyName: 'First',
            givenName: 'Last',
            displayNameLastFirst: 'Last, First',
            unstructuredName: 'First Last',
          },
        ],
      };
    },
    '/v1/otherContacts:search': async ({ query: { query } }, req) => {
      if (!isGet(req)) {
        throw new HttpClientErr(`Method not implemented for ${req.url}: ${req.method}`);
      }
      if (!config?.othercontacts) {
        return { results: [] };
      }
      const results = config.othercontacts
        .filter(email => email.includes(query))
        .map(email => ({ person: { emailAddresses: [{ metadata: { primary: true }, value: email }] } }));
      return { results };
    },
    '/gmail': async (_parsedReq, req) => {
      if (isGet(req)) {
        const acct = oauth.checkAuthorizationHeaderWithAccessToken(req.headers.authorization, 'flowcrypt.compatibility@gmail.com');
        return await GoogleData.getMockGmailPage(acct);
      }
      throw new HttpClientErr(`Method not implemented for ${req.url}: ${req.method}`);
    },
    '/gmail/v1/users/me/settings/sendAs': async (_parsedReq, req) => {
      const acct = oauth.checkAuthorizationHeaderWithAccessToken(req.headers.authorization);
      if (!isGet(req)) {
        throw new HttpClientErr(`Method not implemented for ${req.url}: ${req.method}`);
      }
      const primarySendAs = {
        sendAsEmail: acct,
        displayName: 'First Last',
        replyToAddress: acct,
        signature: '',
        isDefault: true,
        isPrimary: true,
        treatAsAlias: false,
        verificationStatus: 'accepted',
      };
      if (config?.primarySignature?.[acct]) {
        primarySendAs.signature = config.primarySignature[acct];
      }
      // If no aliases are defined in the config, return only the primary send-as object
      if (!config?.aliases) {
        return { sendAs: [primarySendAs] };
      }
      // Merge the primary send-as object with any aliases defined in the config
      const aliases = config.aliases[acct] ?? [];
      return { sendAs: [...aliases, primarySendAs] };
    },
    '/gmail/v1/users/me/messages': async ({ query: { q } }, req) => {
      // search messages
      const acct = oauth.checkAuthorizationHeaderWithAccessToken(req.headers.authorization);
      if (isGet(req) && q) {
        const msgs = (await GoogleData.withInitializedData(acct)).searchMessages(q);
        return { messages: msgs.map(({ id, threadId }) => ({ id, threadId })), resultSizeEstimate: msgs.length };
      }
      throw new HttpClientErr(`Method not implemented for ${req.url}: ${req.method}`);
    },
    '/gmail/v1/users/me/messages/?': async ({ query: { format } }, req) => {
      // get msg or attachment
      const acct = oauth.checkAuthorizationHeaderWithAccessToken(req.headers.authorization);
      if (isGet(req)) {
        // temporary replacement for parseResourceId() until #5050 is fixed
        const id = /\/([a-zA-Z0-9\-_]+)(\?|$)/.exec(req.url)?.[1];
        if (!id) {
          return {};
        }
        const data = await GoogleData.withInitializedData(acct);
        if (req.url?.includes('/attachments/')) {
          const foundAtt = config?.getAttachment?.[id];
          if (foundAtt && 'error' in foundAtt) throw foundAtt.error;
          if (foundAtt?.data) return { data: foundAtt.data };
          const attachment = data.getAttachment(id);
          if (attachment) {
            return { data: attachment.data }; // Note: data (or quoted) field must be last in serialized JSON
          }
          throw new HttpClientErr(`MOCK attachment not found for ${acct}: ${id}`, Status.NOT_FOUND);
        }
        const found = config?.getMsg?.[id]?.[format];
        if (found && 'error' in found) throw found.error;
        const msg = found?.msg ? found.msg : data.getMessage(id);
        if (msg) {
          return GoogleData.fmtMsg(msg, format);
        }
        throw new HttpClientErr(`MOCK Message not found for ${acct}: ${id}`, Status.NOT_FOUND);
      }
      throw new HttpClientErr(`Method not implemented for ${req.url}: ${req.method}`);
    },
    '/gmail/v1/users/me/labels': async (parsedReq, req) => {
      const acct = oauth.checkAuthorizationHeaderWithAccessToken(req.headers.authorization);
      if (isGet(req)) {
        return { labels: (await GoogleData.withInitializedData(acct)).getLabels() };
      }
      throw new HttpClientErr(`Method not implemented for ${req.url}: ${req.method}`);
    },
    '/gmail/v1/users/me/threads': async (parsedReq, req) => {
      const acct = oauth.checkAuthorizationHeaderWithAccessToken(req.headers.authorization);
      if (isGet(req)) {
        const threads = (await GoogleData.withInitializedData(acct)).getThreads([parsedReq.query.labelIds]); // todo: support arrays?
        return { threads, resultSizeEstimate: threads.length };
      }
      throw new HttpClientErr(`Method not implemented for ${req.url}: ${req.method}`);
    },
    '/gmail/v1/users/me/threads/?': async ({ query: { format } }, req) => {
      if (/\/modify$/.exec(req.url)) {
        return {};
      }
      const acct = oauth.checkAuthorizationHeaderWithAccessToken(req.headers.authorization);
      if (isGet(req) && (format === 'metadata' || format === 'full')) {
        const id = parseResourceId(req.url);
        const msgs = (await GoogleData.withInitializedData(acct)).getMessagesAndDraftsByThread(id);
        if (!msgs.length) {
          const errorCode = config?.threadNotFoundError?.[id] ?? 400;
          throw new HttpClientErr(`MOCK thread not found for ${acct}: ${id}`, errorCode);
        }
        return { id, historyId: msgs[0].historyId, messages: msgs.map(m => GoogleData.fmtMsg(m, format)) };
      }
      throw new HttpClientErr(`Method not implemented for ${req.url}: ${req.method}`);
    },
    '/upload/gmail/v1/users/me/messages/send?uploadType=multipart': async (parsedReq, req) => {
      const acct = oauth.checkAuthorizationHeaderWithAccessToken(req.headers.authorization);
      if (isPost(req)) {
        if (parsedReq.body && typeof parsedReq.body === 'string') {
          const parseResult = await parseMultipartDataAsMimeMsg(parsedReq.body);
          await validateMimeMsg(acct, parseResult.mimeMsg, parseResult.threadId);
          const id = `msg_id_${Util.lousyRandom()}`;
          try {
            const testingStrategyContext = new TestBySubjectStrategyContext(parseResult.mimeMsg.subject || '');
            await testingStrategyContext.test(parseResult, id, parsePort(req));
          } catch (e) {
            if (!(e instanceof UnsupportableStrategyError)) {
              // No such strategy for test
              throw e; // todo - should start throwing unsupported test strategies too, else changing subject will cause incomplete testing
              // todo - should stop calling it "strategy", better just "SentMessageTest" or similar
            }
          }
          return { id, labelIds: ['SENT'], threadId: parseResult.threadId };
        }
      }
      throw new HttpClientErr(`Method not implemented for ${req.url}: ${req.method}`);
    },
    '/gmail/v1/users/me/drafts': async (parsedReq, req) => {
      if (isPost(req)) {
        const acct = oauth.checkAuthorizationHeaderWithAccessToken(req.headers.authorization);
        const body = parsedReq.body as DraftSaveModel;
        if (body?.message?.raw && typeof body.message.raw === 'string') {
          if (body.message.threadId && !(await GoogleData.withInitializedData(acct)).getThreads().find(t => t.id === body.message.threadId)) {
            throw new HttpClientErr('The thread you are replying to not found', 404);
          }
          return {
            id: 'mockfakedraftsave',
            message: {
              id: 'mockfakedmessageraftsave',
              labelIds: ['DRAFT'],
              threadId: body.message.threadId,
            },
          };
        }
      }
      throw new HttpClientErr(`Method not implemented for ${req.url}: ${req.method}`);
    },
    '/gmail/v1/users/me/drafts/?': async (parsedReq, req) => {
      const acct = oauth.checkAuthorizationHeaderWithAccessToken(req.headers.authorization);
      if (isGet(req)) {
        const id = parseResourceId(req.url);
        const data = await GoogleData.withInitializedData(acct);
        const draft = data.getDraft(id);
        if (draft) {
          return { id: draft.id, message: draft };
        }
        throw new HttpClientErr(`MOCK draft not found for ${acct} (draftId: ${id})`, Status.NOT_FOUND);
      } else if (isPut(req)) {
        const raw = (parsedReq.body as { message?: { raw: string } })?.message?.raw;
        if (!raw) {
          throw new Error('mock Draft PUT without raw data');
        }
        const mimeMsg = await Parse.convertBase64ToMimeMsg(raw);
        const data = await GoogleData.withInitializedData(acct);
        if (config?.draftIdToSave) {
          data.addDraft(config.draftIdToSave, raw, mimeMsg);
        }
        return {};
      } else if (isDelete(req)) {
        return {};
      }
      throw new HttpClientErr(`Method not implemented for ${req.url}: ${req.method}`);
    },
    '/gmail/?': async ({}, req) => {
      const acct = oauth.checkAuthorizationHeaderWithAccessToken(req.headers.authorization);
      if (isGet(req)) {
        const id = parseResourceId(req.url);
        return await GoogleData.getMockGmailPage(acct, id, config?.htmlRenderer);
      }
      throw new HttpClientErr(`Method not implemented for ${req.url}: ${req.method}`);
    },
  };
};

const parseMultipartDataAsMimeMsg = async (multipartData: string): Promise<ParseMsgResult> => {
  let parsed: ParseMsgResult;
  try {
    parsed = await Parse.strictParse(multipartData);
  } catch (e) {
    if (e instanceof Error) {
      throw new HttpClientErr(e.message, 400);
    }
    throw new HttpClientErr('Unknown error', 500);
  }
  return parsed;
};

const validateMimeMsg = async (acct: string, mimeMsg: ParsedMail, threadId?: string) => {
  const inReplyToMessageId = mimeMsg.headers.get('in-reply-to') ? (mimeMsg.headers.get('in-reply-to') as unknown)?.toString() : '';
  if (threadId) {
    const messages = (await GoogleData.withInitializedData(acct)).getMessagesByThread(threadId);
    if (!messages?.length) {
      throw new HttpClientErr(`Error: The thread you are replying (${threadId}) to not found`, 404);
    }
    if (inReplyToMessageId) {
      let isMessageExists = false;
      for (const message of messages) {
        if (message.raw) {
          const parsedMimeMsg = await Parse.convertBase64ToMimeMsg(message.raw);
          if (parsedMimeMsg.messageId === inReplyToMessageId) {
            isMessageExists = true;
            break;
          }
        }
      }
      if (!isMessageExists) {
        throw new HttpClientErr(
          `Error: suplied In-Reply-To header (${inReplyToMessageId}) does not match any messages present in the mock data for thread ${threadId}`,
          400
        );
      }
    } else {
      throw new HttpClientErr(`Error: 'In-Reply-To' must not be empty if there is 'threadId'(${threadId})`, 400);
    }
  }
  if (!mimeMsg.subject) {
    throw new HttpClientErr('Error: Subject line is required', 400);
  } else {
    if (['Re: ', 'Fwd: '].some(e => mimeMsg.subject?.startsWith(e)) && (!threadId || !inReplyToMessageId)) {
      throw new HttpClientErr(`Error: Incorrect subject. Subject can't start from 'Re:' or 'Fwd:'. Current subject is '${mimeMsg.subject}'`, 400);
    } else if ((threadId || inReplyToMessageId) && !['Re: ', 'Fwd: '].some(e => mimeMsg.subject?.startsWith(e))) {
      throw new HttpClientErr(
        "Error: Incorrect subject. Subject must start from 'Re:' or 'Fwd:' " +
          `if the message has threaId or 'In-Reply-To' header. Current subject is '${mimeMsg.subject}'`,
        400
      );
    }
    // Special check for 'from alias' test
    if (mimeMsg.subject.endsWith('from alias') && mimeMsg.from?.value[0].address !== 'flowcryptcompatibility@gmail.com') {
      throw new HttpClientErr(`Error: Incorrect Email Alias. Should be 'flowcryptcompatibility@gmail.com'. Current '${mimeMsg.from?.value[0].address}'`);
    }
  }
  if (!mimeMsg.text && !mimeMsg.attachments?.length) {
    throw new HttpClientErr('Error: Message body cannot be empty', 400);
  }
  const recipients = parsedMailAddressObjectAsArray(mimeMsg.to)
    .concat(parsedMailAddressObjectAsArray(mimeMsg.cc))
    .concat(parsedMailAddressObjectAsArray(mimeMsg.bcc));

  if (!recipients.length || recipients.some(addr => addr.value.some(em => !allowedRecipients.includes(em.address!)))) {
    throw new HttpClientErr("Error: You can't send a message to unexisting email address(es)");
  }
  const aliases = [acct];
  if (acct === 'flowcrypt.compatibility@gmail.com') {
    aliases.push('flowcryptcompatibility@gmail.com');
  }

  if (!mimeMsg.from?.value.length || mimeMsg.from?.value.find(em => !aliases.includes(em.address!))) {
    throw new HttpClientErr("You can't send a message from unexisting email address(es)");
  }
};

export const parsedMailAddressObjectAsArray = (header: AddressObject | AddressObject[] | undefined): AddressObject[] => {
  if (!header) {
    return [];
  }
  if (Array.isArray(header)) {
    return header;
  }
  return [header];
};
