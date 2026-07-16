import { createGoalModel } from "./goalSchema.ts";
import { getModelWrapper } from "./dbWrapper.ts";

// Empréstimos entre parceiros — coleção "emprestimos"
const LoanModel = createGoalModel("Loan", "emprestimos");

export default getModelWrapper("Loan", LoanModel) as any;
