
import * as fs from 'fs';

interface ConfigInterface {
  extension_id: string;
  auth: { google: {email: string, password: string, backup: string}[],};
  keys: {title: string, passphrase: string, armored: string|null, keywords: string|null}[];
  messages: {name: string, content: string[], params: string}[];
  unit_tests: {name: string, f: string, args: any[], result: any}[];
}

export class Config {

  public static config = JSON.parse(fs.readFileSync('test/puppeteer.json', 'utf8')) as ConfigInterface;

  public static key = (title: string) => Config.config.keys.filter(k => k.title === title)[0];

}

export class Util {

  public static sleep = (seconds: number) => new Promise(resolve => setTimeout(resolve, seconds * 1000));

  public static random = () => Math.random().toString(36).substring(7);

}
