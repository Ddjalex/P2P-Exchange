/**
 * BIP32/BIP44 HD wallet derivation for per-user TRON TRC20 deposit addresses.
 *
 * SINGLE SOURCE OF TRUTH — import from here in EVERY place that needs either:
 *   • a user's deposit address   → deriveUserDepositAddress(masterKey, userId)
 *   • a user's private key        → deriveUserPrivateKey(masterKey, userId)
 *
 * Both functions use the IDENTICAL BIP44 path:
 *   m/44'/195'/0'/0/<userId>
 *   (TRON coin type = 195)
 *
 * The masterKey is the hex private key from HOT_WALLET_PRIVATE_KEY env var.
 * Its bytes are used as the BIP32 master seed — child keys are deterministic
 * and reproducible from the same seed + userId.
 *
 * Consistency guarantee:
 *   const addr = deriveUserDepositAddress(key, id);
 *   const priv = deriveUserPrivateKey(key, id);
 *   privateKeyToTronAddress(priv) === addr  // always TRUE
 */

import { HDKey } from "@scure/bip32";
import { privateKeyToTronAddress } from "./tron.js";

const TRON_BIP44_PATH = (userId: number) => `m/44'/195'/0'/0/${userId}`;

/**
 * Build the BIP32 master HDKey from the raw 32-byte private key.
 * The key bytes are passed as the BIP32 seed; fromMasterSeed applies
 * HMAC-SHA512("Bitcoin seed", seed) internally to produce the master key pair.
 */
function getMasterHDKey(masterKeyHex: string): HDKey {
  const seed = Buffer.from(masterKeyHex.replace(/^0x/, ""), "hex");
  if (seed.length < 16) throw new Error("HOT_WALLET_PRIVATE_KEY is too short (need ≥ 16 bytes)");
  return HDKey.fromMasterSeed(seed);
}

/**
 * Derive the private key (hex string) for a user's unique deposit address.
 * Uses path m/44'/195'/0'/0/<userId>.
 */
export function deriveUserPrivateKey(masterKeyHex: string, userId: number): string {
  const master = getMasterHDKey(masterKeyHex);
  const path = TRON_BIP44_PATH(userId);
  const child = master.derive(path);
  if (!child.privateKey) throw new Error(`Cannot derive private key at ${path}`);
  return Buffer.from(child.privateKey).toString("hex");
}

/**
 * Derive the TRON TRC20 deposit address for a user.
 * Uses path m/44'/195'/0'/0/<userId> — IDENTICAL to deriveUserPrivateKey.
 *
 * Verify consistency:
 *   const addr = deriveUserDepositAddress(key, id);
 *   const priv = deriveUserPrivateKey(key, id);
 *   console.log(privateKeyToTronAddress(priv) === addr); // true
 */
export function deriveUserDepositAddress(masterKeyHex: string, userId: number): string {
  const privateKey = deriveUserPrivateKey(masterKeyHex, userId);
  return privateKeyToTronAddress(privateKey);
}

/** Convenience — read master key from env and derive address. Returns null if key not set. */
export function deriveAddressFromEnv(userId: number): string | null {
  const key = process.env["HOT_WALLET_PRIVATE_KEY"] ?? process.env["MASTER_PRIVATE_KEY"];
  if (!key) return null;
  try {
    return deriveUserDepositAddress(key, userId);
  } catch {
    return null;
  }
}

/** Convenience — read master key from env and derive private key. Returns null if key not set. */
export function derivePrivateKeyFromEnv(userId: number): string | null {
  const key = process.env["HOT_WALLET_PRIVATE_KEY"] ?? process.env["MASTER_PRIVATE_KEY"];
  if (!key) return null;
  try {
    return deriveUserPrivateKey(key, userId);
  } catch {
    return null;
  }
}
