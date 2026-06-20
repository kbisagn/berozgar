import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
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

    // Auth check: only admin can toggle invites
    if (flat.adminId.toString() !== userId) {
      return NextResponse.json({ error: "Only flat admins can toggle invite links." }, { status: 403 });
    }

    // Toggle invite status
    flat.inviteActive = !flat.inviteActive;
    await flat.save();

    await triggerPusherEvent(`flat-${flatId}`, "invite-status-toggled", {
      inviteActive: flat.inviteActive,
    });

    return NextResponse.json({
      message: `Invite link ${flat.inviteActive ? "activated" : "deactivated"} successfully.`,
      inviteActive: flat.inviteActive,
    });
  } catch (error: any) {
    console.error("Invite toggle error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
