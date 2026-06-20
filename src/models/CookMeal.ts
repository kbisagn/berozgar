import mongoose, { Schema, Document, Model } from "mongoose";

export interface IMealRSVP {
  userId: mongoose.Types.ObjectId;
  status: "eating" | "skipping";
}

export interface ICookMeal extends Document {
  cookId: mongoose.Types.ObjectId;
  flatId: mongoose.Types.ObjectId;
  date: string; // YYYY-MM-DD
  mealDescription: string;
  portionCount: number;
  status: "active" | "cancelled" | "completed";
  rsvps: IMealRSVP[];
}

const CookMealSchema = new Schema<ICookMeal>(
  {
    cookId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    flatId: { type: Schema.Types.ObjectId, ref: "Flat", required: true, index: true },
    date: { type: String, required: true }, // Format YYYY-MM-DD
    mealDescription: { type: String, required: true },
    portionCount: { type: Number, default: 0 },
    status: { type: String, enum: ["active", "cancelled", "completed"], default: "active" },
    rsvps: [
      {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        status: { type: String, enum: ["eating", "skipping"], required: true },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Indexes date + flatId for quick retrieval
CookMealSchema.index({ flatId: 1, date: 1 }, { unique: true });

const CookMeal: Model<ICookMeal> = mongoose.models.CookMeal || mongoose.model<ICookMeal>("CookMeal", CookMealSchema);
export default CookMeal;
