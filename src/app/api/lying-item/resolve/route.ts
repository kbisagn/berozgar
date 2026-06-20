import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import LyingItem from "@/models/LyingItem";
import { triggerPusherEvent } from "@/lib/pusher";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !(session.user as any).flatId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { itemId } = await req.json();

    if (!itemId) {
      return NextResponse.json({ error: "Missing item ID" }, { status: 400 });
    }

    await connectToDatabase();

    const flatId = (session.user as any).flatId;

    const item = await LyingItem.findOne({ _id: itemId, flatId });

    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    item.resolved = true;
    item.resolvedAt = new Date();
    await item.save();

    await triggerPusherEvent(`flat-${flatId}`, "lying-item-resolved", { itemId });

    return NextResponse.json({ message: "Item resolved successfully", item });
  } catch (error: any) {
    console.error("Lying item resolve error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
