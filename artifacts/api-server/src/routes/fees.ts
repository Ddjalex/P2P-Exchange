import { Router } from "express";
import { getFeePercents } from "../helpers/fees.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const { makerFeePercent, takerFeePercent, withdrawalFeeBEP20 } = await getFeePercents();
    return res.json({
      makerFeePercent,
      takerFeePercent,
      totalTradingFeePercent: parseFloat((makerFeePercent + takerFeePercent).toFixed(4)),
      withdrawalFeeBEP20,
    });
  } catch {
    return res.json({
      makerFeePercent: 0.20,
      takerFeePercent: 0.10,
      totalTradingFeePercent: 0.30,
      withdrawalFeeBEP20: 1.00,
    });
  }
});

export default router;
