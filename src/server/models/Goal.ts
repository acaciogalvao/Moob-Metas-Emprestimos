import { createGoalModel } from "./goalSchema.ts";
import { getModelWrapper } from "./dbWrapper.ts";

// Coleção legada "goals" — mantida apenas para migração de dados existentes
const GoalModel = createGoalModel("Goal", "goals");

export default getModelWrapper("Goal", GoalModel) as any;
