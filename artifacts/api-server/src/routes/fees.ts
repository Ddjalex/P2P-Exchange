import { Router } from "express";
import { getFeePercents } from "../helpers/fees.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const { makerFeePercent, takerFeePercent, withdrawalFeeTRC20, withdrawalFeeERC20 } = await getFeePercents();
    return res.json({
      makerFeePercent,
      takerFeePercent,
      totalTradingFeePercent: parseFloat((makerFeePercent + takerFeePercent).toFixed(4)),
      withdrawalFeeTRC20,
      withdrawalFeeERC20,
    });
  } catch {
    return res.json({
      makerFeePercent: 0.20,
      takerFeePercent: 0.10,
      totalTradingFeePercent: 0.30,
      withdrawalFeeTRC20: 1.00,
      withdrawalFeeERC20: 5.00,
    });
  }
});

export default router;
