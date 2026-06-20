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

    const { choreId } = await req.json();

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

    if (chore.status !== "pending") {
      return NextResponse.json({ error: "Chore is already verified or in challenge state" }, { status: 400 });
    }

    // Rule: Someone else marks your chore done, not you
    if (chore.assignedTo.toString() === userId) {
      return NextResponse.json({ error: "You cannot verify your own chores. A flatmate must verify it." }, { status: 403 });
    }

    // Award Points
    const isCooking = chore.skill === "cooking";
    const performerPoints = isCooking ? 15 : 10;
    const verifierPoints = isCooking ? 3 : 2;

    // Update performer points
    await User.findByIdAndUpdate(chore.assignedTo, {
      $inc: { points: performerPoints },
    });

    // Update verifier points
    await User.findByIdAndUpdate(userId, {
      $inc: { points: verifierPoints },
    });

    // Update Chore
    chore.status = "completed";
    chore.verifiedBy = userId;
    chore.completedAt = new Date();
    // Allow challenge window of 2 hours
    chore.challengeEndsAt = new Date(Date.now() + 2 * 60 * 60 * 1000); 
    await chore.save();

    // ----------------------------------------------------
    // ROTATING SCHEDULE LOGIC
    // ----------------------------------------------------
    // Find all users in the flat capable of doing this chore
    const capableUsers = await User.find({ flatId, capabilities: chore.skill }).sort({ _id: 1 });
    
    if (capableUsers.length > 0) {
      // Find the index of the currently assigned user
      const currentIndex = capableUsers.findIndex((u) => u._id.toString() === chore.assignedTo.toString());
      // Next user index
      const nextIndex = (currentIndex + 1) % capableUsers.length;
      const nextUser = capableUsers[nextIndex];

      // Schedule next chore instance due in 2 days
      const nextDueDate = new Date();
      nextDueDate.setDate(nextDueDate.getDate() + 2);

      await Chore.create({
        title: chore.title,
        description: chore.description,
        skill: chore.skill,
        assignedTo: nextUser._id,
        flatId,
        dueDate: nextDueDate,
        status: "pending",
        escalated: false,
      });
    }

    await triggerPusherEvent(`flat-${flatId}`, "chore-verified", {
      choreId: chore._id,
      title: chore.title,
      assignedTo: chore.assignedTo,
    });

    return NextResponse.json({ message: "Chore verified and points awarded. Rotation triggered.", chore });
  } catch (error: any) {
    console.error("Chore verification error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
