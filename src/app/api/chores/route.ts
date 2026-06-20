import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import Chore from "@/models/Chore";
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

    // Fetch chores populated with user info
    const chores = await Chore.find({ flatId })
      .populate("assignedTo", "name points capabilities")
      .populate("verifiedBy", "name")
      .populate("challengedBy", "name")
      .populate("swapRequestedWith", "name")
      .sort({ dueDate: 1 });

    // Check and trigger dynamic escalations for overdue chores
    let escalatedCount = 0;
    const now = new Date();
    for (const chore of chores) {
      if (chore.status === "pending" && new Date(chore.dueDate) < now && !chore.escalated) {
        chore.escalated = true;
        await chore.save();
        escalatedCount++;

        // Deduct points for overdue chore
        await User.findByIdAndUpdate(chore.assignedTo._id, {
          $inc: { points: -5 },
        });
      }
    }

    // Re-fetch if items were updated/escalated
    const updatedChores = escalatedCount > 0 
      ? await Chore.find({ flatId })
          .populate("assignedTo", "name points capabilities")
          .populate("verifiedBy", "name")
          .populate("challengedBy", "name")
          .populate("swapRequestedWith", "name")
          .sort({ dueDate: 1 })
      : chores;

    return NextResponse.json({ chores: updatedChores });
  } catch (error: any) {
    console.error("Chores fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !(session.user as any).flatId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { title, description, skill, assignedToId, dueDate } = await req.json();

    if (!title || !skill || !assignedToId || !dueDate) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    await connectToDatabase();

    const flatId = (session.user as any).flatId;

    // Verify assigned user has the required capability
    const assignedUser = await User.findOne({ _id: assignedToId, flatId });
    if (!assignedUser) {
      return NextResponse.json({ error: "User not found in this flat" }, { status: 404 });
    }

    if (!assignedUser.capabilities.includes(skill)) {
      return NextResponse.json(
        { error: `User does not have the capability: ${skill}` },
        { status: 400 }
      );
    }

    const newChore = await Chore.create({
      title,
      description,
      skill,
      assignedTo: assignedToId,
      flatId,
      dueDate: new Date(dueDate),
      status: "pending",
      escalated: false,
    });

    const populatedChore = await Chore.findById(newChore._id)
      .populate("assignedTo", "name points capabilities");

    await triggerPusherEvent(`flat-${flatId}`, "chore-created", populatedChore);

    return NextResponse.json({ message: "Chore scheduled successfully", chore: populatedChore }, { status: 201 });
  } catch (error: any) {
    console.error("Chore scheduling error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
