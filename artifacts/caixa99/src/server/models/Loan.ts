import mongoose from "mongoose";
import { goalSchema } from "./goalSchema";
import { getModelWrapper } from "./dbWrapper";

const LoanModel = mongoose.models.Loan || mongoose.model("Loan", goalSchema, "emprestimos");
const Loan = getModelWrapper("Loan", LoanModel);

export default Loan as any;

