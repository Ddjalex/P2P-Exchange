/**
 * BSC (BNB Smart Chain) USDT utilities — send, balance, and TX verification.
 * USDT BEP20 contract: 0x55d398326f99059fF775485246999027B3197955 (18 decimals)
 */

import { ethers } from "ethers";

const BSC_RPC_ENDPOINTS = [
  "https://bsc-dataseed.binance.org/",
  "https://bsc-dataseed1.binance.org/",
  "https://bsc-dataseed2.binance.org/",
  "https://bsc-dataseed3.binance.org/",
];

const BSC_USDT_CONTRACT = "0x55d398326f99059fF775485246999027B3197955";
const BSC_USDT_CONTRACT_LOWER = BSC_USDT_CONTRACT.toLowerCase();
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const USDT_ABI = ["function transfer(address to, uint256 amount) returns (bool)"];
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

/** Send USDT BEP20 from hot wallet to a recipient. Returns txHash. */
export async function sendUsdtBsc(
  privateKey: string,
  toAddress: string,
  amount: number,
): Promise<string> {
  const provider = new ethers.JsonRpcProvider(BSC_RPC_ENDPOINTS[0]);
  const wallet = new ethers.Wallet(privateKey, provider);
  const usdt = new ethers.Contract(BSC_USDT_CONTRACT, USDT_ABI, wallet);
  const amountInWei = ethers.parseUnits(amount.toFixed(6), USDT_DECIMALS);
  const tx = await usdt.transfer(toAddress, amountInWei);
  const receipt = await tx.wait();
  console.log("[BSC] Transfer successful txHash:", receipt.hash);
  return receipt.hash as string;
}

/** Get BNB (native) balance of an address. */
export async function getBnbBalance(address: string): Promise<number> {
  const provider = new ethers.JsonRpcProvider(BSC_RPC_ENDPOINTS[0]);
  const balance = await provider.getBalance(address);
  return parseFloat(ethers.formatEther(balance));
}

/** Get BSC USDT balance (BEP20) of an address in human-readable form. */
export async function getBscUsdtBalance(address: string): Promise<string> {
  try {
    const balanceAbi = ["function balanceOf(address account) view returns (uint256)"];
    const provider = new ethers.JsonRpcProvider(BSC_RPC_ENDPOINTS[0]);
    const contract = new ethers.Contract(BSC_USDT_CONTRACT, balanceAbi, provider);
    const raw: bigint = await contract.balanceOf(address);
    const divisor = BigInt(10 ** USDT_DECIMALS);
    const whole = raw / divisor;
    const frac = raw % divisor;
    const fracStr = frac.toString().padStart(USDT_DECIMALS, "0").slice(0, 6);
    return `${whole}.${fracStr}`;
  } catch {
    return "0.000000";
  }
}

/** Verify a specific BEP20 USDT TX hash on-chain. */
export async function getBscUsdtTx(txHash: string): Promise<BscTxResult | null> {
  const receipt = await rpcCall("eth_getTransactionReceipt", [txHash]) as any;
  if (!receipt) return null;
  if (receipt.status !== "0x1") return null;

  const logs: any[] = Array.isArray(receipt.logs) ? receipt.logs : [];
  const transferLog = logs.find(
    (log) =>
      log.address?.toLowerCase() === BSC_USDT_CONTRACT_LOWER &&
      Array.isArray(log.topics) &&
      log.topics.length >= 3 &&
      log.topics[0]?.toLowerCase() === TRANSFER_TOPIC
  );

  if (!transferLog) return null;

  const from = "0x" + transferLog.topics[1].slice(-40);
  const to = "0x" + transferLog.topics[2].slice(-40);

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

/** Poll BSCScan API for recent incoming USDT transfers to an address. */
export interface BscScanTx {
  hash: string;
  from: string;
  to: string;
  value: string;       // raw integer string (18 decimals)
  blockNumber: string;
  timeStamp: string;
  tokenSymbol: string;
  contractAddress: string;
}

export async function getBscScanUsdtTxs(
  address: string,
  startBlock: number = 0,
  apiKey: string = "YourApiKeyToken",
): Promise<BscScanTx[]> {
  const url = new URL("https://api.bscscan.com/api");
  url.searchParams.set("module", "account");
  url.searchParams.set("action", "tokentx");
  url.searchParams.set("contractaddress", BSC_USDT_CONTRACT);
  url.searchParams.set("address", address);
  url.searchParams.set("startblock", String(startBlock));
  url.searchParams.set("sort", "desc");
  url.searchParams.set("apikey", apiKey);

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) return [];
  const data = await res.json() as any;
  if (data?.status !== "1" || !Array.isArray(data?.result)) return [];
  return data.result.filter(
    (tx: any) => tx.contractAddress?.toLowerCase() === BSC_USDT_CONTRACT_LOWER
  );
}

/** Parse raw BEP20 value (18 decimals) → human USDT string */
export function rawBscToUsdt(raw: string): string {
  try {
    const bigRaw = BigInt(raw);
    const divisor = BigInt(10 ** USDT_DECIMALS);
    const whole = bigRaw / divisor;
    const frac = bigRaw % divisor;
    const fracStr = frac.toString().padStart(USDT_DECIMALS, "0").slice(0, 6);
    return `${whole}.${fracStr}`;
  } catch {
    return "0.000000";
  }
}

/** Send BNB (native) from a wallet to cover gas fees. Returns txHash. */
export async function sendBnb(
  privateKey: string,
  toAddress: string,
  amountBnb: number,
): Promise<string> {
  const provider = new ethers.JsonRpcProvider(BSC_RPC_ENDPOINTS[0]);
  const wallet = new ethers.Wallet(privateKey, provider);
  const tx = await wallet.sendTransaction({
    to: toAddress,
    value: ethers.parseEther(amountBnb.toFixed(6)),
  });
  const receipt = await tx.wait();
  console.log("[BSC] BNB gas top-up txHash:", receipt!.hash);
  return receipt!.hash as string;
}

/** Ping the BSC RPC to confirm connectivity */
export async function pingBscRpc(): Promise<{ ok: boolean; blockNumber?: string }> {
  try {
    const result = await rpcCall("eth_blockNumber", []) as string;
    return { ok: true, blockNumber: result };
  } catch {
    return { ok: false };
  }
}
