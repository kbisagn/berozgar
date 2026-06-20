import mongoose, { Schema, Document, Model } from "mongoose";
import { Capability } from "./User";

export interface IChallengeVote {
  userId: mongoose.Types.ObjectId;
  vote: "agree" | "disagree"; // agree = chore is indeed done, disagree = challenge is valid, chore was not done
}

export interface IChore extends Document {
  title: string;
  description?: string;
  skill: Capability;
  assignedTo: mongoose.Types.ObjectId;
  flatId: mongoose.Types.ObjectId;
  status: "pending" | "completed" | "challenged";
  verifiedBy?: mongoose.Types.ObjectId;
  challengedBy?: mongoose.Types.ObjectId;
  challengeVotes: IChallengeVote[];
  challengeEndsAt?: Date;
  dueDate: Date;
  completedAt?: Date;
  escalated: boolean;
  swapRequestedWith?: mongoose.Types.ObjectId; // User ID for swap request
  swapStatus?: "none" | "pending" | "accepted" | "rejected";
}

const ChoreSchema = new Schema<IChore>(
  {
    title: { type: String, required: true },
    description: { type: String },
    skill: { type: String, enum: ["cooking", "cleaning", "laundry", "grocery runs", "trash"], required: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", required: true },
    flatId: { type: Schema.Types.ObjectId, ref: "Flat", required: true, index: true },
    status: { type: String, enum: ["pending", "completed", "challenged"], default: "pending" },
    verifiedBy: { type: Schema.Types.ObjectId, ref: "User" },
    challengedBy: { type: Schema.Types.ObjectId, ref: "User" },
    challengeVotes: [
      {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        vote: { type: String, enum: ["agree", "disagree"], required: true },
      },
    ],
    challengeEndsAt: { type: Date },
    dueDate: { type: Date, required: true },
    completedAt: { type: Date },
    escalated: { type: Boolean, default: false },
    swapRequestedWith: { type: Schema.Types.ObjectId, ref: "User" },
    swapStatus: { type: String, enum: ["none", "pending", "accepted", "rejected"], default: "none" },
  },
  {
    timestamps: true,
  }
);

const Chore: Model<IChore> = mongoose.models.Chore || mongoose.model<IChore>("Chore", ChoreSchema);
export default Chore;
