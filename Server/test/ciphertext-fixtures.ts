// Pins the stored ciphertext format independently of src/: layout is base64(iv(12) + authTag(16) + ciphertext).
import { createCipheriv, createHash, randomBytes } from 'node:crypto';

function seal(plaintext: string, hexKey: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(hexKey, 'hex'), iv, { authTagLength: 16 });
  const body = Buffer.concat([ cipher.update(plaintext, 'utf8'), cipher.final() ]);
  return Buffer.concat([ iv, cipher.getAuthTag(), body ]).toString('base64');
}

export function sealV1(plaintext: string, hexKey: string): string {
  return `enc:v1:${seal(plaintext, hexKey)}`;
}

export function sealV2(plaintext: string, hexKey: string): string {
  const kid = createHash('sha256')
    .update(Buffer.concat([ Buffer.from('patientnova-key-id:', 'utf8'), Buffer.from(hexKey, 'hex') ]))
    .digest('hex')
    .slice(0, 8);
  return `enc:v2:${kid}:${seal(plaintext, hexKey)}`;
}
