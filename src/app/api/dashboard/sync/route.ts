import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import Flat from "@/models/Flat";
import User from "@/models/User";
import LyingItem from "@/models/LyingItem";
import StoreTrip from "@/models/StoreTrip";
import ChatMessage from "@/models/ChatMessage";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !(session.user as any).flatId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const flatId = (session.user as any).flatId;

    // 1. Get Flat details
    const flat = await Flat.findById(flatId);
    if (!flat) {
      return NextResponse.json({ error: "Flat not found" }, { status: 404 });
    }

    // 2. Get Flatmates (for leaderboard)
    const flatmates = await User.find({ flatId }).select("name email points capabilities role").sort({ points: -1 });

    // 3. Get Open Lying Items
    const openLyingItems = await LyingItem.find({ flatId, resolved: false })
      .populate("responsiblePerson", "name")
      .populate("loggedBy", "name")
      .sort({ createdAt: -1 });

    // 4. Get Active Store Trips
    const activeStoreTrips = await StoreTrip.find({ flatId, active: true })
      .populate("userId", "name")
      .sort({ createdAt: -1 });

    // 5. Get Pinned Announcements
    const announcements = await ChatMessage.find({ flatId, isAnnouncement: true })
      .populate("senderId", "name")
      .sort({ createdAt: -1 })
      .limit(5);

    return NextResponse.json({
      flatName: flat.name,
      inviteCode: flat.inviteCode,
      inviteActive: flat.inviteActive,
      rules: flat.rules,
      adminId: flat.adminId,
      flatmates,
      openLyingItems,
      activeStoreTrips,
      announcements,
    });
  } catch (error: any) {
    console.error("Dashboard sync error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
