/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

type Base64Alphabet = 'base64' | 'base64url';
type LastChunkHandling = 'loose' | 'strict' | 'stop-before-partial';
type Base64DecodeOptions = { alphabet?: Base64Alphabet; lastChunkHandling?: LastChunkHandling };
type Base64EncodeOptions = { alphabet?: Base64Alphabet; omitPadding?: boolean };

const getOptions = (options: unknown): Record<string, unknown> | undefined => {
  if (options === undefined) {
    return undefined;
  }
  if (typeof options !== 'object' || !options) {
    throw new TypeError('Options must be an object or undefined');
  }
  return options as Record<string, unknown>;
};

const getAlphabet = (options: Record<string, unknown> | undefined): Base64Alphabet => {
  const alphabet = options?.alphabet ?? 'base64';
  if (alphabet === 'base64' || alphabet === 'base64url') {
    return alphabet;
  }
  throw new TypeError('Invalid alphabet option');
};

const decodeBase64 = (input: string, options?: Base64DecodeOptions): Uint8Array => {
  if (typeof input !== 'string') {
    throw new TypeError('Base64 input must be a string');
  }
  const parsedOptions = getOptions(options);
  if (getAlphabet(parsedOptions) !== 'base64') {
    throw new TypeError('Only the base64 alphabet is supported for decoding');
  }
  const lastChunkHandling = parsedOptions?.lastChunkHandling ?? 'loose';
  if (lastChunkHandling !== 'loose') {
    throw new TypeError('Only loose last-chunk handling is supported');
  }

  let decoded: string;
  try {
    decoded = atob(input);
  } catch {
    throw new SyntaxError('Base64 input is invalid');
  }
  return Uint8Array.from(decoded, character => character.charCodeAt(0));
};

const encodeBase64 = (bytes: Uint8Array, options?: Base64EncodeOptions): string => {
  const parsedOptions = getOptions(options);
  const alphabet = getAlphabet(parsedOptions);
  const omitPadding = Boolean(parsedOptions?.omitPadding);
  let encoded = Buffer.from(bytes).toString('base64');
  if (alphabet === 'base64url') {
    encoded = encoded.replace(/\+/g, '-').replace(/\//g, '_');
  }
  return omitPadding ? encoded.replace(/=+$/, '') : encoded;
};

const decodeHex = (input: string): Uint8Array => {
  if (typeof input !== 'string') {
    throw new TypeError('Hex input must be a string');
  }
  if (input.length % 2 !== 0) {
    throw new SyntaxError('Hex input must contain an even number of characters');
  }
  if (!/^[0-9a-f]*$/i.test(input)) {
    throw new SyntaxError('Hex input contains an invalid character');
  }
  return new Uint8Array(Buffer.from(input, 'hex'));
};

const validateUint8Array = (value: unknown): Uint8Array => {
  if (!(value instanceof Uint8Array)) {
    throw new TypeError('Method receiver must be a Uint8Array');
  }
  return value;
};

if (typeof Uint8Array.fromBase64 !== 'function') {
  Object.defineProperty(Uint8Array, 'fromBase64', {
    configurable: true,
    writable: true,
    value: (input: string, options?: Base64DecodeOptions): Uint8Array => decodeBase64(input, options),
  });
}

if (typeof Uint8Array.fromHex !== 'function') {
  Object.defineProperty(Uint8Array, 'fromHex', {
    configurable: true,
    writable: true,
    value: (input: string): Uint8Array => decodeHex(input),
  });
}

if (typeof Uint8Array.prototype.toBase64 !== 'function') {
  Object.defineProperty(Uint8Array.prototype, 'toBase64', {
    configurable: true,
    writable: true,
    value(this: Uint8Array, options?: Base64EncodeOptions): string {
      return encodeBase64(validateUint8Array(this), options);
    },
  });
}

if (typeof Uint8Array.prototype.toHex !== 'function') {
  Object.defineProperty(Uint8Array.prototype, 'toHex', {
    configurable: true,
    writable: true,
    value(this: Uint8Array): string {
      return Buffer.from(validateUint8Array(this)).toString('hex');
    },
  });
}
