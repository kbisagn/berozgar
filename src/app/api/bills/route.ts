import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import Bill from "@/models/Bill";
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
    const userId = (session.user as any).id;

    // 1. Fetch all bills
    const bills = await Bill.find({ flatId })
      .populate("paidBy", "name")
      .populate("splits.userId", "name")
      .sort({ createdAt: -1 });

    // 2. Fetch all flatmates
    const flatmates = await User.find({ flatId }).select("name");

    // ----------------------------------------------------
    // BALANCE MATRIX CALCULATION (Netting IOwe/UOwe)
    // ----------------------------------------------------
    // Create a matrix mapping user IDs to their balance relations
    // balances[otherUserId] = positive if they owe you, negative if you owe them
    const balances: { [key: string]: { name: string; amount: number } } = {};

    // Initialize balances for all flatmates
    flatmates.forEach((fm) => {
      const fmIdStr = fm._id.toString();
      if (fmIdStr !== userId) {
        balances[fmIdStr] = { name: fm.name, amount: 0 };
      }
    });

    // Traverse all bills to compute raw balances
    bills.forEach((bill) => {
      const payerIdStr = bill.paidBy._id.toString();

      bill.splits.forEach((split) => {
        const debtorIdStr = split.userId._id.toString();

        // Only calculate for unpaid splits
        if (!split.paid) {
          if (payerIdStr === userId && debtorIdStr !== userId) {
            // Current user paid, debtor owes current user
            if (balances[debtorIdStr]) {
              balances[debtorIdStr].amount += split.amount;
            }
          } else if (payerIdStr !== userId && debtorIdStr === userId) {
            // Other user paid, current user owes other user
            if (balances[payerIdStr]) {
              balances[payerIdStr].amount -= split.amount;
            }
          }
        }
      });
    });

    // Format balances into clean lists
    const iOwe: Array<{ userId: string; name: string; amount: number }> = [];
    const uOwe: Array<{ userId: string; name: string; amount: number }> = [];

    Object.entries(balances).forEach(([otherUserId, data]) => {
      // Round to 2 decimal places to avoid floating point issues
      const roundedAmount = Math.round(data.amount * 100) / 100;
      if (roundedAmount < 0) {
        iOwe.push({ userId: otherUserId, name: data.name, amount: Math.abs(roundedAmount) });
      } else if (roundedAmount > 0) {
        uOwe.push({ userId: otherUserId, name: data.name, amount: roundedAmount });
      }
    });

    return NextResponse.json({ bills, iOwe, uOwe });
  } catch (error: any) {
    console.error("Bills fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !(session.user as any).flatId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { description, amount, category, splitType, splits } = await req.json();

    if (!description || !amount || !category || !splitType || !Array.isArray(splits)) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    await connectToDatabase();

    const flatId = (session.user as any).flatId;
    const paidBy = (session.user as any).id;

    // Validate that splits sum up to the total bill amount
    const splitSum = splits.reduce((sum: number, s: any) => sum + Number(s.amount), 0);
    const tolerance = 0.5; // Allow minor decimal rounding tolerances
    if (Math.abs(splitSum - Number(amount)) > tolerance) {
      return NextResponse.json(
        { error: `Sum of splits (${splitSum}) must equal total amount (${amount})` },
        { status: 400 }
      );
    }

    const newBill = await Bill.create({
      description,
      amount: Number(amount),
      category,
      paidBy,
      flatId,
      splitType,
      splits: splits.map((s: any) => ({
        userId: s.userId,
        amount: Number(s.amount),
        paid: s.userId === paidBy, // Payer's split is automatically marked as paid
      })),
    });

    const populatedBill = await Bill.findById(newBill._id)
      .populate("paidBy", "name")
      .populate("splits.userId", "name");

    await triggerPusherEvent(`flat-${flatId}`, "bill-added", populatedBill);

    return NextResponse.json({ message: "Expense logged successfully", bill: populatedBill }, { status: 201 });
  } catch (error: any) {
    console.error("Bill logging error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
