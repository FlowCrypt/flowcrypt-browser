/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

export type AuthenticationConfiguration = {
  oauth: { clientId: string; clientSecret: string; redirectUrl: string; authCodeUrl: string; tokensUrl: string };
};
