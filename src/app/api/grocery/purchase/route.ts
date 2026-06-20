import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import GroceryItem from "@/models/GroceryItem";
import { triggerPusherEvent } from "@/lib/pusher";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !(session.user as any).flatId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { itemIds } = await req.json();

    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return NextResponse.json({ error: "No items specified" }, { status: 400 });
    }

    await connectToDatabase();

    const flatId = (session.user as any).flatId;
    const userId = (session.user as any).id;

    // Mark multiple items as purchased
    await GroceryItem.updateMany(
      { _id: { $in: itemIds }, flatId },
      {
        $set: {
          purchased: true,
          purchasedBy: userId,
          purchasedAt: new Date(),
        },
      }
    );

    await triggerPusherEvent(`flat-${flatId}`, "grocery-purchased", { itemIds, purchasedBy: userId });

    return NextResponse.json({ message: "Groceries marked as purchased successfully." });
  } catch (error: any) {
    console.error("Grocery purchase error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
