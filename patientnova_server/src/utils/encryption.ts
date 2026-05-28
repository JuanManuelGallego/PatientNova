import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV recommended for GCM
const AUTH_TAG_LENGTH = 16;
const PREFIX = "enc:v1:";

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

function getKeyBuffer(key: string): Buffer {
  if (!key || key.length !== 64) {
    throw new EncryptionError(
      "ENCRYPTION_KEY must be a 64-character hex string (256 bits)",
    );
  }
  return Buffer.from(key, "hex");
}

export function isEncrypted(value: string): boolean {
  return value.startsWith(PREFIX);
}

export function encrypt(plaintext: string, key: string): string {
  const keyBuffer = getKeyBuffer(key);
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

export function decrypt(ciphertext: string, key: string): string {
  if (!ciphertext.startsWith(PREFIX)) {
    throw new EncryptionError("Ciphertext does not have the expected prefix");
  }

  const keyBuffer = getKeyBuffer(key);
  const payload = Buffer.from(ciphertext.slice(PREFIX.length), "base64");

  if (payload.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new EncryptionError("Ciphertext payload is too short");
  }

  const iv = payload.subarray(0, IV_LENGTH);
  const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = payload.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, keyBuffer, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
