/**
 * BSC (BNB Smart Chain) USDT transaction verification via public BSC RPC.
 * Uses free public RPC nodes — no API key required.
 * USDT BEP20 contract: 0x55d398326f99059fF775485246999027B3197955 (18 decimals)
 */

const BSC_RPC_ENDPOINTS = [
  "https://bsc-dataseed.binance.org/",
  "https://bsc-dataseed1.binance.org/",
  "https://bsc-dataseed2.binance.org/",
  "https://bsc-dataseed3.binance.org/",
];

const BSC_USDT_CONTRACT = "0x55d398326f99059ff775485246999027b3197955";
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const USDT_DECIMALS = 18;

export interface BscTxResult {
  confirmed: boolean;
  from: string;
  to: string;
  amount: string;
}

async function rpcCall(method: string, params: unknown[]): Promise<unknown> {
  for (const endpoint of BSC_RPC_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) continue;
      const data = await res.json() as any;
      if (data?.error) throw new Error(data.error.message ?? "RPC error");
      return data?.result ?? null;
    } catch {
      continue;
    }
  }
  throw new Error("All BSC RPC endpoints failed");
}

export async function getBscUsdtTx(txHash: string): Promise<BscTxResult | null> {
  const receipt = await rpcCall("eth_getTransactionReceipt", [txHash]) as any;
  if (!receipt) return null;

  // status "0x1" = success, "0x0" = reverted
  if (receipt.status !== "0x1") return null;

  const logs: any[] = Array.isArray(receipt.logs) ? receipt.logs : [];

  const transferLog = logs.find(
    (log) =>
      log.address?.toLowerCase() === BSC_USDT_CONTRACT &&
      Array.isArray(log.topics) &&
      log.topics.length >= 3 &&
      log.topics[0]?.toLowerCase() === TRANSFER_TOPIC
  );

  if (!transferLog) return null;

  // topics[1] = from (32-byte padded), topics[2] = to (32-byte padded)
  const from = "0x" + transferLog.topics[1].slice(-40);
  const to = "0x" + transferLog.topics[2].slice(-40);

  // data = hex-encoded uint256 amount (18 decimals)
  let rawAmount: bigint;
  try {
    rawAmount = BigInt(transferLog.data);
  } catch {
    return null;
  }

  const divisor = BigInt(10 ** USDT_DECIMALS);
  const whole = rawAmount / divisor;
  const frac = rawAmount % divisor;
  const fracStr = frac.toString().padStart(USDT_DECIMALS, "0").slice(0, 6);
  const amount = `${whole}.${fracStr}`;

  return { confirmed: true, from, to, amount };
}

/** Ping the BSC RPC to confirm connectivity — used by admin test endpoint */
export async function pingBscRpc(): Promise<{ ok: boolean; blockNumber?: string }> {
  try {
    const result = await rpcCall("eth_blockNumber", []) as string;
    return { ok: true, blockNumber: result };
  } catch {
    return { ok: false };
  }
}
