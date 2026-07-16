import { createGoalModel } from "./goalSchema.ts";
import { getModelWrapper } from "./dbWrapper.ts";

// Metas de poupança compartilhada — coleção "metas"
const SavingModel = createGoalModel("Saving", "metas");

export default getModelWrapper("Saving", SavingModel) as any;
