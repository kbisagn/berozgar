import mongoose, { Schema, Document, Model } from "mongoose";

export interface IStoreTrip extends Document {
  userId: mongoose.Types.ObjectId;
  flatId: mongoose.Types.ObjectId;
  active: boolean;
  createdAt: Date;
}

const StoreTripSchema = new Schema<IStoreTrip>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    flatId: { type: Schema.Types.ObjectId, ref: "Flat", required: true, index: true },
    active: { type: Boolean, default: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: true },
  }
);

const StoreTrip: Model<IStoreTrip> = mongoose.models.StoreTrip || mongoose.model<IStoreTrip>("StoreTrip", StoreTripSchema);
export default StoreTrip;
