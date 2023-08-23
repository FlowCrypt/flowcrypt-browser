/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { AuthenticationConfiguration } from './authentication-configuration';
import { ClientConfigurationJson } from './client-configuration';

export type DomainConfiguration = { authentication: AuthenticationConfiguration; clientConfigurationJson: ClientConfigurationJson };
