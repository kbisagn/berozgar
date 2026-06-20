import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import LyingItem from "@/models/LyingItem";
import User from "@/models/User";
import { triggerPusherEvent } from "@/lib/pusher";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !(session.user as any).flatId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { description, responsiblePersonId } = await req.json();

    if (!description || !responsiblePersonId) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    await connectToDatabase();

    const flatId = (session.user as any).flatId;
    const loggedById = (session.user as any).id;

    // Create lying item
    const newItem = await LyingItem.create({
      description,
      responsiblePerson: responsiblePersonId,
      loggedBy: loggedById,
      flatId,
    });

    // Deduct 5 points from the responsible user
    await User.findByIdAndUpdate(responsiblePersonId, {
      $inc: { points: -5 },
    });

    const populatedItem = await LyingItem.findById(newItem._id)
      .populate("responsiblePerson", "name")
      .populate("loggedBy", "name");

    await triggerPusherEvent(`flat-${flatId}`, "lying-item-logged", populatedItem);

    return NextResponse.json(
      { message: "Item logged. Points deducted from menace.", item: populatedItem },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Lying item log error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
