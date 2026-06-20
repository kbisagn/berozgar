import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import Flat from "@/models/Flat";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");

    if (!code) {
      return NextResponse.json({ error: "Code is required" }, { status: 400 });
    }

    await connectToDatabase();

    const flat = await Flat.findOne({ inviteCode: code });

    if (!flat) {
      return NextResponse.json({ error: "Invite code not found" }, { status: 404 });
    }

    if (!flat.inviteActive) {
      return NextResponse.json({ error: "Invite link is inactive" }, { status: 400 });
    }

    return NextResponse.json({ flatName: flat.name }, { status: 200 });
  } catch (error: any) {
    console.error("Invite info fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
