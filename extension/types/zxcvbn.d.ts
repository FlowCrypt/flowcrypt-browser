import type { OptionsType, ZxcvbnFactory as ZxcvbnFactoryInstance } from '@zxcvbn-ts/core';
import type * as ZxcvbnCommonPackage from '@zxcvbn-ts/language-common';
import type * as ZxcvbnEnPackage from '@zxcvbn-ts/language-en';

declare global {
  var zxcvbnts: {
    core: {
      ZxcvbnFactory: new (opts?: OptionsType) => ZxcvbnFactoryInstance;
    };
    'language-common': typeof ZxcvbnCommonPackage;
    'language-en': typeof ZxcvbnEnPackage;
  };
}

export {};
