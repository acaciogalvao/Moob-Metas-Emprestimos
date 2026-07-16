import express from "express";
import {
  getGoals,
  getGoalById,
  createGoal,
  updateGoal,
  deleteGoal,
  deletePayment,
  clearPaymentHistory,
} from "../controllers/goalController.ts";
import { requireAuth } from "../middleware/auth.ts";
import { listLimiter, writeLimiter, defaultLimiter } from "../middleware/rateLimiter.ts";
import {
  validateBody,
  validateParams,
  idRule,
  amountRule,
  payerRule,
} from "../middleware/validateRequest.ts";

const router = express.Router();

// Auth applied to all goal routes
router.use(requireAuth);

// GET /goals?page=1&limit=50
router.get("/", listLimiter, getGoals);

// GET /goals/:id
router.get(
  "/:id",
  defaultLimiter,
  validateParams({ id: idRule }),
  getGoalById
);

// POST /goals  — create a new goal or loan
router.post(
  "/",
  writeLimiter,
  validateBody({
    category: { required: true, type: "string", maxLength: 50 },
    itemName: { required: true, type: "string", minLength: 1, maxLength: 200 },
    totalValue: { required: true, type: "number", min: 0.01, max: 10_000_000 },
    type: {
      required: true,
      type: "string",
      custom: (v) =>
        v === "individual" || v === "shared"
          ? null
          : "type deve ser 'individual' ou 'shared'",
    },
  }),
  createGoal
);

// PUT /goals/:id  — update a goal
router.put(
  "/:id",
  writeLimiter,
  validateParams({ id: idRule }),
  updateGoal
);

// POST /goals/:id/clear-history
router.post(
  "/:id/clear-history",
  writeLimiter,
  validateParams({ id: idRule }),
  clearPaymentHistory
);

// DELETE /goals/:id/payment/:paymentId
router.delete(
  "/:id/payment/:paymentId",
  writeLimiter,
  validateParams({
    id: idRule,
    paymentId: { required: true, type: "string", maxLength: 128 },
  }),
  deletePayment
);

// DELETE /goals/:id
router.delete(
  "/:id",
  writeLimiter,
  validateParams({ id: idRule }),
  deleteGoal
);

export default router;
