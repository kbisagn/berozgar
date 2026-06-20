import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import Chore from "@/models/Chore";
import User from "@/models/User";
import { triggerPusherEvent } from "@/lib/pusher";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !(session.user as any).flatId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { choreId, vote } = await req.json();

    if (!choreId) {
      return NextResponse.json({ error: "Chore ID is required" }, { status: 400 });
    }

    await connectToDatabase();

    const flatId = (session.user as any).flatId;
    const userId = (session.user as any).id;

    const chore = await Chore.findOne({ _id: choreId, flatId });

    if (!chore) {
      return NextResponse.json({ error: "Chore not found" }, { status: 404 });
    }

    // N = total flatmates
    const flatmatesCount = await User.countDocuments({ flatId });

    if (chore.status === "completed") {
      // Initiate Challenge
      chore.status = "challenged";
      chore.challengedBy = userId;
      chore.challengeVotes = [{ userId, vote: "disagree" }]; // Challenger disagrees that the chore is done
      await chore.save();

      await triggerPusherEvent(`flat-${flatId}`, "chore-challenged", {
        choreId: chore._id,
        challengedBy: userId,
        title: chore.title,
      });

      return NextResponse.json({ message: "Chore challenge initiated.", chore });
    } else if (chore.status === "challenged") {
      // Cast Vote
      if (!vote || (vote !== "agree" && vote !== "disagree")) {
        return NextResponse.json({ error: "Vote must be 'agree' or 'disagree'" }, { status: 400 });
      }

      // Check if user already voted
      const alreadyVoted = chore.challengeVotes.some((v) => v.userId.toString() === userId);
      if (alreadyVoted) {
        return NextResponse.json({ error: "You have already voted on this challenge" }, { status: 400 });
      }

      chore.challengeVotes.push({ userId, vote });
      await chore.save();

      // Check voting progress
      const disagreeCount = chore.challengeVotes.filter((v) => v.vote === "disagree").length;
      const agreeCount = chore.challengeVotes.filter((v) => v.vote === "agree").length;
      const majorityThreshold = flatmatesCount / 2;

      let resolution = "";

      if (disagreeCount > majorityThreshold) {
        // Challenge succeeds: Performer lied, chore was NOT done.
        // Status goes back to pending. Performer is penalized -10 points.
        await User.findByIdAndUpdate(chore.assignedTo, {
          $inc: { points: -10 },
        });

        chore.status = "pending";
        chore.challengeVotes = [];
        chore.challengedBy = undefined;
        await chore.save();

        resolution = "challenge_succeeded";
      } else if (agreeCount > majorityThreshold) {
        // Challenge fails: Performer indeed did the chore.
        // Status remains completed. Challenger is penalized -5 points.
        if (chore.challengedBy) {
          await User.findByIdAndUpdate(chore.challengedBy, {
            $inc: { points: -5 },
          });
        }

        chore.status = "completed";
        chore.challengeVotes = [];
        chore.challengedBy = undefined;
        await chore.save();

        resolution = "challenge_failed";
      }

      await triggerPusherEvent(`flat-${flatId}`, "challenge-vote-cast", {
        choreId: chore._id,
        agreeCount,
        disagreeCount,
        resolution,
      });

      return NextResponse.json({
        message: "Vote cast successfully",
        agreeCount,
        disagreeCount,
        resolution,
        chore,
      });
    } else {
      return NextResponse.json({ error: "Chore is not in a challengeable state" }, { status: 400 });
    }
  } catch (error: any) {
    console.error("Chore challenge/vote error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
