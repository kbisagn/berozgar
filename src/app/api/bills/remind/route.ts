import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import User from "@/models/User";
import { sendEmail } from "@/lib/notifications";
import { triggerPusherEvent } from "@/lib/pusher";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !(session.user as any).flatId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { targetUserId, amount } = await req.json();

    if (!targetUserId || !amount) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    await connectToDatabase();

    const flatId = (session.user as any).flatId;
    const targetUser = await User.findOne({ _id: targetUserId, flatId });

    if (!targetUser) {
      return NextResponse.json({ error: "Target roommate not found" }, { status: 404 });
    }

    // Trigger Pusher nudge
    await triggerPusherEvent(`flat-${flatId}`, "payment-nudge", {
      from: session.user.name,
      toUserId: targetUserId,
      amount,
    });

    // Send digest / email notification reminder
    await sendEmail({
      to: targetUser.email,
      subject: "💸 Flatmate Expense Reminder",
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #111;">
          <h2>Hey ${targetUser.name},</h2>
          <p>This is a quick friendly reminder from your roommate <strong>${session.user.name}</strong> regarding outstanding shared expenses.</p>
          <p>According to the flat ledger, you currently owe them: <strong>₹${amount}</strong></p>
          <p>Please log into the <a href="${process.env.NEXTAUTH_URL || 'http://localhost:3000'}">FlatMate App</a> to check the details and settle up.</p>
          <br/>
          <p>Cheers,<br/>FlatMate Bot</p>
        </div>
      `,
    });

    return NextResponse.json({ message: "Reminder sent successfully." });
  } catch (error: any) {
    console.error("Reminder nudge error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
