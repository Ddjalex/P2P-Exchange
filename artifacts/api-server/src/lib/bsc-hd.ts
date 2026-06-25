/**
 * Per-user BEP20 deposit address derivation.
 * Derives a unique BEP20 address for each userId using BIP-44 HD path:
 *   m/44'/60'/0'/0/<userId>
 *
 * Requires DEPOSIT_MASTER_KEY env var — a 64-hex-char master seed.
 */

import { ethers } from "ethers";
import { HDKey } from "@scure/bip32";

const DERIVATION_PATH_PREFIX = "m/44'/60'/0'/0/";

let masterKey: HDKey | null = null;

function getMasterKey(): HDKey {
  if (masterKey) return masterKey;
  const hex = process.env["DEPOSIT_MASTER_KEY"];
  if (!hex || hex.length !== 64) {
    throw new Error("DEPOSIT_MASTER_KEY is not set or invalid (must be 64 hex chars)");
  }
  const seed = Buffer.from(hex, "hex");
  masterKey = HDKey.fromMasterSeed(seed);
  return masterKey;
}

/**
 * Returns the BEP20 deposit address for a given userId.
 * Deterministic — same userId always produces the same address.
 */
export function deriveDepositAddress(userId: number): string {
  const child = getMasterKey().derive(`${DERIVATION_PATH_PREFIX}${userId}`);
  if (!child.privateKey) throw new Error(`Failed to derive key for userId ${userId}`);
  const privateKey = Buffer.from(child.privateKey).toString("hex");
  return new ethers.Wallet(privateKey).address;
}

/**
 * Returns true if DEPOSIT_MASTER_KEY is configured.
 */
export function isHdConfigured(): boolean {
  const hex = process.env["DEPOSIT_MASTER_KEY"];
  return typeof hex === "string" && hex.length === 64;
}
