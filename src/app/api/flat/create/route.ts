import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import Flat from "@/models/Flat";
import User from "@/models/User";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, rules } = await req.json();

    if (!name) {
      return NextResponse.json({ error: "Flat name is required" }, { status: 400 });
    }

    await connectToDatabase();

    const userId = (session.user as any).id;
    const inviteCode = uuidv4().slice(0, 8); // Simple unique 8-character invite code

    const newFlat = await Flat.create({
      name,
      inviteCode,
      inviteActive: true,
      rules: rules || [
        "Keep common areas clean.",
        "Respect quiet hours after 10 PM.",
        "Update the cook if skipping meals.",
        "Log and resolve items you leave lying around.",
      ],
      adminId: userId,
    });

    // Update user role to admin and assign flatId
    await User.findByIdAndUpdate(userId, {
      flatId: newFlat._id,
      role: "admin",
    });

    return NextResponse.json(
      { message: "Flat created successfully", flat: newFlat },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Flat creation error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
