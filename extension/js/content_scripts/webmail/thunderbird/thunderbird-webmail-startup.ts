/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */
import { ClientConfiguration } from '../../../common/client-configuration';
import { Injector } from '../../../common/inject';
import { Notifications } from '../../../common/notifications';
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
      getReplacer: () => new ThunderbirdElementReplacer(), // todo - add this class empty, methods do nothing
      start: this.start,
    });
  };

  private start = async (
    acctEmail: string,
    clientConfiguration: ClientConfiguration,
    injector: Injector,
    notifications: Notifications
    // factory: XssSafeFactory, // todo in another issue
    // relayManager: RelayManager // todo in another issue
  ) => {
    // injector.btns(); // todo in another issue - add compose button
    this.replacer.runIntervalFunctionsPeriodically();
    await notifications.showInitial(acctEmail);
    notifications.show(
      'FlowCrypt Thunderbird support is still in early development, and not expected to function properly yet. Support will be gradually added in upcoming versions.'
    );
  };
}
