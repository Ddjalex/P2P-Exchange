import { Router } from "express";
import { db } from "@workspace/db";
import { walletsTable, transactionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
const router = Router();

const ETB_RATE = "179.50";

function getOrCreateWallet(userId: number) {
  return db.select().from(walletsTable).where(
    and(eq(walletsTable.userId, userId), eq(walletsTable.asset, "USDT"))
  ).then(async rows => {
    if (rows[0]) return rows[0];
    const [w] = await db.insert(walletsTable).values({
      userId,
      asset: "USDT",
      availableBalance: "0.00",
      frozenBalance: "0.00",
    }).returning();
    return w;
  });
}

router.get("/", async (req, res) => {
  try {
    const wallet = await getOrCreateWallet((req as any).userId);
    const avail = parseFloat(wallet.availableBalance);
    const frozen = parseFloat(wallet.frozenBalance);
    const total = avail + frozen;
    const etbValue = (total * parseFloat(ETB_RATE)).toFixed(2);
    res.json({
      userId: wallet.userId,
      asset: wallet.asset,
      availableBalance: wallet.availableBalance,
      frozenBalance: wallet.frozenBalance,
      totalBalance: total.toFixed(2),
      etbValue,
      etbRate: ETB_RATE,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get wallet");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/deposit-address", async (req, res) => {
  const network = req.query.network as string;
  if (!["TRC20", "ERC20"].includes(network)) {
    return res.status(400).json({ error: "Invalid network" });
  }
  const addresses: Record<string, string> = {
    TRC20: "TQnkMn8vANr6Qv9bK2X8sZ3wEpM7aFcYJ",
    ERC20: "0x742d35Cc6634C0532925a3b8D4C9f4E5b8A1234",
  };
  res.json({
    address: addresses[network],
    network,
    minDeposit: "1.00",
  });
});

router.post("/withdraw", async (req, res) => {
  try {
    const { address, network, amount } = req.body;
    if (!address || !network || !amount) return res.status(400).json({ error: "Invalid input" });
    if (!["TRC20", "ERC20"].includes(network)) return res.status(400).json({ error: "Invalid network" });

    const wallet = await getOrCreateWallet((req as any).userId);
    const avail = parseFloat(wallet.availableBalance);
    const amt = parseFloat(amount);
    if (amt > avail) return res.status(400).json({ error: "Insufficient balance" });

    const fee = (amt * 0.001).toFixed(2);
    const [tx] = await db.insert(transactionsTable).values({
      userId: (req as any).userId,
      type: "withdraw",
      amount,
      network,
      status: "pending",
      address,
      fee,
    }).returning();

    // Deduct balance
    await db.update(walletsTable)
      .set({ availableBalance: (avail - amt).toFixed(2) })
      .where(eq(walletsTable.id, wallet.id));

    res.json({
      id: tx.id,
      userId: tx.userId,
      type: tx.type,
      amount: tx.amount,
      network: tx.network ?? null,
      status: tx.status,
      txid: tx.txid ?? null,
      address: tx.address ?? null,
      fee: tx.fee ?? null,
      createdAt: tx.createdAt,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to withdraw");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
