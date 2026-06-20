import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import Flat from "@/models/Flat";
import { triggerPusherEvent } from "@/lib/pusher";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !(session.user as any).flatId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { rules } = await req.json();

    if (!Array.isArray(rules)) {
      return NextResponse.json({ error: "Rules must be an array of strings" }, { status: 400 });
    }

    await connectToDatabase();

    const flatId = (session.user as any).flatId;
    const flat = await Flat.findById(flatId);

    if (!flat) {
      return NextResponse.json({ error: "Flat not found" }, { status: 404 });
    }

    // Authorization: only admin can modify flat rules
    if (flat.adminId.toString() !== (session.user as any).id) {
      return NextResponse.json({ error: "Only the flat admin can edit rules" }, { status: 403 });
    }

    flat.rules = rules;
    await flat.save();

    await triggerPusherEvent(`flat-${flatId}`, "rules-updated", { rules });

    return NextResponse.json({ message: "Rules updated successfully", rules });
  } catch (error: any) {
    console.error("Flat rules update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
