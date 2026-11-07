import { config } from "../config/config.js";
import { createKeyring, type Keyring } from "./field-encryption.js";

let cached: Keyring | null | undefined;

/** The keyring built from config (current + optional previous key); null when no key is configured. */
export function activeKeyring(): Keyring | null {
  if (cached === undefined) {
    const { key, previousKey } = config.encryption;
    cached = key ? createKeyring(key, previousKey) : null;
  }
  return cached;
}
