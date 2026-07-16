import mongoose from "mongoose";

// ─── Sub-schema: Payment ──────────────────────────────────────────

export const paymentSchema = new mongoose.Schema(
  {
    _id:       { type: String, required: true },
    paymentId: String,                              // legacy alias
    amount:    { type: Number, default: 0 },
    method:    { type: String, default: "pix" },
    payerId:   { type: String, enum: ["P1", "P2"] },
    date:      { type: Date, default: Date.now },
  },
  { _id: false }
);

// ─── Main schema: Goal / Saving / Loan ───────────────────────────

export const goalSchema = new mongoose.Schema(
  {
    _id:          { type: String, required: true },
    type:         { type: String, enum: ["individual", "shared"], default: "shared" },
    category:     { type: String, default: "other" },
    interestRate: { type: Number, default: 0, min: 0 },
    itemName:     { type: String, default: "" },
    totalValue:   { type: Number, default: 0, min: 0 },

    // Duration
    months:       Number,
    durationUnit: { type: String, enum: ["days", "weeks", "months"], default: "months" },
    deadlineType: { type: String, enum: ["duration", "dates"], default: "duration" },
    startDate:    String,
    endDate:      String,
    excludeSundays: { type: Boolean, default: false },

    // Participants
    contributionP1: { type: Number, default: 0 },
    nameP1:  String,
    nameP2:  String,
    phoneP1: String,
    phoneP2: String,
    pixKeyP1: String,
    pixKeyP2: String,

    // Payment schedule
    frequencyP1: { type: String, enum: ["daily", "weekly", "monthly"], default: "monthly" },
    frequencyP2: { type: String, enum: ["daily", "weekly", "monthly"], default: "monthly" },
    dueDayP1:    { type: Number, default: 5, min: 1, max: 31 },
    dueDayP2:    { type: Number, default: 5, min: 1, max: 31 },

    // Running totals — recalculated from `payments` on every save
    savedP1: { type: Number, default: 0, min: 0 },
    savedP2: { type: Number, default: 0, min: 0 },

    payments: { type: [paymentSchema], default: [] },

    remindersEnabled: { type: Boolean, default: false },
    applyLateFees:    { type: Boolean, default: false },
  },
  { timestamps: true }
);

// ─── Virtuals ─────────────────────────────────────────────────────

goalSchema.virtual("totalSaved").get(function () {
  return (this.savedP1 ?? 0) + (this.savedP2 ?? 0);
});

goalSchema.virtual("remaining").get(function () {
  return Math.max(0, (this.totalValue ?? 0) - (this.savedP1 ?? 0) - (this.savedP2 ?? 0));
});

goalSchema.virtual("progressPercent").get(function () {
  const total = this.totalValue ?? 0;
  if (!total) return 0;
  return Math.min(100, (((this.savedP1 ?? 0) + (this.savedP2 ?? 0)) / total) * 100);
});

goalSchema.virtual("isComplete").get(function () {
  const total = this.totalValue ?? 0;
  return total > 0 && (this.savedP1 ?? 0) + (this.savedP2 ?? 0) >= total;
});

// ─── Methods ──────────────────────────────────────────────────────

/**
 * Recalculates savedP1 and savedP2 from the payments array.
 * Call before save() whenever the payments array is modified.
 * Returns `this` for chaining.
 */
goalSchema.methods.recalcSaved = function (): typeof this {
  let p1 = 0;
  let p2 = 0;
  for (const p of this.payments ?? []) {
    if (p.payerId === "P1") p1 += p.amount ?? 0;
    if (p.payerId === "P2") p2 += p.amount ?? 0;
  }
  this.savedP1 = p1;
  this.savedP2 = p2;
  return this;
};

// ─── Factory ──────────────────────────────────────────────────────

/**
 * Creates (or retrieves) a Mongoose model built on `goalSchema`.
 * Pass `conn` to register the model on a specific connection
 * (e.g. the dedicated meta connection).
 */
export function createGoalModel(
  modelName: "Saving" | "Loan" | "Goal",
  collectionName: string,
  conn?: mongoose.Connection
): mongoose.Model<any> {
  const registry = (conn as any) ?? mongoose;
  if (registry.models[modelName]) return registry.models[modelName];
  return conn
    ? conn.model(modelName, goalSchema, collectionName)
    : mongoose.model(modelName, goalSchema, collectionName);
}
