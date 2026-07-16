import mongoose from "mongoose";
import { getModelWrapper } from "./dbWrapper.ts";

// ─── Sub-schema: Transaction ──────────────────────────────────────

const transactionSchema = new mongoose.Schema(
  {
    id:               { type: String, required: true },
    timestamp:        { type: String, required: true },
    type:             { type: String, enum: ["IN", "OUT"], required: true },
    platform:         { type: String, required: true },
    category:         { type: String, required: true },
    value:            { type: Number, required: true },
    description:      String,
    paymentMethod:    { type: String, required: true },
    // Trip / ride details
    km:               Number,
    passengerValue:   Number, // legacy — keep for compatibility
    appOfferValue:    Number,
    passengerAppValue: Number,
    tipValue:         Number,
    extraChargedValue: Number,
    keypadValue:      Number,
    extraPaymentMethod: String,
    isVirtual:        Boolean,
    withdrawalFee:    Number,
    // Fuel details
    liters:           Number,
    pricePerLiter:    Number,
    odometer:         Number,
  },
  { _id: false } // transactions use their own string `id`, not Mongo ObjectId
);

// ─── Sub-schema: Fuel state ───────────────────────────────────────

const fuelSchema = new mongoose.Schema(
  {
    initialLiters: Number,
    initialLevel:  String, // "Cheio" | "Meio" | "Reserva" | "Custom"
    finalLiters:   Number,
    finalLevel:    String,
    totalFueled:   Number,
  },
  { _id: false }
);

// ─── Sub-schema: Closing info ─────────────────────────────────────

const closingSchema = new mongoose.Schema(
  {
    balanceExpected: { type: Number, required: true },
    balanceReal:     Number,
    difference:      Number,
    pixReal:         Number,
    differencePix:   Number,
    notes:           String,
    closedAt:        { type: String, default: null },
  },
  { _id: false }
);

// ─── Main schema: Shift ───────────────────────────────────────────

const shiftSchema = new mongoose.Schema(
  {
    id:            { type: String, required: true, unique: true, index: true },
    openedAt:      { type: String, required: true },
    closedAt:      { type: String, default: null },   // kept flat for API compat
    status:        { type: String, enum: ["OPEN", "CLOSED"], required: true },
    transactions:  { type: [transactionSchema], default: [] },

    // Initial balances
    initialBalance:      { type: Number, required: true },
    initialPixBalance:   { type: Number, default: 0 },
    initialCashBalance:  { type: Number, default: 0 },
    initialUberBalance:  { type: Number, default: 0 },
    initial99Balance:    { type: Number, default: 0 },

    // Closing figures (flat, for API/frontend compatibility)
    closingBalanceExpected: { type: Number, required: true },
    closingBalanceReal:     Number,
    difference:             Number,
    closingPixReal:         Number,
    differencePix:          Number,
    notes:                  String,

    // Odometer
    initialOdometer: Number,
    finalOdometer:   Number,

    // Fuel
    totalLitersFueled: Number,
    initialFuelLiters: Number,
    initialFuelLevel:  String,
    finalFuelLiters:   Number,
    finalFuelLevel:    String,

    // Driver goals for the shift
    monthlyGoal:  Number,
    dailyKmGoal:  Number,

    // Balance carry-over
    ajusteSaldoAnterior: Number,
    saldoAnterior:       Number,
  },
  { timestamps: true }
);

// ─── Virtuals ─────────────────────────────────────────────────────

shiftSchema.virtual("isOpen").get(function () {
  return this.status === "OPEN";
});

shiftSchema.virtual("totalIn").get(function () {
  return (this.transactions ?? [])
    .filter((t: any) => t.type === "IN" && !t.isVirtual)
    .reduce((sum: number, t: any) => sum + (t.value ?? 0), 0);
});

shiftSchema.virtual("totalOut").get(function () {
  return (this.transactions ?? [])
    .filter((t: any) => t.type === "OUT")
    .reduce((sum: number, t: any) => sum + (t.value ?? 0), 0);
});

shiftSchema.virtual("netBalance").get(function () {
  const txs: any[] = this.transactions ?? [];
  const inn = txs.filter((t) => t.type === "IN" && !t.isVirtual).reduce((s, t) => s + (t.value ?? 0), 0);
  const out = txs.filter((t) => t.type === "OUT").reduce((s, t) => s + (t.value ?? 0), 0);
  return inn - out;
});

shiftSchema.virtual("kmRodados").get(function () {
  const fi = (this as any).finalOdometer ?? 0;
  const io = (this as any).initialOdometer ?? 0;
  return fi > io ? fi - io : 0;
});

shiftSchema.virtual("fuelConsumed").get(function () {
  const init  = (this as any).initialFuelLiters ?? 0;
  const added = (this as any).totalLitersFueled ?? 0;
  const final = (this as any).finalFuelLiters ?? 0;
  const consumed = init + added - final;
  return consumed > 0 ? consumed : 0;
});

// ─── Model ────────────────────────────────────────────────────────

const ShiftModel =
  mongoose.models.Shift ?? mongoose.model("Shift", shiftSchema, "shifts");

export { transactionSchema, fuelSchema, closingSchema, shiftSchema };
export default getModelWrapper("Shift", ShiftModel) as any;
