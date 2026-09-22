import { Router } from "express";
import { authenticateJWT } from "../../middleware/auth.middleware";
import { getPendingPaymentItemsHandler } from "../../controllers/student/transactions.controller";

const router = Router();

router.get("/payment-items/pending", authenticateJWT, getPendingPaymentItemsHandler);



export default router;
