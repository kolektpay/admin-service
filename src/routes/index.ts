import { Router } from "express";

import { config } from "../config/app";
import authRouter from "./auth/auth.routes";
import adminGuardianRouter from "./guardian.routes/guardian.routes";
import roleRouter from "./role/role.routes";
import adminStudentRouter from "./student/student.routes";
import transactionsRouter from "./transactions/transactions.routes";
import adminRouter from "./user.routes";
import walletRouter from "./wallet/wallet.routes";

const router = Router();

// API routes
router.use("/admin/auth", authRouter);
router.use("/admin", adminRouter);
router.use("/admin", roleRouter);

router.use("/admin/students", adminStudentRouter);
router.use("/admin/guardians", adminGuardianRouter);

router.use("/admin/wallet", walletRouter);
router.use("/admin/transactions", transactionsRouter);

// Health check
router.get("/health", (req, res) => {
  console.log(req.body);
  res.json({
    success: true,
    message: "Server is running.",
    timestamp: new Date().toISOString(),
  });
});

router.get("/debug/telegram-exception", (_req, res, next) => {
  if (config.nodeEnv === "production") {
    res.status(404).json({
      success: false,
      message: "Not found.",
    });
    return;
  }

  const error = new Error("Simulated exception for Telegram logging test");
  next(error);
});

export default router;
