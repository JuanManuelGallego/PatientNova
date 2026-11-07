import { randomBytes, createCipheriv, createDecipheriv, createHash } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV recommended for GCM
const AUTH_TAG_LENGTH = 16;
const PREFIX = "enc:v1:";
const V2_PATTERN = /^enc:v2:([0-9a-f]{8}):/;
const KEY_ID_DOMAIN = "patientnova-key-id:";

export class EncryptionError extends Error {
  constructor(
    message: string,
    public readonly context?: {
      model?: string;
      field?: string;
      recordId?: string | undefined;
    },
  ) {
    super(message);
    this.name = "EncryptionError";
  }
}

export interface Keyring {
  currentId: string;
  keys: ReadonlyMap<string, Buffer>;
}

function getKeyBuffer(key: string): Buffer {
  if (!key || !/^[0-9a-f]{64}$/i.test(key)) {
    throw new EncryptionError(
      "ENCRYPTION_KEY must be a 64-character hex string (256 bits)",
    );
  }
  return Buffer.from(key, "hex");
}

/** Short, non-secret identifier of a key (first 8 hex chars of a domain-separated SHA-256). */
export function keyId(key: string): string {
  return createHash("sha256")
    .update(Buffer.concat([Buffer.from(KEY_ID_DOMAIN, "utf8"), getKeyBuffer(key)]))
    .digest("hex")
    .slice(0, 8);
}

export function createKeyring(current: string, previous?: string): Keyring {
  const currentBuffer = getKeyBuffer(current);
  const currentId = keyId(current);
  const keys = new Map<string, Buffer>([[currentId, currentBuffer]]);
  if (previous) {
    const previousId = keyId(previous);
    if (keys.has(previousId)) {
      throw new EncryptionError("Previous encryption key must differ from the current key");
    }
    keys.set(previousId, getKeyBuffer(previous));
  }
  return { currentId, keys };
}

export function isEncrypted(value: string): boolean {
  return value.startsWith(PREFIX) || V2_PATTERN.test(value);
}

export function encrypt(plaintext: string, keyring: Keyring): string {
  const keyBuffer = keyring.keys.get(keyring.currentId);
  if (!keyBuffer) throw new EncryptionError("Keyring has no current key");
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, keyBuffer, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Format: enc:v1:<base64(iv + authTag + ciphertext)>
  const payload = Buffer.concat([iv, authTag, encrypted]);
  return `${PREFIX}${payload.toString("base64")}`;
}

function open(payloadB64: string, keyBuffer: Buffer): string {
  const payload = Buffer.from(payloadB64, "base64");
  if (payload.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new EncryptionError("Ciphertext payload is too short");
  }
  const iv = payload.subarray(0, IV_LENGTH);
  const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = payload.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  try {
    const decipher = createDecipheriv(ALGORITHM, keyBuffer, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  } catch {
    throw new EncryptionError("Ciphertext authentication failed");
  }
}

export function decrypt(ciphertext: string, keyring: Keyring): string {
  const v2 = V2_PATTERN.exec(ciphertext);
  if (v2) {
    const keyBuffer = keyring.keys.get(v2[1]!);
    if (!keyBuffer) throw new EncryptionError(`Unknown encryption key id ${v2[1]}`);
    return open(ciphertext.slice(v2[0].length), keyBuffer);
  }
  if (!ciphertext.startsWith(PREFIX)) {
    throw new EncryptionError("Ciphertext does not have the expected prefix");
  }

  // v1 carries no key id: try the current key first, then the previous one.
  const payload = ciphertext.slice(PREFIX.length);
  const ordered = [
    keyring.keys.get(keyring.currentId),
    ...[...keyring.keys].filter(([id]) => id !== keyring.currentId).map(([, k]) => k),
  ].filter((k): k is Buffer => k !== undefined);
  let failure: EncryptionError | undefined;
  for (const keyBuffer of ordered) {
    try {
      return open(payload, keyBuffer);
    } catch (err) {
      failure = err as EncryptionError;
      if (failure.message === "Ciphertext payload is too short") throw failure;
    }
  }
  throw failure ?? new EncryptionError("Ciphertext authentication failed");
}
