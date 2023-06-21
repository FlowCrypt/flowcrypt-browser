/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import * as https from 'https';
import * as http from 'http';
import { Util } from '../../util';
import { readFileSync } from 'fs';
import { AttesterConfig, getMockAttesterEndpoints } from '../attester/attester-endpoints';
import { HandlersRequestDefinition } from '../all-apis-mock';
import { KeysOpenPGPOrgConfig, getMockKeysOpenPGPOrgEndpoints } from '../keys-openpgp-org/keys-openpgp-org-endpoints';
import { OauthMock } from './oauth';
import { GoogleConfig, getMockGoogleEndpoints } from '../google/google-endpoints';
import { KeyManagerConfig, getMockKeyManagerEndpoints } from '../key-manager/key-manager-endpoints';
import { FesConfig, getMockSharedTenantFesEndpoints } from '../fes/shared-tenant-fes-endpoints';
import { WkdConfig, getMockWkdEndpoints } from '../wkd/wkd-endpoints';
import { SksConfig, getMockSksEndpoints } from '../sks/sks-endpoints';

export class HttpAuthErr extends Error {}
export class HttpClientErr extends Error {
  public constructor(message: string, public statusCode = 400) {
    super(message);
  }
}

/* eslint-disable @typescript-eslint/naming-convention */
export enum Status {
  OK = 200,
  CREATED = 201,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  NOT_ALLOWED = 405,
  CONFLICT = 409, // conflicts with key on record - request needs to be verified
  SERVER_ERROR = 500,
  NOT_IMPLEMENTED = 501,
}
/* eslint-enable @typescript-eslint/naming-convention */

export type RequestHandler<REQ, RES> = (parsedReqBody: REQ, req: http.IncomingMessage) => Promise<RES>;
export type Handlers<REQ, RES> = { [request: string]: RequestHandler<REQ, RES> };

interface ConfigurationOptions {
  attester?: AttesterConfig;
  keysOpenPgp?: KeysOpenPGPOrgConfig;
  ekm?: KeyManagerConfig;
  fes?: FesConfig;
  wkd?: WkdConfig;
  google?: GoogleConfig;
  sks?: SksConfig;
}

interface ConfigurationProviderInterface<REQ, RES> {
  config: ConfigurationOptions;
  getHandlers(): Handlers<REQ, RES>;
}

export class ConfigurationProvider implements ConfigurationProviderInterface<HandlersRequestDefinition, unknown> {
  private oauth = new OauthMock();

  public constructor(public config: ConfigurationOptions) {}

  public getHandlers(): Handlers<HandlersRequestDefinition, unknown> {
    let handlers: Handlers<HandlersRequestDefinition, unknown> = {};
    if (this.config.attester) {
      handlers = { ...handlers, ...getMockAttesterEndpoints(this.oauth, this.config.attester) };
    }
    handlers = {
      ...handlers,
      ...getMockGoogleEndpoints(this.oauth, this.config.google),
      ...getMockSharedTenantFesEndpoints(this.config.fes),
      ...getMockWkdEndpoints(this.config.wkd),
      ...getMockSksEndpoints(this.config.sks),
      ...getMockKeyManagerEndpoints(this.oauth, this.config.ekm),
      ...getMockKeysOpenPGPOrgEndpoints(this.config.keysOpenPgp),
    };
    return handlers;
  }
}

export class Api<REQ, RES> {
  public server: https.Server;
  public configProvider: ConfigurationProviderInterface<REQ, RES> | undefined;
  protected apiName: string;
  protected maxRequestSizeMb = 0;
  protected maxRequestSizeBytes = 0;
  protected throttleChunkMsUpload = 0;
  protected throttleChunkMsDownload = 0;

  public constructor(apiName: string, protected handlers: Handlers<REQ, RES>, protected urlPrefix = '') {
    this.apiName = apiName;
    const opt = {
      key: readFileSync(`./test/mock_cert/key.pem.mock`),
      cert: readFileSync(`./test/mock_cert/cert.pem.mock`),
    };
    this.server = https.createServer(opt, (request, response) => {
      const start = Date.now();
      this.handleReq(request, response)
        .then(data => this.throttledResponse(response, data))
        .then(() => {
          try {
            this.log(Date.now() - start, request, response);
          } catch (e) {
            console.error(e);
            process.exit(1);
          }
        })
        .catch(e => {
          if (e instanceof HttpAuthErr) {
            response.statusCode = Status.UNAUTHORIZED;
            response.setHeader('WWW-Authenticate', `Basic realm="${this.apiName}"`);
            e.stack = undefined;
          } else if (e instanceof HttpClientErr) {
            response.statusCode = e.statusCode;
            e.stack = undefined;
          } else {
            response.statusCode = Status.SERVER_ERROR;
            if (e instanceof Error && e.message.toLowerCase().includes('intentional error')) {
              // don't log this, intentional error
            } else {
              console.error(`url:${request.method}:${request.url}`, e);
            }
          }
          response.setHeader('Access-Control-Allow-Origin', '*');
          response.setHeader('content-type', 'application/json');
          const formattedErr = this.fmtErr(e);
          response.end(formattedErr);
          try {
            this.log(Date.now() - start, request, response, formattedErr);
          } catch (e) {
            console.error('error logging req', e);
          }
        });
    });
  }

  public listen = (host = '127.0.0.1', maxMb = 100): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        this.maxRequestSizeMb = maxMb;
        this.maxRequestSizeBytes = maxMb * 1024 * 1024;
        // node.js selects random available port when port = 0
        this.server.listen(0, host);
        this.server.on('listening', () => {
          const address = this.server.address();
          const port = typeof address === 'object' && address ? address.port : undefined;
          const msg = `${this.apiName} listening on ${port}`;
          console.log(msg);
          resolve();
        });
        this.server.on('error', e => {
          console.error('failed to start mock server', e);
          reject(e);
        });
      } catch (e) {
        console.error('exception when starting mock server', e);
        reject(e);
      }
    });
  };

  public close = (): Promise<void> => {
    return new Promise((resolve, reject) => this.server.close((err: unknown) => (err ? reject(err) : resolve())));
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected log = (ms: number, req: http.IncomingMessage, res: http.ServerResponse, errRes?: Buffer) => {
    return undefined as void;
  };

  protected handleReq = async (req: http.IncomingMessage, res: http.ServerResponse): Promise<Buffer> => {
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,POST,PUT,DELETE,OPTIONS');
      return this.fmtRes({});
    }
    const handler = this.chooseHandler(req);
    if (handler) {
      return this.fmtHandlerRes(await handler(this.parseReqBody(await this.collectReq(req), req), req), res);
    }
    if ((req.url === '/' || req.url === `${this.urlPrefix}/`) && (req.method === 'GET' || req.method === 'HEAD')) {
      res.setHeader('content-type', 'application/json');
      return this.fmtRes({ app_name: this.apiName }); // eslint-disable-line @typescript-eslint/naming-convention
    }
    if ((req.url === '/alive' || req.url === `${this.urlPrefix}/alive`) && (req.method === 'GET' || req.method === 'HEAD')) {
      res.setHeader('content-type', 'application/json');
      return this.fmtRes({ alive: true });
    }
    throw new HttpClientErr(`unknown MOCK path ${req.url}`);
  };

  protected chooseHandler = (req: http.IncomingMessage): RequestHandler<REQ, RES> | undefined => {
    if (!req.url) {
      throw new Error('no url');
    }
    const configHandlers = this.configProvider?.getHandlers() ?? {};
    const allHandlers: Handlers<REQ, RES> = {
      ...configHandlers,
      ...this.handlers,
    };
    if (allHandlers[req.url]) {
      // direct handler name match
      return allHandlers[req.url];
    }
    const url = req.url.split('?')[0];
    if (allHandlers[url]) {
      // direct handler name match - ignoring query
      return allHandlers[url];
    }
    // handler match where definition url ends with "/?" - incomplete path definition
    for (const handlerPathDefinition of Object.keys(allHandlers).filter(def => /\/\?$/.test(def))) {
      if (req.url.startsWith(handlerPathDefinition.replace(/\?$/, ''))) {
        return allHandlers[handlerPathDefinition];
      }
    }
  };

  protected fmtErr = (e: unknown): Buffer => {
    if (String(e).includes('invalid_grant')) {
      return Buffer.from(JSON.stringify({ error: 'invalid_grant', error_description: 'Bad Request' })); // eslint-disable-line @typescript-eslint/naming-convention
    }
    return Buffer.from(
      JSON.stringify({
        error: { message: e instanceof Error ? e.message : String(e), stack: e instanceof Error ? e.stack : '' },
      })
    );
  };

  protected fmtHandlerRes = (handlerRes: RES, serverRes: http.ServerResponse): Buffer => {
    if (typeof handlerRes === 'string' && handlerRes.match(/^<!DOCTYPE HTML><html>/)) {
      serverRes.setHeader('content-type', 'text/html');
    } else if (typeof handlerRes === 'object' || (typeof handlerRes === 'string' && handlerRes.match(/^\{/) && handlerRes.match(/\}$/))) {
      serverRes.setHeader('content-type', 'application/json');
    } else if (typeof handlerRes === 'string') {
      serverRes.setHeader('content-type', 'text/plain');
    } else {
      throw new Error(`Don't know how to decide mock response content-type header`);
    }
    serverRes.setHeader('Access-Control-Allow-Origin', '*');
    return this.fmtRes(handlerRes);
  };

  protected fmtRes = (response: object | RES | string): Buffer => {
    if (response instanceof Buffer) {
      return response;
    } else if (typeof response === 'string') {
      return Buffer.from(response);
    }
    const json = JSON.stringify(response);
    return Buffer.from(json);
  };

  protected collectReq = (req: http.IncomingMessage): Promise<Buffer> => {
    return new Promise((resolve, reject) => {
      const body: Buffer[] = [];
      let byteLength = 0;
      req.on('data', (chunk: Buffer) => {
        byteLength += chunk.length;
        if (this.maxRequestSizeBytes && byteLength > this.maxRequestSizeBytes) {
          reject(new HttpClientErr(`Message over ${this.maxRequestSizeMb} MB`));
        } else {
          body.push(chunk);
        }
        if (this.throttleChunkMsUpload && body.length > 2) {
          req.pause(); // slow down accepting data by a certain amount of ms per chunk
          setTimeout(() => req.resume(), this.throttleChunkMsUpload);
        }
      });
      req.on('end', () => {
        try {
          resolve(Buffer.concat(body));
        } catch (e) {
          reject(e);
        }
      });
    });
  };

  protected parseReqBody = (body: Buffer, req: http.IncomingMessage): REQ => {
    let parsedBody: string | undefined;
    /* eslint-disable @typescript-eslint/no-non-null-assertion */
    if (body.length) {
      if (
        req.url!.startsWith('/upload/') || // gmail message send
        (req.url!.startsWith('/attester/pub/') && req.method === 'POST') || // attester submit
        req.url!.startsWith('/api/v1/message') || // FES pwd msg
        req.url!.startsWith('/shared-tenant-fes/api/v1/message') // Shared TENANT FES pwd msg
      ) {
        parsedBody = body.toString();
      } else {
        parsedBody = JSON.parse(body.toString());
      }
    }
    return { query: this.parseUrlQuery(req.url!), body: parsedBody } as unknown as REQ;
    /* eslint-enable @typescript-eslint/no-non-null-assertion */
  };

  private throttledResponse = async (response: http.ServerResponse, data: Buffer) => {
    // If google oauth2 login, then redirect to url
    if (/^https:\/\/google\.localhost:[0-9]+\/robots\.txt/.test(data.toString())) {
      response.writeHead(302, { Location: data.toString() }); // eslint-disable-line @typescript-eslint/naming-convention
    } else {
      const chunkSize = 100 * 1024;
      for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize);
        response.write(chunk);
        if (i > 0) {
          await Util.sleep(this.throttleChunkMsDownload / 1000);
        }
      }
    }
    response.end();
  };

  private parseUrlQuery = (url: string): { [k: string]: string } => {
    const queryIndex = url.indexOf('?');
    if (!queryIndex) {
      return {};
    }
    const queryStr = url.substring(queryIndex + 1);
    const valuePairs = queryStr.split('&');
    const params: { [k: string]: string } = {};
    for (const valuePair of valuePairs) {
      if (valuePair) {
        const equalSignSeparatedParts = valuePair.split('=');
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        params[equalSignSeparatedParts.shift()!] = decodeURIComponent(equalSignSeparatedParts.join('='));
      }
    }
    return params;
  };
}
