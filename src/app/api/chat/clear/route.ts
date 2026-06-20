import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import ChatMessage from "@/models/ChatMessage";
import Flat from "@/models/Flat";
import { triggerPusherEvent } from "@/lib/pusher";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !(session.user as any).flatId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const flatId = (session.user as any).flatId;
    const userId = (session.user as any).id;

    const flat = await Flat.findById(flatId);
    if (!flat) {
      return NextResponse.json({ error: "Flat not found" }, { status: 404 });
    }

    // Only flat admin can clear chat
    if (flat.adminId.toString() !== userId) {
      return NextResponse.json({ error: "Only the flat admin can clear chat history." }, { status: 403 });
    }

    // Clear all messages in this flat
    await ChatMessage.deleteMany({ flatId });

    await triggerPusherEvent(`flat-${flatId}`, "chat-cleared", {});

    return NextResponse.json({ message: "Chat cleared successfully." });
  } catch (error: any) {
    console.error("Chat clear error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
