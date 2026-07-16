import express from "express";
import {
  generateStaticPix,
  createPixPayment,
  checkPayment,
  manualPay,
  verifyReceipt,
} from "../controllers/paymentController.ts";
import { requireAuth } from "../middleware/auth.ts";
import { paymentLimiter, aiLimiter, defaultLimiter } from "../middleware/rateLimiter.ts";
import {
  validateBody,
  validateParams,
  amountRule,
  payerRule,
  idRule,
} from "../middleware/validateRequest.ts";

const router = express.Router();

// Auth applied to all payment routes
router.use(requireAuth);

// POST /generate-static-pix
router.post(
  "/generate-static-pix",
  paymentLimiter,
  validateBody({
    pixKey: { required: true, type: "string", minLength: 1, maxLength: 200 },
    amount: { type: "number", min: 0 },
    merchantName: { type: "string", maxLength: 100 },
  }),
  generateStaticPix
);

// POST /create-pix-payment
router.post(
  "/create-pix-payment",
  paymentLimiter,
  validateBody({
    amount: amountRule,
    goalId: { required: true, type: "string", maxLength: 128 },
    payerId: payerRule,
  }),
  createPixPayment
);

// GET /check-payment/:paymentId
router.get(
  "/check-payment/:paymentId",
  defaultLimiter,
  validateParams({
    paymentId: { required: true, type: "string", maxLength: 128 },
  }),
  checkPayment
);

// POST /manual-pay
router.post(
  "/manual-pay",
  paymentLimiter,
  validateBody({
    amount: amountRule,
    goalId: { required: true, type: "string", maxLength: 128 },
    payerId: payerRule,
    method: {
      required: true,
      type: "string",
      custom: (v) =>
        ["pix", "dinheiro", "PIX", "DINHEIRO"].includes(v as string)
          ? null
          : "method deve ser 'pix' ou 'dinheiro'",
    },
  }),
  manualPay
);

// POST /verify-receipt  — AI-powered, strict limit
router.post(
  "/verify-receipt",
  aiLimiter,
  validateBody({
    imageBase64: {
      required: true,
      type: "string",
      minLength: 10,
      maxLength: 10_000_000, // ~7.5 MB base64
    },
    expectedAmount: { required: true, type: "number", min: 0.01 },
    expectedPayer: { type: "string", maxLength: 200 },
  }),
  verifyReceipt
);

export default router;
