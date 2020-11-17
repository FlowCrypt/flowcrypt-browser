/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { HttpClientErr } from '../lib/api';
import { HandlersDefinition } from '../all-apis-mock';

export const mockWellKnownHostMetaEndpoints: HandlersDefinition = {
  // below for ui tests
  '/.well-known/host-meta.json': async ({ }, req) => {
    if (req.headers.host === 'wellknownfes.com:8001') {
      return { links: [{ rel: 'https://flowcrypt.com/fes', href: 'https://localhost:8001/custom-fes-based-on-well-known/' }] };
    }
    throw new HttpClientErr(`Host meta for ${req.headers.host} not set up`, 404);
  },
  // below for unit tests
  '/.well-known/host-meta.json?local=status500': async () => {
    throw new Error(`Intentional error host meta 500 - ignored on consumer but noticed by enterprise`);
  },
  '/.well-known/host-meta.json?local=status404': async () => {
    throw new HttpClientErr(`Not Found`, 404);
  },
  '/.well-known/host-meta.json?local=not.json': async () => {
    return '<body>nothing</body>';
  },
  '/.well-known/host-meta.json?local=wrong.format': async () => {
    return { links: "unexpected string" };
  },
  '/.well-known/host-meta.json?local=no.fes.rel': async () => {
    return { links: [{ rel: "another", href: "ignore this" }] };
  },
  '/.well-known/host-meta.json?local=has.fes.rel': async () => {
    return { links: [{ rel: 'https://flowcrypt.com/fes', href: "https://targer.customer.com/fes/" }] };
  },
  '/.well-known/host-meta.json?local=empty200': async () => {
    return '';
  },
};
