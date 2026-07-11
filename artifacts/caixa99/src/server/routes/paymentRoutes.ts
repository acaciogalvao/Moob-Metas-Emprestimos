import express from "express";
import {
  generateStaticPix,
  createPixPayment,
  checkPayment,
  manualPay,
  verifyReceipt,
} from "../controllers/paymentController";

const router = express.Router();

router.post("/generate-static-pix", generateStaticPix);
router.post("/create-pix-payment", createPixPayment);
router.get("/check-payment/:paymentId", checkPayment);
router.post("/manual-pay", manualPay);
router.post("/verify-receipt", verifyReceipt);

export default router;
