/**
 * RepoSense Cryptographic Key Vault
 *
 * Web Crypto API based AES-256-GCM encryption, decryption, and key fingerprinting.
 * Runtime-agnostic: fully compatible with Cloudflare Workers and Node.js 18+.
 */

export interface EncryptedParts {
  readonly encryptedKey: string;
  readonly iv: string;
  readonly packed: string;
}

/**
 * Converts a Uint8Array into a lowercase hexadecimal string.
 */
function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b !== undefined) {
      hex += b.toString(16).padStart(2, '0');
    }
  }
  return hex;
}

/**
 * Converts a hexadecimal string into an ArrayBuffer.
 */
function hexToArrayBuffer(hex: string): ArrayBuffer {
  const cleanHex = hex.trim();
  if (cleanHex.length % 2 !== 0) {
    throw new Error('Invalid hexadecimal string: length must be even');
  }
  const buffer = new ArrayBuffer(cleanHex.length / 2);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < cleanHex.length; i += 2) {
    const byte = parseInt(cleanHex.slice(i, i + 2), 16);
    if (Number.isNaN(byte)) {
      throw new Error(`Invalid hexadecimal character at position ${i}`);
    }
    view[i / 2] = byte;
  }
  return buffer;
}

/**
 * Derives a 256-bit AES-GCM CryptoKey from the provided secret.
 * Supports 64-char hex strings directly; hashes any other secret format via SHA-256
 * to guarantee an exact 32-byte key material.
 */
async function importAesGcmKey(secret: string): Promise<CryptoKey> {
  const cleanSecret = secret.trim();
  let keyBuffer: ArrayBuffer;

  // 64 hex characters = exactly 32 bytes (256 bits)
  if (/^[0-9a-fA-F]{64}$/.test(cleanSecret)) {
    keyBuffer = hexToArrayBuffer(cleanSecret);
  } else {
    // Derive a consistent 32-byte hash using SHA-256
    const secretBuffer = new TextEncoder().encode(cleanSecret);
    const hash = await crypto.subtle.digest('SHA-256', secretBuffer);
    const buf = new ArrayBuffer(hash.byteLength);
    new Uint8Array(buf).set(new Uint8Array(hash));
    keyBuffer = buf;
  }

  return crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a plaintext API key using AES-256-GCM with a random 12-byte IV.
 * Returns the packed format `${ivHex}:${ciphertextHex}`.
 *
 * @param plainKey Plaintext secret API key
 * @param secretHex 32-byte hex encryption key (or passphrase)
 * @returns Packed string containing `${iv}:${ciphertext}` in hex
 */
export async function encryptKey(plainKey: string, secretHex: string): Promise<string> {
  const result = await encryptKeyWithIv(plainKey, secretHex);
  return result.packed;
}

/**
 * Encrypts a plaintext API key and returns separate parts matching the Prisma ApiKey table
 * (`encryptedKey`, `iv`) along with the packed string.
 *
 * @param plainKey Plaintext secret API key
 * @param secretHex 32-byte hex encryption key
 */
export async function encryptKeyWithIv(
  plainKey: string,
  secretHex: string
): Promise<EncryptedParts> {
  if (!plainKey) {
    throw new Error('Cannot encrypt an empty key');
  }
  if (!secretHex) {
    throw new Error('Encryption secret is required');
  }

  const key = await importAesGcmKey(secretHex);

  // AES-GCM standard recommends a 12-byte (96-bit) IV
  const ivBuffer = new ArrayBuffer(12);
  const ivView = new Uint8Array(ivBuffer);
  crypto.getRandomValues(ivView);

  const encodedPlaintext = new TextEncoder().encode(plainKey);
  const plainBuffer = new ArrayBuffer(encodedPlaintext.byteLength);
  new Uint8Array(plainBuffer).set(encodedPlaintext);

  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: ivBuffer },
    key,
    plainBuffer
  );

  const ivHex = bytesToHex(ivView);
  const cipherHex = bytesToHex(new Uint8Array(encryptedBuffer));
  const packed = `${ivHex}:${cipherHex}`;

  return {
    encryptedKey: cipherHex,
    iv: ivHex,
    packed,
  };
}

/**
 * Decrypts an AES-256-GCM encrypted API key.
 * Accepts either:
 *  - A packed string: `${ivHex}:${cipherHex}`
 *  - An object: `{ encryptedKey: cipherHex, iv: ivHex }`
 *  - Separate cipherHex and explicitIv parameters
 *
 * @param encryptedInput Packed string or object containing encryptedKey and iv
 * @param secretHex 32-byte hex encryption key
 * @param explicitIv Optional IV hex if encryptedInput only contains ciphertext
 * @returns Decrypted plaintext key
 */
export async function decryptKey(
  encryptedInput: string | { encryptedKey: string; iv: string },
  secretHex: string,
  explicitIv?: string
): Promise<string> {
  if (!encryptedInput) {
    throw new Error('Encrypted input is required for decryption');
  }
  if (!secretHex) {
    throw new Error('Encryption secret is required');
  }

  let ivHex: string;
  let cipherHex: string;

  if (typeof encryptedInput === 'object' && encryptedInput !== null) {
    ivHex = encryptedInput.iv;
    cipherHex = encryptedInput.encryptedKey;
  } else if (typeof encryptedInput === 'string' && encryptedInput.includes(':')) {
    const parts = encryptedInput.split(':');
    ivHex = parts[0] ?? '';
    cipherHex = parts[1] ?? '';
  } else if (typeof encryptedInput === 'string' && explicitIv) {
    ivHex = explicitIv;
    cipherHex = encryptedInput;
  } else {
    throw new Error('Invalid encrypted key format: missing IV');
  }

  if (!ivHex || !cipherHex) {
    throw new Error('Malformed encrypted payload: IV and ciphertext must both be present');
  }

  const key = await importAesGcmKey(secretHex);
  const ivBuffer = hexToArrayBuffer(ivHex);
  const cipherBuffer = hexToArrayBuffer(cipherHex);

  try {
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivBuffer },
      key,
      cipherBuffer
    );

    return new TextDecoder().decode(decryptedBuffer);
  } catch (err: unknown) {
    const error = new Error('Failed to decrypt key: ciphertext authentication failed or secret mismatch');
    (error as { cause?: unknown }).cause = err;
    throw error;
  }
}

/**
 * Extracts the last 4 characters of an API key for safe user display and auditing.
 * Redacts all other characters.
 *
 * @param plainKey Plaintext API key
 * @returns Last 4 characters (e.g., "7x9a")
 */
export function getKeyLast4(plainKey: string): string {
  if (!plainKey) return '';
  const trimmed = plainKey.trim();
  return trimmed.slice(-4);
}
