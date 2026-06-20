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

    const { mealId } = await req.json();

    if (!mealId) {
      return NextResponse.json({ error: "Meal ID is required" }, { status: 400 });
    }

    await connectToDatabase();

    const flatId = (session.user as any).flatId;
    const userId = (session.user as any).id;

    const meal = await CookMeal.findOne({ _id: mealId, flatId });

    if (!meal) {
      return NextResponse.json({ error: "Meal not found" }, { status: 404 });
    }

    if (meal.cookId.toString() !== userId) {
      return NextResponse.json({ error: "Only the designated cook can cancel the meal" }, { status: 403 });
    }

    // Rule: Cook can cancel if nobody is eating
    const activeEaters = meal.rsvps.filter((r) => r.status === "eating").length;
    if (activeEaters > 0) {
      return NextResponse.json(
        { error: "You cannot cancel a meal while flatmates are RSVP'd to eat. Please coordinate with them first." },
        { status: 400 }
      );
    }

    meal.status = "cancelled";
    await meal.save();

    await triggerPusherEvent(`flat-${flatId}`, "meal-cancelled", { mealId });

    return NextResponse.json({ message: "Meal cancelled successfully", meal });
  } catch (error: any) {
    console.error("Meal cancellation error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
