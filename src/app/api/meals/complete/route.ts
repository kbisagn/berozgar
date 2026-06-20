import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import CookMeal from "@/models/CookMeal";
import User from "@/models/User";
import { triggerPusherEvent } from "@/lib/pusher";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !(session.user as any).flatId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { mealId, noShowUserIds } = await req.json();

    if (!mealId || !Array.isArray(noShowUserIds)) {
      return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
    }

    await connectToDatabase();

    const flatId = (session.user as any).flatId;
    const userId = (session.user as any).id;

    const meal = await CookMeal.findOne({ _id: mealId, flatId });

    if (!meal) {
      return NextResponse.json({ error: "Meal not found" }, { status: 404 });
    }

    if (meal.cookId.toString() !== userId) {
      return NextResponse.json({ error: "Only the designated cook can complete the meal" }, { status: 403 });
    }

    if (meal.status !== "active") {
      return NextResponse.json({ error: "Meal is not in an active state" }, { status: 400 });
    }

    // Identify who was RSVP'd "eating"
    const eatingUserIds = meal.rsvps
      .filter((r) => r.status === "eating")
      .map((r) => r.userId.toString());

    // Actual eaters = RSVP'd "eating" and NOT in noShowUserIds
    const actualEatersCount = eatingUserIds.filter((id) => !noShowUserIds.includes(id)).length;

    // 1. Award cook points: 15 base + 5 points per actual eater
    const cookBonus = actualEatersCount * 5;
    const totalCookPoints = 15 + cookBonus;

    await User.findByIdAndUpdate(userId, {
      $inc: { points: totalCookPoints },
    });

    // 2. Penalize no-shows: -2 points for RSVP'd eating but didn't show
    for (const noShowId of noShowUserIds) {
      if (eatingUserIds.includes(noShowId)) {
        await User.findByIdAndUpdate(noShowId, {
          $inc: { points: -2 },
        });
      }
    }

    meal.status = "completed";
    await meal.save();

    await triggerPusherEvent(`flat-${flatId}`, "meal-completed", {
      mealId: meal._id,
      cookId: userId,
      actualEatersCount,
      noShowsCount: noShowUserIds.length,
    });

    return NextResponse.json({
      message: "Meal completed. Points and penalties applied successfully.",
      cookEarned: totalCookPoints,
      actualEatersCount,
    });
  } catch (error: any) {
    console.error("Meal completion error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
