import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import Bill from "@/models/Bill";
import { triggerPusherEvent } from "@/lib/pusher";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !(session.user as any).flatId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { targetUserId } = await req.json();

    if (!targetUserId) {
      return NextResponse.json({ error: "Target User ID is required" }, { status: 400 });
    }

    await connectToDatabase();

    const flatId = (session.user as any).flatId;
    const userId = (session.user as any).id;

    // Settle all unpaid splits where current user is the creditor and target user is the debtor,
    // or vice versa (current user is the debtor and target is the creditor).
    // Let's settle both directions or the specific direction they select. Let's settle the unpaid splits
    // where current user is the creditor and target is debtor first, or do both. Doing both is the cleanest
    // way to completely clear the slate between the two roommates!
    
    // 1. Unpaid splits where current user paid, target user owes
    const bills1 = await Bill.find({ flatId, paidBy: userId, "splits.userId": targetUserId, "splits.paid": false });
    for (const bill of bills1) {
      const idx = bill.splits.findIndex((s) => s.userId.toString() === targetUserId && !s.paid);
      if (idx > -1) {
        bill.splits[idx].paid = true;
        await bill.save();
      }
    }

    // 2. Unpaid splits where target user paid, current user owes
    const bills2 = await Bill.find({ flatId, paidBy: targetUserId, "splits.userId": userId, "splits.paid": false });
    for (const bill of bills2) {
      const idx = bill.splits.findIndex((s) => s.userId.toString() === userId && !s.paid);
      if (idx > -1) {
        bill.splits[idx].paid = true;
        await bill.save();
      }
    }

    await triggerPusherEvent(`flat-${flatId}`, "bills-settled", {
      userA: userId,
      userB: targetUserId,
    });

    return NextResponse.json({ message: "All balances settled successfully." });
  } catch (error: any) {
    console.error("Bills settle error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
