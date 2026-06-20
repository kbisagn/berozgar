import mongoose, { Schema, Document, Model } from "mongoose";

export interface IChatMessage extends Document {
  content: string;
  senderId: mongoose.Types.ObjectId;
  flatId: mongoose.Types.ObjectId;
  isAnnouncement: boolean;
  pinned: boolean;
  createdAt: Date;
}

const ChatMessageSchema = new Schema<IChatMessage>(
  {
    content: { type: String, required: true },
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    flatId: { type: Schema.Types.ObjectId, ref: "Flat", required: true, index: true },
    isAnnouncement: { type: Boolean, default: false },
    pinned: { type: Boolean, default: false },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // only track when it was sent
  }
);

// Index to automatically support clean queries
ChatMessageSchema.index({ flatId: 1, createdAt: 1 });

const ChatMessage: Model<IChatMessage> = mongoose.models.ChatMessage || mongoose.model<IChatMessage>("ChatMessage", ChatMessageSchema);
export default ChatMessage;
