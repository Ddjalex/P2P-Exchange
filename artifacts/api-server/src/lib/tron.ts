/**
 * Minimal TRON / TRC20 USDT utilities using TronGrid REST API.
 * No tronweb dependency — pure fetch + @noble/secp256k1 for signing.
 *
 * USDT TRC20 contract on mainnet: TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t
 */
import { getPublicKey, sign as secp256k1Sign } from "@noble/secp256k1";
import { createHash, createHmac } from "node:crypto";

// ─── Config ──────────────────────────────────────────────────────────────────

const TRON_GRID = "https://api.trongrid.io";
const USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const USDT_DECIMALS = 6; // USDT on TRON has 6 decimals

function apiHeaders(overrideKey?: string): Record<string, string> {
  const key = overrideKey || process.env["TRONGRID_API_KEY"] || "";
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (key) h["TRON-PRO-API-KEY"] = key;
  return h;
}

// ─── Address helpers ──────────────────────────────────────────────────────────

/** SHA-256 hash */
function sha256(data: Uint8Array): Uint8Array {
  return new Uint8Array(createHash("sha256").update(data).digest());
}

/** Keccak-256 — implemented with SHA-3 via node:crypto (sha3-256 ≠ keccak but close enough is NOT ok) */
// We need real keccak-256. Implement via the secp256k1 lib's internal crypto or a manual one.
// Simplest approach: use the JS keccak from scratch using a small helper.
function keccak256(data: Uint8Array): Uint8Array {
  // Node.js 21+ has crypto.hash but older doesn't have keccak.
  // We'll compute it using the "js-sha3" algorithm manually —
  // but since that's complex, we use a known-good approach via @noble/hashes if available.
  // Fallback: use node:crypto createHash('sha3-256') — NOT the same, but for address derivation
  // we need real keccak. Use a manual implementation.
  return keccak256Impl(data);
}

// Minimal Keccak-256 implementation
function keccak256Impl(msg: Uint8Array): Uint8Array {
  // Rate = 1088 bits = 136 bytes, capacity = 512 bits, output = 256 bits = 32 bytes
  const RATE = 136;
  const STATE_SIZE = 200; // 25 * 8 bytes
  const state = new Uint8Array(STATE_SIZE);

  // Absorb
  let offset = 0;
  const len = msg.length;
  while (offset < len) {
    const chunk = Math.min(RATE, len - offset);
    for (let i = 0; i < chunk; i++) state[i] ^= msg[offset + i];
    if (chunk === RATE) keccakF(state);
    offset += chunk;
  }

  // Padding (Keccak original, NOT SHA3)
  state[len % RATE] ^= 0x01;
  state[RATE - 1] ^= 0x80;
  keccakF(state);

  return state.slice(0, 32);
}

// Keccak-f[1600] permutation
function keccakF(state: Uint8Array): void {
  const A = new BigInt64Array(25);
  for (let i = 0; i < 25; i++) {
    A[i] = BigInt(0);
    for (let b = 0; b < 8; b++) {
      A[i] |= BigInt(state[i * 8 + b]) << BigInt(b * 8);
    }
  }

  const RC = [
    0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an, 0x8000000080008000n,
    0x000000000000808bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n,
    0x000000000000008an, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
    0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n,
    0x8000000000008002n, 0x8000000000000080n, 0x000000000000800an, 0x800000008000000an,
    0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n,
  ];
  const ROT = [
    0, 1, 62, 28, 27, 36, 44, 6, 55, 20, 3, 10, 43,
    25, 39, 41, 45, 15, 21, 8, 18, 2, 61, 56, 14,
  ];

  const MASK = 0xFFFFFFFFFFFFFFFFn;
  const rot64 = (v: bigint, n: number) => ((v << BigInt(n)) | (v >> BigInt(64 - n))) & MASK;

  for (let round = 0; round < 24; round++) {
    // Theta
    const C = Array.from({ length: 5 }, (_, x) => A[x] ^ A[x + 5] ^ A[x + 10] ^ A[x + 15] ^ A[x + 20]);
    const D = Array.from({ length: 5 }, (_, x) => C[(x + 4) % 5] ^ rot64(C[(x + 1) % 5], 1));
    for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) A[x + 5 * y] ^= D[x];
    // Rho + Pi
    const B = new BigInt64Array(25);
    for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) B[y + 5 * ((2 * x + 3 * y) % 5)] = rot64(A[x + 5 * y], ROT[x + 5 * y]);
    // Chi
    for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) A[x + 5 * y] = B[x + 5 * y] ^ (~B[(x + 1) % 5 + 5 * y] & B[(x + 2) % 5 + 5 * y]);
    // Iota
    A[0] ^= RC[round];
  }

  for (let i = 0; i < 25; i++) {
    for (let b = 0; b < 8; b++) {
      state[i * 8 + b] = Number((A[i] >> BigInt(b * 8)) & 0xFFn);
    }
  }
}

/** Base58Check encode (TRON uses same alphabet as Bitcoin) */
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58Encode(bytes: Uint8Array): string {
  let num = BigInt("0x" + Buffer.from(bytes).toString("hex"));
  let result = "";
  const base = BigInt(58);
  while (num > 0n) {
    result = BASE58_ALPHABET[Number(num % base)] + result;
    num = num / base;
  }
  // Leading zeros
  for (const b of bytes) {
    if (b !== 0) break;
    result = "1" + result;
  }
  return result;
}

function base58Decode(str: string): Uint8Array {
  let num = 0n;
  for (const ch of str) {
    const idx = BASE58_ALPHABET.indexOf(ch);
    if (idx < 0) throw new Error("Invalid base58 character");
    num = num * 58n + BigInt(idx);
  }
  const hex = num.toString(16).padStart(2, "0");
  const bytes = Buffer.from(hex.length % 2 ? "0" + hex : hex, "hex");
  const leadingZeros = [...str].filter(c => c === "1").length;
  const result = new Uint8Array(leadingZeros + bytes.length);
  result.set(bytes, leadingZeros);
  return result;
}

/** Convert hex private key → TRON base58 address */
export function privateKeyToTronAddress(privateKeyHex: string): string {
  const privBytes = Buffer.from(privateKeyHex.replace(/^0x/, ""), "hex");
  const pubKey = getPublicKey(privBytes, false); // uncompressed 65 bytes
  const pubKeyBody = pubKey.slice(1); // remove 0x04 prefix → 64 bytes
  const hash = keccak256(pubKeyBody); // 32 bytes
  const addrBytes = new Uint8Array(21);
  addrBytes[0] = 0x41; // TRON prefix
  addrBytes.set(hash.slice(12), 1); // last 20 bytes of keccak
  const checksum = sha256(sha256(addrBytes)).slice(0, 4);
  const full = new Uint8Array(25);
  full.set(addrBytes);
  full.set(checksum, 21);
  return base58Encode(full);
}

/** Convert TRON base58 address → hex (without 0x, with 41 prefix) */
export function tronAddressToHex(address: string): string {
  const decoded = base58Decode(address);
  return Buffer.from(decoded.slice(0, 21)).toString("hex");
}

// ─── Per-user deposit address derivation ─────────────────────────────────────

/**
 * Derive a deterministic unique private key for a user's deposit address.
 * Uses HMAC-SHA256(masterSeed, "deposit:user:<userId>") so each user gets
 * a unique, reproducible key without storing it in the DB.
 */
export function deriveUserDepositKey(masterSeed: string, userId: number): string {
  const hmac = createHmac("sha256", masterSeed);
  hmac.update(`deposit:user:${userId}`);
  return hmac.digest("hex");
}

/** Derive the TRON deposit address for a given user */
export function deriveUserDepositAddress(masterSeed: string, userId: number): string {
  const privateKey = deriveUserDepositKey(masterSeed, userId);
  return privateKeyToTronAddress(privateKey);
}

/** Convert hex address (41...) → TRON base58 */
export function hexToTronAddress(hex: string): string {
  const bytes = Buffer.from(hex, "hex");
  const checksum = sha256(sha256(bytes)).slice(0, 4);
  const full = new Uint8Array(bytes.length + 4);
  full.set(bytes);
  full.set(checksum, bytes.length);
  return base58Encode(full);
}

// ─── TronGrid API helpers ─────────────────────────────────────────────────────

/** Fetch USDT TRC20 balance for an address (returns human-readable USDT amount) */
export async function getTrc20Balance(address: string): Promise<string> {
  const url = `${TRON_GRID}/v1/accounts/${address}`;
  const res = await fetch(url, { headers: apiHeaders() });
  const data = await res.json() as any;
  const trc20List: any[] = data?.data?.[0]?.trc20 ?? [];
  const usdtEntry = trc20List.find((t: any) => Object.keys(t)[0] === USDT_CONTRACT);
  if (!usdtEntry) return "0";
  const raw = parseInt(usdtEntry[USDT_CONTRACT] ?? "0", 10);
  return (raw / 10 ** USDT_DECIMALS).toFixed(6);
}

/** Get recent TRC20 USDT transactions for an address */
export async function getTrc20Transactions(address: string, minTimestamp?: number): Promise<TronTx[]> {
  const params = new URLSearchParams({
    contract_address: USDT_CONTRACT,
    limit: "50",
    order_by: "block_timestamp,desc",
  });
  if (minTimestamp) params.set("min_timestamp", String(minTimestamp));

  const url = `${TRON_GRID}/v1/accounts/${address}/transactions/trc20?${params}`;
  const res = await fetch(url, { headers: apiHeaders() });
  if (!res.ok) return [];
  const data = await res.json() as any;
  return (data?.data ?? []).map((tx: any) => ({
    txid: tx.transaction_id as string,
    from: tx.from as string,
    to: tx.to as string,
    value: tx.value as string,         // raw integer string (6 decimals)
    blockTimestamp: tx.block_timestamp as number,
    confirmed: tx.confirmed as boolean,
  }));
}

export interface TronTx {
  txid: string;
  from: string;
  to: string;
  value: string;    // raw (6 decimals, e.g. "10000000" = 10 USDT)
  blockTimestamp: number;
  confirmed: boolean;
}

/** Parse raw TRC20 value → human USDT string */
export function rawToUsdt(raw: string): string {
  return (parseInt(raw, 10) / 10 ** USDT_DECIMALS).toFixed(6);
}

// ─── Sign & broadcast a TRC20 transfer ───────────────────────────────────────

/** Build + sign + broadcast USDT TRC20 transfer. Returns txid on success. */
export async function sendUsdt(
  fromPrivKeyHex: string,
  toAddress: string,
  amountUsdt: number,
): Promise<string> {
  const privateKey = fromPrivKeyHex.replace(/^0x/, "");
  const fromAddress = privateKeyToTronAddress(privateKey);
  const amountSun = Math.round(amountUsdt * 10 ** USDT_DECIMALS); // sun = 1e-6 USDT

  // ABI-encode transfer(address,uint256)
  const funcSelector = "a9059cbb"; // keccak256("transfer(address,uint256)").slice(0,4) hex
  const toHex = tronAddressToHex(toAddress).slice(2); // remove 41 prefix, pad to 32 bytes
  const toHexPadded = toHex.padStart(64, "0");
  const amountHex = amountSun.toString(16).padStart(64, "0");
  const parameter = toHexPadded + amountHex;

  // 1. Build unsigned tx
  const buildRes = await fetch(`${TRON_GRID}/wallet/triggersmartcontract`, {
    method: "POST",
    headers: apiHeaders(),
    body: JSON.stringify({
      owner_address: tronAddressToHex(fromAddress),
      contract_address: tronAddressToHex(USDT_CONTRACT),
      function_selector: "transfer(address,uint256)",
      parameter,
      fee_limit: 20_000_000, // 20 TRX max fee
      call_value: 0,
    }),
  });
  const buildData = await buildRes.json() as any;
  if (buildData.result?.code && buildData.result.code !== "SUCCESS") {
    throw new Error(`Build tx failed: ${buildData.result.message}`);
  }
  const unsignedTx = buildData.transaction;
  if (!unsignedTx) throw new Error("No transaction returned from TronGrid");

  // 2. Sign
  const rawDataHex: string = unsignedTx.raw_data_hex;
  const msgBytes = Buffer.from(rawDataHex, "hex");
  const msgHash = sha256(sha256(msgBytes));
  const privBytes = Buffer.from(privateKey, "hex");
  const { signature, recovery } = secp256k1Sign(msgHash, privBytes, { recovered: true });
  const sigBytes = signature.toCompactRawBytes();
  const sigHex = Buffer.from(sigBytes).toString("hex") + recovery.toString(16).padStart(2, "0");

  const signedTx = { ...unsignedTx, signature: [sigHex] };

  // 3. Broadcast
  const broadcastRes = await fetch(`${TRON_GRID}/wallet/broadcasttransaction`, {
    method: "POST",
    headers: apiHeaders(),
    body: JSON.stringify(signedTx),
  });
  const broadcastData = await broadcastRes.json() as any;
  if (!broadcastData.result) {
    throw new Error(`Broadcast failed: ${broadcastData.message ?? JSON.stringify(broadcastData)}`);
  }

  return unsignedTx.txID as string;
}

/**
 * Normalize any TRON address representation to base58.
 * TronGrid event result fields can return addresses as:
 *   - Base58 already ("Txxxx", length 34)
 *   - 20-byte hex (40 chars, no prefix) — need "41" prepended
 *   - 21-byte hex (42 chars, starts with "41") — already has prefix
 *   - ABI-encoded 32-byte hex (64 chars) — take last 40 chars, prepend "41"
 */
function normalizeTronAddress(addr: string): string {
  if (!addr) return "";
  // Already base58 TRON address (starts with T, 33-35 chars)
  if (/^T[A-Za-z0-9]{32,34}$/.test(addr)) return addr;
  // Strip 0x prefix
  const h = addr.replace(/^0x/, "");
  if (h.length === 64) return hexToTronAddress("41" + h.slice(-40)); // ABI 32-byte
  if (h.length === 42 && h.startsWith("41")) return hexToTronAddress(h); // 21-byte with prefix
  if (h.length === 40) return hexToTronAddress("41" + h); // 20-byte bare
  return addr; // fallback: return as-is
}

/** Fetch TRC20 USDT transfer details for a given txid via TronGrid event log */
export async function getTrc20TxDetails(txid: string, apiKey?: string): Promise<{ from: string; to: string; amount: string; confirmed: boolean } | null> {
  try {
    const headers = apiHeaders(apiKey);
    const res = await fetch(`${TRON_GRID}/v1/transactions/${txid}/events`, { headers });
    if (!res.ok) return null;
    const data = await res.json() as any;
    const events: any[] = data?.data ?? [];

    // Match the Transfer event from the USDT contract.
    // TronGrid returns contract_address as base58 in the events API.
    const transfer = events.find((e: any) =>
      e.event_name === "Transfer" &&
      (e.contract_address === USDT_CONTRACT ||
       e.contract_address?.toLowerCase() === USDT_CONTRACT.toLowerCase())
    );

    if (!transfer) {
      // Fallback: confirm the tx exists on-chain at all
      const txRes = await fetch(`${TRON_GRID}/wallet/gettransactionbyid`, {
        method: "POST",
        headers,
        body: JSON.stringify({ value: txid }),
      });
      if (!txRes.ok) return null;
      const tx = await txRes.json() as any;
      // TX exists but is not a USDT transfer (wrong contract, wrong token, etc.)
      if (!tx?.txID) return null;
      return null;
    }

    const rawAmount = transfer.result?.value ?? transfer.result?.amount ?? "0";

    // Normalize addresses — TronGrid may return hex or base58 depending on API version
    const toAddress = normalizeTronAddress(transfer.result?.to || transfer.result?.["1"] || "");
    const fromAddress = normalizeTronAddress(
      transfer.result?.from || transfer.result?.["0"] || transfer.caller_contract_address || ""
    );

    return {
      from: fromAddress,
      to: toAddress,
      amount: rawToUsdt(rawAmount),
      confirmed: true,
    };
  } catch {
    return null;
  }
}

/** Check if a txid is confirmed on-chain */
export async function getTxInfo(txid: string): Promise<{ confirmed: boolean; amount: string; to: string; from: string } | null> {
  const res = await fetch(`${TRON_GRID}/v1/transactions/${txid}`, { headers: apiHeaders() });
  if (!res.ok) return null;
  const data = await res.json() as any;
  const tx = data?.data?.[0];
  if (!tx) return null;
  return {
    confirmed: tx.confirmed ?? false,
    amount: "0",
    to: tx.raw_data?.contract?.[0]?.parameter?.value?.to_address ?? "",
    from: tx.raw_data?.contract?.[0]?.parameter?.value?.owner_address ?? "",
  };
}
