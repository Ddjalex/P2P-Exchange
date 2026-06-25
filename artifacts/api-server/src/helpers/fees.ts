import { db } from "@workspace/db";
import { feeSettingsTable } from "@workspace/db";

export async function getFeePercents() {
  const fees = await db.select().from(feeSettingsTable);
  const feeMap: Record<string, number> = {};
  fees.forEach(f => { feeMap[f.feeType] = Number(f.value); });
  return {
    makerFeePercent: feeMap["maker_fee_percent"] ?? 0.20,
    takerFeePercent: feeMap["taker_fee_percent"] ?? 0.10,
    withdrawalFeeBEP20: feeMap["withdrawal_fee_bep20"] ?? 1.00,
  };
}

export function calculateFees(grossUsdt: number, makerPercent: number, takerPercent: number) {
  const makerFee = parseFloat((grossUsdt * makerPercent / 100).toFixed(8));
  const takerFee = parseFloat((grossUsdt * takerPercent / 100).toFixed(8));
  const totalFee = parseFloat((makerFee + takerFee).toFixed(8));
  const netUsdt = parseFloat((grossUsdt - totalFee).toFixed(8));
  return { makerFee, takerFee, totalFee, netUsdt };
}
