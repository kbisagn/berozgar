import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import ChatMessage from "@/models/ChatMessage";
import { triggerPusherEvent } from "@/lib/pusher";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !(session.user as any).flatId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { messageId, pin } = await req.json();

    if (!messageId) {
      return NextResponse.json({ error: "Message ID is required" }, { status: 400 });
    }

    await connectToDatabase();

    const flatId = (session.user as any).flatId;

    const message = await ChatMessage.findOne({ _id: messageId, flatId });

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    message.pinned = !!pin;
    await message.save();

    await triggerPusherEvent(`flat-${flatId}`, "chat-message-pinned", {
      messageId: message._id,
      pinned: message.pinned,
    });

    return NextResponse.json({ message: "Message pin status updated", chatMessage: message });
  } catch (error: any) {
    console.error("Message pin error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
