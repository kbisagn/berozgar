import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import User from "@/models/User";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, capabilities } = await req.json();

    await connectToDatabase();

    const userId = (session.user as any).id;

    const updateData: any = {};
    if (name) updateData.name = name;
    if (capabilities) updateData.capabilities = capabilities;

    await User.findByIdAndUpdate(userId, updateData);

    return NextResponse.json({ message: "User onboarding completed successfully" }, { status: 200 });
  } catch (error: any) {
    console.error("User onboarding error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
