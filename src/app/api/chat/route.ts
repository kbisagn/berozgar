import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import ChatMessage from "@/models/ChatMessage";
import User from "@/models/User";
import { triggerPusherEvent } from "@/lib/pusher";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !(session.user as any).flatId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const flatId = (session.user as any).flatId;

    // ----------------------------------------------------
    // AUTO-DELETE LOGIC (24-Hour window)
    // ----------------------------------------------------
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
    // Delete expired messages from this flat
    await ChatMessage.deleteMany({ flatId, createdAt: { $lt: cutoffTime } });

    // Fetch remaining messages
    const messages = await ChatMessage.find({ flatId })
      .populate("senderId", "name role")
      .sort({ createdAt: 1 });

    return NextResponse.json({ messages });
  } catch (error: any) {
    console.error("Chat fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !(session.user as any).flatId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { content, isAnnouncement } = await req.json();

    if (!content) {
      return NextResponse.json({ error: "Message content is required" }, { status: 400 });
    }

    await connectToDatabase();

    const flatId = (session.user as any).flatId;
    const senderId = (session.user as any).id;

    // Announcements can only be created by admin users
    const isAnn = !!isAnnouncement;
    if (isAnn && (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "Only admins can post announcements." }, { status: 403 });
    }

    // Create Chat Message
    const newMessage = await ChatMessage.create({
      content,
      senderId,
      flatId,
      isAnnouncement: isAnn,
      pinned: isAnn, // announcements are pinned by default
    });

    const populatedMessage = await ChatMessage.findById(newMessage._id)
      .populate("senderId", "name role");

    // Real-time broadcast
    await triggerPusherEvent(`flat-${flatId}`, "chat-message", populatedMessage);

    return NextResponse.json({ message: "Message sent", chatMessage: populatedMessage }, { status: 201 });
  } catch (error: any) {
    console.error("Chat send error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
