/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */
import { contentScriptSetupIfVacant } from '../generic/setup-webmail-content-script';
import { ThunderbirdElementReplacer } from './thunderbird-element-replacer';

export class ThunderbirdWebmailStartup {
  private replacer: ThunderbirdElementReplacer;

  public asyncConstructor = async () => {
    await contentScriptSetupIfVacant({
      name: 'thunderbird',
      variant: undefined,
      getUserAccountEmail: () => undefined, // todo, but can start with undefined
      getUserFullName: () => undefined, // todo, but can start with undefined
      getReplacer: () => this.replacer,
      start: this.start,
    });
  };

  private start = async () => {
    this.replacer = new ThunderbirdElementReplacer();
    this.replacer.runIntervalFunctionsPeriodically();
  };
}
