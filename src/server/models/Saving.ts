import mongoose from "mongoose";
import { goalSchema } from "./goalSchemas.ts";
import { getModelWrapper } from "./dbWrapper.ts";

const SavingModel = mongoose.models.Saving || mongoose.model("Saving", goalSchema, "metas");
const Saving = getModelWrapper("Saving", SavingModel);

export default Saving as any;

