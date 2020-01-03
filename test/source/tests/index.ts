/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import * as ava from 'ava';

import { Consts } from '../test';

export type AvaContext = ava.ExecutionContext<{}> & { retry?: true, attemptNumber?: number, totalAttempts?: number, attemptText?: string };

const MAX_ATT_SIZE = 5 * 1024 * 1024;

const debugHtmls: string[] = [];
const debugHtmlStyle = `
<style>
  h1 { margin-top: 50px; margin-left: 20px; }
  pre { border:1px dotted #ddd; background-color:#fafafa; margin-left: 0px; overflow-x: auto; }
  div.attempt { padding: 20px; margin: 20px; border-left: 4px solid red; }
  div.attempt > a { text-decoration: none; font-size: 13px; color: black; }
  div.attempt .page { padding: 20px; margin: 20px; margin-left: 0px; background: #AAA; }
  div.attempt .page img { margin: 8px; margin-left: 0; border: 1px solid white; }
  .c-error { color:red }
  .c-warning { color:orange }
  .c-log { color:darkgray }
  .c-info { color:gray }
  ul { margin: 0; padding-left: 20px; display: inline-block; }
</style>
`;

export const addDebugHtml = (html: string) => {
  debugHtmls.push(html);
};

export const getDebugHtmlAtts = (testId: string, mockApiLogs: string[]): string[] => {
  if (debugHtmls.length && mockApiLogs.length) {
    debugHtmls.push(`<h1>Google Mock API logs</h1><pre>${mockApiLogs.join('\n')}</pre>`);
  }
  const debugAtts: string[] = [];
  let currentDebugAtt = '';
  for (const debugHtml of debugHtmls) {
    currentDebugAtt += debugHtml;
    if (currentDebugAtt.length > MAX_ATT_SIZE) {
      debugAtts.push(currentDebugAtt);
      currentDebugAtt = '';
    }
  }
  if (currentDebugAtt.length) {
    debugAtts.push(currentDebugAtt);
  }
  const formattedDebugAtts: string[] = [];
  for (let i = 0; i < debugAtts.length; i++) {
    formattedDebugAtts[i] = `${debugHtmlStyle}<h1>${testId} ${i + 1}/${debugAtts.length}</h1><hr><br>${debugAtts[i]}`;
  }
  return formattedDebugAtts;
};

export const standaloneTestTimeout = (t: AvaContext, ms: number, name: string) => setTimeout(() => { t.fail(`Standalone timeout exceeded (${name})`); }, ms);

export const newWithTimeoutsFunc = (consts: Consts): <T>(actionPromise: Promise<T>) => Promise<T> => { // returns a function
  const timeoutAllRetries = new Promise((_, reject) => setTimeout(() => reject(new Error(`TIMEOUT_ALL_RETRIES`)), consts.TIMEOUT_ALL_RETRIES)) as Promise<never>;
  return <T>(actionPromise: Promise<T>) => Promise.race([
    actionPromise, // the actual action being performed
    timeoutAllRetries, // timeout for all test retries
    consts.PROMISE_TIMEOUT_OVERALL, // overall timeout for the whole test process / sequence
  ]);
};

export const newTimeoutPromise = (name: string, seconds = 20): Promise<never> => {
  return new Promise((resolve, reject) => setTimeout(() => reject(new Error(`Timeout: ${name}`)), seconds * 1000));
};

export const minutes = (count: number) => count * 60 * 1000;
