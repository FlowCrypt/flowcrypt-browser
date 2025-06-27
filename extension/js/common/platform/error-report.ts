/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */
export type ErrorReport = {
  name: string;
  message: string;
  url: string;
  line: number;
  col: number;
  trace: string;
  version: string;
  environment: string;
  product: string;
  buildType: string;
};

export class UnreportableError extends Error {}

export class CompanyLdapKeyMismatchError extends UnreportableError {}
