import mongoose, { Schema, Document, Model } from "mongoose";

export interface IGroceryItem extends Document {
  name: string;
  addedBy: mongoose.Types.ObjectId;
  flatId: mongoose.Types.ObjectId;
  status: "needed" | "picked_up";
  pickedUpBy?: mongoose.Types.ObjectId;
}

const GroceryItemSchema = new Schema<IGroceryItem>(
  {
    name: { type: String, required: true },
    addedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    flatId: { type: Schema.Types.ObjectId, ref: "Flat", required: true, index: true },
    status: { type: String, enum: ["needed", "picked_up"], default: "needed" },
    pickedUpBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true,
  }
);

const GroceryItem: Model<IGroceryItem> = mongoose.models.GroceryItem || mongoose.model<IGroceryItem>("GroceryItem", GroceryItemSchema);
export default GroceryItem;
