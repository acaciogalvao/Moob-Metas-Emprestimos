import mongoose from "mongoose";
import { goalSchema } from "./goalSchema.ts";
import { getModelWrapper } from "./dbWrapper.ts";

const LoanModel = mongoose.models.Loan || mongoose.model("Loan", goalSchema, "emprestimos");
const Loan = getModelWrapper("Loan", LoanModel);

export default Loan as any;

