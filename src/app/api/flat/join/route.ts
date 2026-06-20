import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import Flat from "@/models/Flat";
import User from "@/models/User";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { inviteCode, capabilities, name } = await req.json();

    if (!inviteCode) {
      return NextResponse.json({ error: "Invite code is required" }, { status: 400 });
    }

    await connectToDatabase();

    const flat = await Flat.findOne({ inviteCode });

    if (!flat) {
      return NextResponse.json({ error: "Invalid invite code" }, { status: 404 });
    }

    if (!flat.inviteActive) {
      return NextResponse.json({ error: "This invite link has been revoked" }, { status: 400 });
    }

    const userId = (session.user as any).id;

    // Update user name, capabilities, role, and flatId
    const updateData: any = {
      flatId: flat._id,
      role: "member",
      capabilities: capabilities || [],
    };

    if (name) {
      updateData.name = name;
    }

    await User.findByIdAndUpdate(userId, updateData);

    return NextResponse.json(
      { message: "Successfully joined the flat", flatName: flat.name, flatId: flat._id },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Flat join error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
