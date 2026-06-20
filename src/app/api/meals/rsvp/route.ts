import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import CookMeal from "@/models/CookMeal";
import { triggerPusherEvent } from "@/lib/pusher";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !(session.user as any).flatId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { mealId, rsvpStatus } = await req.json();

    if (!mealId || (rsvpStatus !== "eating" && rsvpStatus !== "skipping")) {
      return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
    }

    await connectToDatabase();

    const flatId = (session.user as any).flatId;
    const userId = (session.user as any).id;

    const meal = await CookMeal.findOne({ _id: mealId, flatId });

    if (!meal) {
      return NextResponse.json({ error: "Meal announcement not found" }, { status: 404 });
    }

    if (meal.status === "cancelled") {
      return NextResponse.json({ error: "Meal has been cancelled by the cook" }, { status: 400 });
    }

    // Find and update/add user RSVP
    const existingIndex = meal.rsvps.findIndex((r) => r.userId.toString() === userId);

    if (existingIndex > -1) {
      meal.rsvps[existingIndex].status = rsvpStatus;
    } else {
      meal.rsvps.push({ userId, status: rsvpStatus });
    }

    // Recompute portion counts (people eating)
    meal.portionCount = meal.rsvps.filter((r) => r.status === "eating").length;
    await meal.save();

    const populatedMeal = await CookMeal.findById(meal._id)
      .populate("cookId", "name")
      .populate("rsvps.userId", "name");

    await triggerPusherEvent(`flat-${flatId}`, "meal-rsvp-updated", populatedMeal);

    return NextResponse.json({ message: "RSVP updated successfully", meal: populatedMeal });
  } catch (error: any) {
    console.error("Meal RSVP error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
