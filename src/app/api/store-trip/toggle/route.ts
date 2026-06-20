import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import StoreTrip from "@/models/StoreTrip";
import { triggerPusherEvent } from "@/lib/pusher";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !(session.user as any).flatId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const flatId = (session.user as any).flatId;
    const userId = (session.user as any).id;

    // Check if there is an active trip for this user
    const activeTrip = await StoreTrip.findOne({ flatId, userId, active: true });

    if (activeTrip) {
      // Toggle off
      activeTrip.active = false;
      await activeTrip.save();

      await triggerPusherEvent(`flat-${flatId}`, "store-trip-ended", {
        userId,
        userName: session.user.name,
      });

      return NextResponse.json({ message: "Store trip ended", active: false });
    } else {
      // Toggle on
      const newTrip = await StoreTrip.create({
        flatId,
        userId,
        active: true,
      });

      await triggerPusherEvent(`flat-${flatId}`, "store-trip-started", {
        userId,
        userName: session.user.name,
        tripId: newTrip._id,
      });

      return NextResponse.json({ message: "Store trip started", active: true });
    }
  } catch (error: any) {
    console.error("Store trip toggle error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
