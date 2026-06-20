import mongoose, { Schema, Document, Model } from "mongoose";

export interface ILyingItem extends Document {
  description: string;
  responsiblePerson: mongoose.Types.ObjectId;
  loggedBy: mongoose.Types.ObjectId;
  flatId: mongoose.Types.ObjectId;
  resolved: boolean;
  resolvedAt?: Date;
  escalated: boolean;
  createdAt: Date;
}

const LyingItemSchema = new Schema<ILyingItem>(
  {
    description: { type: String, required: true },
    responsiblePerson: { type: Schema.Types.ObjectId, ref: "User", required: true },
    loggedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    flatId: { type: Schema.Types.ObjectId, ref: "Flat", required: true, index: true },
    resolved: { type: Boolean, default: false },
    resolvedAt: { type: Date },
    escalated: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

const LyingItem: Model<ILyingItem> = mongoose.models.LyingItem || mongoose.model<ILyingItem>("LyingItem", LyingItemSchema);
export default LyingItem;
