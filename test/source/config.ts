
import * as fs from 'fs';

interface ConfigInterface {
  extension_id: string;
  auth: { google: {email: string, password: string, backup: string}[],};
  keys: {title: string, passphrase: string, armored: string|null, keywords: string|null}[];
  messages: {name: string, content: string[], params: string}[];
  unit_tests: {name: string, f: string, args: any[], result: any}[];
}

export let config = JSON.parse(fs.readFileSync('test/puppeteer.json', 'utf8')) as ConfigInterface;
