import express from "express";
import {
  getGoals,
  getGoalById,
  createGoal,
  updateGoal,
  deleteGoal,
  deletePayment,
  clearPaymentHistory,
} from "../controllers/goalController";

const router = express.Router();

router.get("/", getGoals);
router.get("/:id", getGoalById);
router.post("/", createGoal);
router.put("/:id", updateGoal);
router.post("/:id/clear-history", clearPaymentHistory);
router.delete("/:id/payment/:paymentId", deletePayment);
router.delete("/:id", deleteGoal);

export default router;
