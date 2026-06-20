import mongoose, { Schema, Document, Model } from "mongoose";

export interface IFlat extends Document {
  name: string;
  inviteCode: string;
  inviteActive: boolean;
  rules: string[];
  adminId: mongoose.Types.ObjectId;
}

const FlatSchema = new Schema<IFlat>(
  {
    name: { type: String, required: true },
    inviteCode: { type: String, required: true, unique: true, index: true },
    inviteActive: { type: Boolean, default: true },
    rules: { type: [String], default: [] },
    adminId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  {
    timestamps: true,
  }
);

const Flat: Model<IFlat> = mongoose.models.Flat || mongoose.model<IFlat>("Flat", FlatSchema);
export default Flat;
