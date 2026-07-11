import mongoose from "mongoose";
import { getModelWrapper } from "./dbWrapper";

const transactionSchema = new mongoose.Schema({
  id: { type: String, required: true },
  timestamp: { type: String, required: true },
  type: { type: String, enum: ["IN", "OUT"], required: true },
  platform: { type: String, required: true },
  category: { type: String, required: true },
  value: { type: Number, required: true },
  description: String,
  paymentMethod: { type: String, required: true },
  km: Number,
  passengerValue: Number,
  appOfferValue: Number,
  passengerAppValue: Number,
  extraChargedValue: Number,
  keypadValue: Number,
  extraPaymentMethod: String,
  isVirtual: Boolean,
  withdrawalFee: Number,
  liters: Number,
  pricePerLiter: Number,
  odometer: Number,
});

const shiftSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    openedAt: { type: String, required: true },
    closedAt: { type: String, default: null },
    initialBalance: { type: Number, required: true },
    initialPixBalance: { type: Number, default: 0 },
    initialCashBalance: { type: Number, default: 0 },
    initialUberBalance: { type: Number, default: 0 },
    initial99Balance: { type: Number, default: 0 },
    status: { type: String, enum: ["OPEN", "CLOSED"], required: true },
    transactions: [transactionSchema],
    closingBalanceExpected: { type: Number, required: true },
    closingBalanceReal: Number,
    difference: Number,
    closingPixReal: Number,
    differencePix: Number,
    notes: String,
    initialOdometer: Number,
    finalOdometer: Number,
    totalLitersFueled: Number,
    initialFuelLiters: Number,
    initialFuelLevel: String,
    ajusteSaldoAnterior: Number,
    saldoAnterior: Number,
  },
  { timestamps: true }
);

const ShiftModel = mongoose.models.Shift || mongoose.model("Shift", shiftSchema, "shifts");
const Shift = getModelWrapper("Shift", ShiftModel);

export default Shift as any;
