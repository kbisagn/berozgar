import mongoose, { Schema, Document, Model } from "mongoose";

export interface IBillSplit {
  userId: mongoose.Types.ObjectId;
  amount: number;
  paid: boolean;
}

export interface IBill extends Document {
  description: string;
  amount: number;
  category: string;
  paidBy: mongoose.Types.ObjectId;
  flatId: mongoose.Types.ObjectId;
  splitType: "equal" | "custom";
  splits: IBillSplit[];
  dueDate?: Date;
  createdAt: Date;
}

const BillSchema = new Schema<IBill>(
  {
    description: { type: String, required: true },
    amount: { type: Number, required: true },
    category: { type: String, required: true },
    paidBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    flatId: { type: Schema.Types.ObjectId, ref: "Flat", required: true, index: true },
    splitType: { type: String, enum: ["equal", "custom"], default: "equal" },
    splits: [
      {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        amount: { type: Number, required: true },
        paid: { type: Boolean, default: false },
      },
    ],
    dueDate: { type: Date },
  },
  {
    timestamps: true,
  }
);

const Bill: Model<IBill> = mongoose.models.Bill || mongoose.model<IBill>("Bill", BillSchema);
export default Bill;
