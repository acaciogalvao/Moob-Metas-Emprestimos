import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  paymentId: String,
  amount: Number,
  method: String,
  payerId: String,
  date: { type: Date, default: Date.now },
});

export const goalSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    type: { type: String, default: "shared" },
    category: { type: String, default: "other" },
    interestRate: { type: Number, default: 0 },
    itemName: String,
    totalValue: Number,
    months: Number,
    durationUnit: { type: String, default: "months" },
    deadlineType: { type: String, default: "duration" },
    endDate: String,
    contributionP1: Number,
    nameP1: String,
    nameP2: String,
    phoneP1: String,
    phoneP2: String,
    pixKeyP1: String,
    pixKeyP2: String,
    frequencyP1: { type: String, default: "monthly" },
    frequencyP2: { type: String, default: "monthly" },
    dueDayP1: { type: Number, default: 5 },
    dueDayP2: { type: Number, default: 5 },
    savedP1: { type: Number, default: 0 },
    savedP2: { type: Number, default: 0 },
    startDate: String,
    excludeSundays: { type: Boolean, default: false },
    remindersEnabled: { type: Boolean, default: false },
    applyLateFees: { type: Boolean, default: false },
    payments: [paymentSchema],
  },
  { timestamps: true },
);
