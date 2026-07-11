import express from "express";
import {
  getShifts,
  upsertShift,
  syncShifts,
  deleteShift,
} from "../controllers/shiftController.ts";

const router = express.Router();

router.get("/", getShifts);
router.post("/", upsertShift);
router.post("/sync", syncShifts);
router.delete("/:id", deleteShift);

export default router;
