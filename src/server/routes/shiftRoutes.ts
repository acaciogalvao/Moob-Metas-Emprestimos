import express from "express";
import {
  getShifts,
  upsertShift,
  syncShifts,
  deleteShift,
} from "../controllers/shiftController.ts";
import { requireAuth } from "../middleware/auth.ts";
import { defaultLimiter, listLimiter, writeLimiter } from "../middleware/rateLimiter.ts";
import {
  validateBody,
  validateParams,
  idRule,
} from "../middleware/validateRequest.ts";

const router = express.Router();

// Auth applied to all shift routes
router.use(requireAuth);

// GET /shifts?page=1&limit=50
router.get("/", listLimiter, getShifts);

// POST /shifts  — upsert a single shift
router.post(
  "/",
  writeLimiter,
  validateBody({
    id: idRule,
    status: {
      type: "string",
      custom: (v) =>
        v === "OPEN" || v === "CLOSED"
          ? null
          : "status deve ser 'OPEN' ou 'CLOSED'",
    },
    openedAt: { required: true, type: "string" },
    initialBalance: { required: true, type: "number", min: 0 },
    transactions: { type: "array" },
  }),
  upsertShift
);

// POST /shifts/sync  — bulk offline sync
router.post(
  "/sync",
  defaultLimiter,
  validateBody({
    shifts: { required: true, type: "array", maxLength: 500 },
  }),
  syncShifts
);

// DELETE /shifts/:id
router.delete(
  "/:id",
  writeLimiter,
  validateParams({ id: idRule }),
  deleteShift
);

export default router;
