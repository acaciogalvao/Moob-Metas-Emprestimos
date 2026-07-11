import mongoose from "mongoose";
import { goalSchema } from "./goalSchema";
import { getModelWrapper } from "./dbWrapper";

const SavingModel = mongoose.models.Saving || mongoose.model("Saving", goalSchema, "metas");
const Saving = getModelWrapper("Saving", SavingModel);

export default Saving as any;

