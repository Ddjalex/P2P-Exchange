/**
 * BSC (BNB Smart Chain) USDT transaction verification via BSCScan API.
 * USDT BEP20 contract: 0x55d398326f99059fF775485246999027B3197955 (18 decimals)
 */

const BSC_USDT_CONTRACT = "0x55d398326f99059ff775485246999027b3197955";
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const USDT_DECIMALS = 18;

export interface BscTxResult {
  confirmed: boolean;
  from: string;
  to: string;
  amount: string;
}

export async function getBscUsdtTx(txHash: string, apiKey?: string): Promise<BscTxResult | null> {
  const key = apiKey || process.env["BSCSCAN_API_KEY"] || "";
  const apiKeyParam = key ? `&apikey=${key}` : "";
  // Etherscan unified V2 API with chainid=56 for BNB Smart Chain (BSCScan v1 is deprecated)
  const url = `https://api.etherscan.io/v2/api?chainid=56&module=proxy&action=eth_getTransactionReceipt&txhash=${encodeURIComponent(txHash)}${apiKeyParam}`;

  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) return null;

  const data = await res.json();
  const receipt = data?.result;
  if (!receipt || typeof receipt !== "object") return null;

  // status "0x1" = success, "0x0" = reverted
  if (receipt.status !== "0x1") return null;

  const logs: any[] = Array.isArray(receipt.logs) ? receipt.logs : [];

  // Find the USDT Transfer(from, to, value) log
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

  // Convert to USDT with 6 decimal places for display
  const divisor = BigInt(10 ** USDT_DECIMALS);
  const whole = rawAmount / divisor;
  const frac = rawAmount % divisor;
  const fracStr = frac.toString().padStart(USDT_DECIMALS, "0").slice(0, 6);
  const amount = `${whole}.${fracStr}`;

  return { confirmed: true, from, to, amount };
}
