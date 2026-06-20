import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import GroceryItem from "@/models/GroceryItem";
import { triggerPusherEvent } from "@/lib/pusher";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !(session.user as any).flatId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const flatId = (session.user as any).flatId;

    // Fetch unpurchased grocery items
    const items = await GroceryItem.find({ flatId, purchased: false })
      .populate("addedBy", "name")
      .sort({ createdAt: -1 });

    return NextResponse.json({ items });
  } catch (error: any) {
    console.error("Grocery fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !(session.user as any).flatId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, quantity, category } = await req.json();

    if (!name || !quantity) {
      return NextResponse.json({ error: "Name and quantity are required" }, { status: 400 });
    }

    await connectToDatabase();

    const flatId = (session.user as any).flatId;
    const addedBy = (session.user as any).id;

    const newItem = await GroceryItem.create({
      name,
      quantity,
      category: category || "other",
      addedBy,
      flatId,
      purchased: false,
    });

    const populatedItem = await GroceryItem.findById(newItem._id)
      .populate("addedBy", "name");

    await triggerPusherEvent(`flat-${flatId}`, "grocery-added", populatedItem);

    return NextResponse.json({ message: "Grocery item added", item: populatedItem }, { status: 201 });
  } catch (error: any) {
    console.error("Grocery add error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
