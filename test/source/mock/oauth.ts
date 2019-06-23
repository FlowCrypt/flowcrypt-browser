import { HttpClientErr, Status } from './api';

export class OauthMock {

  private refreshTokens: { [account: string]: string } = {};
  private accessTokens: { [refreshToken: string]: string } = {};

  public clientId = '717284730244-ostjo2fdtr3ka4q9td69tdr9acmmru2p.apps.googleusercontent.com';
  public expiresIn = Date.now() + 1000 * 60 * 60; // expires in 1 hour
  public redirectUri = 'urn:ietf:wg:oauth:2.0:oob:auto';

  public getAccessToken = (refreshToken: string): string => {
    if (this.accessTokens[refreshToken]) {
      return this.accessTokens[refreshToken];
    }
    throw new HttpClientErr('Wrong mock refresh token', Status.UNAUTHORIZED);
  }

  public register = (acct: string) => {
    const refreshToken = `mock-refresh-token-${acct.replace(/[^a-z0-9]+/, '')}`;
    const accessToken = `mock-access-token-${acct.replace(/[^a-z0-9]+/, '')}`;
    this.refreshTokens[acct] = refreshToken;
    this.accessTokens[refreshToken] = accessToken;
    return { refreshToken, accessToken };
  }

}