import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import Chore from "@/models/Chore";
import User from "@/models/User";
import { triggerPusherEvent } from "@/lib/pusher";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !(session.user as any).flatId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { choreId, targetUserId, action } = await req.json();

    if (!choreId) {
      return NextResponse.json({ error: "Chore ID is required" }, { status: 400 });
    }

    await connectToDatabase();

    const flatId = (session.user as any).flatId;
    const userId = (session.user as any).id;

    const chore = await Chore.findOne({ _id: choreId, flatId });

    if (!chore) {
      return NextResponse.json({ error: "Chore not found" }, { status: 404 });
    }

    // 1. Request Swap
    if (targetUserId) {
      if (chore.assignedTo.toString() !== userId) {
        return NextResponse.json({ error: "You can only request swaps for chores assigned to you" }, { status: 403 });
      }

      const targetUser = await User.findOne({ _id: targetUserId, flatId });
      if (!targetUser) {
        return NextResponse.json({ error: "Target user not found in this flat" }, { status: 404 });
      }

      if (!targetUser.capabilities.includes(chore.skill)) {
        return NextResponse.json({ error: "Target user does not have capability for this chore type" }, { status: 400 });
      }

      chore.swapRequestedWith = targetUserId;
      chore.swapStatus = "pending";
      await chore.save();

      await triggerPusherEvent(`flat-${flatId}`, "chore-swap-requested", {
        choreId: chore._id,
        from: userId,
        to: targetUserId,
        title: chore.title,
      });

      return NextResponse.json({ message: "Swap request sent successfully", chore });
    }

    // 2. Respond to Swap
    if (action) {
      if (action !== "accept" && action !== "reject") {
        return NextResponse.json({ error: "Action must be 'accept' or 'reject'" }, { status: 400 });
      }

      if (chore.swapRequestedWith?.toString() !== userId) {
        return NextResponse.json({ error: "You are not authorized to respond to this swap request" }, { status: 403 });
      }

      if (action === "reject") {
        chore.swapRequestedWith = undefined;
        chore.swapStatus = "none";
        await chore.save();

        await triggerPusherEvent(`flat-${flatId}`, "chore-swap-rejected", { choreId: chore._id });

        return NextResponse.json({ message: "Swap request rejected", chore });
      }

      if (action === "accept") {
        const originalOwner = chore.assignedTo;
        
        // Find if the target user (the one who accepted) has a chore of the same skill, and swap them.
        const targetUserChore = await Chore.findOne({
          flatId,
          assignedTo: userId,
          skill: chore.skill,
          status: "pending",
        });

        if (targetUserChore) {
          // Double swap: assign target's chore to original owner, and original owner's chore to target
          targetUserChore.assignedTo = originalOwner;
          await targetUserChore.save();
        }

        // Swap current chore
        chore.assignedTo = userId;
        chore.swapRequestedWith = undefined;
        chore.swapStatus = "none";
        await chore.save();

        await triggerPusherEvent(`flat-${flatId}`, "chore-swap-accepted", {
          choreId: chore._id,
          swappedWith: userId,
        });

        return NextResponse.json({ message: "Chore assignment swapped successfully", chore });
      }
    }

    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  } catch (error: any) {
    console.error("Chore swap error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
