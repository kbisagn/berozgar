import mongoose, { Schema, Document, Model } from "mongoose";

export type Capability = "cooking" | "cleaning" | "laundry" | "grocery runs" | "trash";

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  capabilities: Capability[];
  flatId?: mongoose.Types.ObjectId;
  role: "admin" | "member";
  points: number;
  tier: string;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    password: { type: String },
    capabilities: [{ type: String, enum: ["cooking", "cleaning", "laundry", "grocery runs", "trash"] }],
    flatId: { type: Schema.Types.ObjectId, ref: "Flat", default: null },
    role: { type: String, enum: ["admin", "member"], default: "member" },
    points: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

UserSchema.virtual("tier").get(function (this: IUser) {
  if (this.points >= 100) return "Flat Hero";
  if (this.points >= 50) return "Decent Human";
  if (this.points >= 0) return "Trying Their Best";
  return "The Menace";
});

const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
export default User;
