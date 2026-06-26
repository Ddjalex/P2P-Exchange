/**
 * Per-user BEP20 deposit address derivation.
 * Reuses BSC_HOT_WALLET_PRIVATE_KEY as the HD master seed — same key,
 * two purposes (signing withdrawals + deriving per-user deposit addresses).
 *
 * HD path: m/44'/60'/0'/0/<userId>
 */

import { ethers } from "ethers";
import { HDKey } from "@scure/bip32";

const DERIVATION_PATH_PREFIX = "m/44'/60'/0'/0/";

let masterKey: HDKey | null = null;

function getMasterKey(): HDKey {
  if (masterKey) return masterKey;
  const raw = process.env["BSC_HOT_WALLET_PRIVATE_KEY"];
  if (!raw) throw new Error("BSC_HOT_WALLET_PRIVATE_KEY is not set");
  // Strip optional 0x prefix, use the 32-byte private key as the HD seed
  const hex = raw.startsWith("0x") || raw.startsWith("0X") ? raw.slice(2) : raw;
  if (hex.length !== 64) throw new Error("BSC_HOT_WALLET_PRIVATE_KEY must be 32 bytes (64 hex chars)");
  masterKey = HDKey.fromMasterSeed(Buffer.from(hex, "hex"));
  return masterKey;
}

/**
 * Returns the BEP20 deposit address for a given userId.
 * Deterministic — same userId always produces the same address.
 */
export function deriveDepositAddress(userId: number): string {
  const child = getMasterKey().derive(`${DERIVATION_PATH_PREFIX}${userId}`);
  if (!child.privateKey) throw new Error(`Failed to derive key for userId ${userId}`);
  return new ethers.Wallet(Buffer.from(child.privateKey).toString("hex")).address;
}

/**
 * Returns the raw 64-hex-char private key for a given userId's deposit address.
 * Used by the sweep function to sign outgoing USDT transfers.
 */
export function derivePrivateKey(userId: number): string {
  const child = getMasterKey().derive(`${DERIVATION_PATH_PREFIX}${userId}`);
  if (!child.privateKey) throw new Error(`Failed to derive private key for userId ${userId}`);
  return Buffer.from(child.privateKey).toString("hex");
}

/**
 * Returns true when BSC_HOT_WALLET_PRIVATE_KEY is set and the HD key
 * can be initialised (i.e. per-user deposit addresses are available).
 */
export function isHdConfigured(): boolean {
  try {
    getMasterKey();
    return true;
  } catch {
    return false;
  }
}
