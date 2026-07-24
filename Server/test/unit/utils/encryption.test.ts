import { describe, it, expect } from "vitest";
import {
  encrypt,
  decrypt,
  isEncrypted,
  EncryptionError,
} from "../../../src/utils/encryption/field-encryption.js";
import { randomBytes } from "node:crypto";

const TEST_KEY = randomBytes(32).toString("hex"); // valid 64-char hex key

describe("encryption", () => {
  describe("encrypt / decrypt round-trip", () => {
    it("encrypts and decrypts a simple string", () => {
      const plaintext = "Hello, World!";
      const ciphertext = encrypt(plaintext, TEST_KEY);
      expect(ciphertext).not.toBe(plaintext);
      expect(decrypt(ciphertext, TEST_KEY)).toBe(plaintext);
    });

    it("handles empty string", () => {
      const ciphertext = encrypt("", TEST_KEY);
      expect(decrypt(ciphertext, TEST_KEY)).toBe("");
    });

    it("handles unicode characters", () => {
      const plaintext = "日本語テスト 🎉 émojis & àccénts";
      const ciphertext = encrypt(plaintext, TEST_KEY);
      expect(decrypt(ciphertext, TEST_KEY)).toBe(plaintext);
    });

    it("handles long text", () => {
      const plaintext = "A".repeat(10_000);
      const ciphertext = encrypt(plaintext, TEST_KEY);
      expect(decrypt(ciphertext, TEST_KEY)).toBe(plaintext);
    });
  });

  describe("ciphertext format", () => {
    it("ciphertext starts with enc:v1: prefix", () => {
      const ciphertext = encrypt("test", TEST_KEY);
      expect(ciphertext.startsWith("enc:v1:")).toBe(true);
    });

    it("produces different ciphertexts for the same plaintext (random IV)", () => {
      const plaintext = "same input";
      const c1 = encrypt(plaintext, TEST_KEY);
      const c2 = encrypt(plaintext, TEST_KEY);
      expect(c1).not.toBe(c2);
      // Both decrypt to same value
      expect(decrypt(c1, TEST_KEY)).toBe(plaintext);
      expect(decrypt(c2, TEST_KEY)).toBe(plaintext);
    });
  });

  describe("isEncrypted", () => {
    it("returns true for encrypted values", () => {
      expect(isEncrypted("enc:v1:abc123")).toBe(true);
    });

    it("returns false for plaintext", () => {
      expect(isEncrypted("hello world")).toBe(false);
      expect(isEncrypted("")).toBe(false);
    });
  });

  describe("tamper detection (GCM auth tag)", () => {
    it("rejects ciphertext with flipped bytes", () => {
      const ciphertext = encrypt("secret", TEST_KEY);
      // Flip a byte in the base64 payload
      const prefix = "enc:v1:";
      const payload = Buffer.from(ciphertext.slice(prefix.length), "base64");
      payload[payload.length - 1] =
        (payload[payload.length - 1]! ^ 0xff) & 0xff;
      const tampered = `${prefix}${payload.toString("base64")}`;

      expect(() => decrypt(tampered, TEST_KEY)).toThrow();
    });

    it("rejects ciphertext with wrong key", () => {
      const ciphertext = encrypt("secret", TEST_KEY);
      const wrongKey = randomBytes(32).toString("hex");
      expect(() => decrypt(ciphertext, wrongKey)).toThrow();
    });
  });

  describe("error handling", () => {
    it("throws EncryptionError for invalid key length", () => {
      expect(() => encrypt("test", "short")).toThrow(EncryptionError);
    });

    it("throws EncryptionError for missing prefix on decrypt", () => {
      expect(() => decrypt("not-encrypted", TEST_KEY)).toThrow(EncryptionError);
    });

    it("throws EncryptionError for truncated payload", () => {
      expect(() => decrypt("enc:v1:dG9v", TEST_KEY)).toThrow(EncryptionError);
    });
  });

  describe("idempotency", () => {
    it("isEncrypted detects already-encrypted values", () => {
      const ciphertext = encrypt("data", TEST_KEY);
      expect(isEncrypted(ciphertext)).toBe(true);
    });

    it("encrypting twice can be detected via prefix check", () => {
      const ciphertext = encrypt("data", TEST_KEY);
      // Application code should check isEncrypted before re-encrypting
      expect(isEncrypted(ciphertext)).toBe(true);
    });
  });
});
