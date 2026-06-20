import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import CookMeal from "@/models/CookMeal";
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
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date") || new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    const meal = await CookMeal.findOne({ flatId, date })
      .populate("cookId", "name points capabilities")
      .populate("rsvps.userId", "name");

    return NextResponse.json({ meal });
  } catch (error: any) {
    console.error("Meals fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !(session.user as any).flatId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { mealDescription, date } = await req.json();

    if (!mealDescription || !date) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    await connectToDatabase();

    const flatId = (session.user as any).flatId;
    const userId = (session.user as any).id;

    // Rule: Cooking chores/meals can only be created by roommates with cooking capability
    const cook = await User.findById(userId);
    if (!cook || !cook.capabilities.includes("cooking")) {
      return NextResponse.json(
        { error: "Only roommates with 'cooking' capability can announce meals." },
        { status: 403 }
      );
    }

    // Upsert meal for this date and flat
    const existingMeal = await CookMeal.findOne({ flatId, date });

    if (existingMeal) {
      existingMeal.mealDescription = mealDescription;
      existingMeal.status = "active";
      await existingMeal.save();
      
      const populatedMeal = await CookMeal.findById(existingMeal._id)
        .populate("cookId", "name")
        .populate("rsvps.userId", "name");

      await triggerPusherEvent(`flat-${flatId}`, "meal-updated", populatedMeal);
      return NextResponse.json({ message: "Meal updated successfully", meal: populatedMeal });
    }

    const newMeal = await CookMeal.create({
      cookId: userId,
      flatId,
      date,
      mealDescription,
      portionCount: 0,
      status: "active",
      rsvps: [],
    });

    const populatedMeal = await CookMeal.findById(newMeal._id)
      .populate("cookId", "name")
      .populate("rsvps.userId", "name");

    await triggerPusherEvent(`flat-${flatId}`, "meal-announced", populatedMeal);

    return NextResponse.json({ message: "Meal announced successfully", meal: populatedMeal }, { status: 201 });
  } catch (error: any) {
    console.error("Meal announcement error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
