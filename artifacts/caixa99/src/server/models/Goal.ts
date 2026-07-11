import mongoose from "mongoose";
import { goalSchema } from "./goalSchema";
import { getModelWrapper } from "./dbWrapper";

// Coleção legada "goals" — usada apenas para migração dos dados existentes
const GoalModel = mongoose.models.Goal || mongoose.model("Goal", goalSchema, "goals");
const Goal = getModelWrapper("Goal", GoalModel);

export default Goal as any;

