import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import Flat from "@/models/Flat";
import User from "@/models/User";
import { triggerPusherEvent } from "@/lib/pusher";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !(session.user as any).flatId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { memberId } = await req.json();

    if (!memberId) {
      return NextResponse.json({ error: "Roommate ID is required" }, { status: 400 });
    }

    await connectToDatabase();

    const flatId = (session.user as any).flatId;
    const userId = (session.user as any).id;

    const flat = await Flat.findById(flatId);
    if (!flat) {
      return NextResponse.json({ error: "Flat not found" }, { status: 404 });
    }

    // Only flat admin can kick members
    if (flat.adminId.toString() !== userId) {
      return NextResponse.json({ error: "Only the flat admin can remove flatmates." }, { status: 403 });
    }

    if (memberId === userId) {
      return NextResponse.json({ error: "You cannot kick yourself out of the flat. Appoint another admin first." }, { status: 400 });
    }

    // Kick the target user
    const targetUser = await User.findOne({ _id: memberId, flatId });
    if (!targetUser) {
      return NextResponse.json({ error: "Roommate not found in this flat." }, { status: 404 });
    }

    targetUser.flatId = undefined as any;
    targetUser.role = "member";
    await targetUser.save();

    await triggerPusherEvent(`flat-${flatId}`, "roommate-kicked", { memberId });

    return NextResponse.json({ message: "Roommate removed from the flat successfully." });
  } catch (error: any) {
    console.error("Roommate kick error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
