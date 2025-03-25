/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { ExecutionContext } from 'ava';
import { TestUrls } from '../../browser/test-urls';

import { Consts } from '../../test';
import { Api } from '../../mock/lib/api';

export type TestContext = {
  retry?: true;
  attemptNumber?: number;
  totalAttempts?: number;
  attemptText?: string;
  extensionDir?: string;
  urls?: TestUrls;
  mockApi?: Api<{ query: { [k: string]: string }; body?: unknown }, unknown>;
  mockApiLogs?: string[];
  debugHtmls?: string[];
};

export type AvaContext = ExecutionContext<TestContext>;

const MAX_ATT_SIZE = 5 * 1024 * 1024;

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

export const addDebugHtml = (context: TestContext, html: string) => {
  if (context.debugHtmls) {
    context.debugHtmls.push(html);
  } else {
    context.debugHtmls = [html];
  }
};

export const getDebugHtmlAtts = (testId: string, context: TestContext): string[] => {
  if (context.debugHtmls?.length && context.mockApiLogs?.length) {
    context.debugHtmls.push(`<h1>Google Mock API logs</h1><pre>${context.mockApiLogs.join('\n')}</pre>`);
  }
  const debugAtts: string[] = [];
  let currentDebugAtt = '';
  for (const debugHtml of context.debugHtmls ?? []) {
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

export const standaloneTestTimeout = (t: AvaContext, ms: number, name: string) =>
  setTimeout(() => {
    t.fail(`Standalone timeout exceeded (${name})`);
  }, ms);

export const newWithTimeoutsFunc = (consts: Consts): (<T>(actionPromise: Promise<T>) => Promise<T>) => {
  // returns a function
  const timeoutAllRetries = new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`TIMEOUT_ALL_RETRIES`)), consts.TIMEOUT_ALL_RETRIES));
  return <T>(actionPromise: Promise<T>) =>
    Promise.race([
      actionPromise, // the actual action being performed
      timeoutAllRetries, // timeout for all test retries
      consts.PROMISE_TIMEOUT_OVERALL, // overall timeout for the whole test process / sequence
    ]);
};

export const newTimeoutPromise = (name: string, seconds = 20): Promise<never> => {
  return new Promise((resolve, reject) => setTimeout(() => reject(new Error(`Timeout: ${name}`)), seconds * 1000));
};

export const minutes = (count: number) => count * 60 * 1000;
