"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { 
  ClipboardList, Plus, Calendar, AlertTriangle, ArrowLeftRight, 
  CheckCircle2, Flame, Vote, Sparkles, User, BadgeAlert
} from "lucide-react";
import { getPusherClient } from "@/lib/pusher-client";

interface UserInfo {
  _id: string;
  name: string;
  points: number;
  capabilities: string[];
}

interface ChoreType {
  _id: string;
  title: string;
  description?: string;
  skill: string;
  assignedTo: UserInfo;
  status: "pending" | "completed" | "challenged";
  verifiedBy?: { _id: string; name: string };
  challengedBy?: { _id: string; name: string };
  challengeVotes: Array<{ userId: string; vote: "agree" | "disagree" }>;
  challengeEndsAt?: string;
  dueDate: string;
  completedAt?: string;
  escalated: boolean;
  swapRequestedWith?: { _id: string; name: string };
  swapStatus: "none" | "pending" | "accepted" | "rejected";
}

export default function ChoresPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [chores, setChores] = useState<ChoreType[]>([]);
  const [flatmates, setFlatmates] = useState<UserInfo[]>([]);
  
  // Modals & States
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  const [showAddChore, setShowAddChore] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newSkill, setNewSkill] = useState("cleaning");
  const [newAssignedTo, setNewAssignedTo] = useState("");
  const [newDueDate, setNewDueDate] = useState("");

  const [showSwapModal, setShowSwapModal] = useState(false);
  const [swapChoreId, setSwapChoreId] = useState("");

  // Redirect if not logged in
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/chores");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch chores");
      setChores(data.chores);

      const fmRes = await fetch("/api/dashboard/sync");
      const fmData = await fmRes.json();
      if (fmRes.ok) {
        setFlatmates(fmData.flatmates);
      }
    } catch (err: any) {
      setError(err.message || "Failed to sync");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated" && (session?.user as any)?.flatId) {
      fetchData();

      const interval = setInterval(() => fetchData(true), 5000);

      const pusher = getPusherClient();
      const flatId = (session.user as any).flatId;

      if (pusher && flatId) {
        const channelName = `flat-${flatId}`;
        const channel = pusher.subscribe(channelName);

        channel.bind("chore-created", () => fetchData(true));
        channel.bind("chore-verified", () => fetchData(true));
        channel.bind("chore-challenged", () => fetchData(true));
        channel.bind("challenge-vote-cast", () => fetchData(true));
        channel.bind("chore-swap-requested", () => fetchData(true));
        channel.bind("chore-swap-accepted", () => fetchData(true));
        channel.bind("chore-swap-rejected", () => fetchData(true));

        return () => {
          channel.unbind_all();
          pusher.unsubscribe(channelName);
          clearInterval(interval);
        };
      }

      return () => clearInterval(interval);
    }
  }, [status, session]);

  const handleAddChoreSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newSkill || !newAssignedTo || !newDueDate) return;
    setActionLoading(true);
    setError("");

    try {
      const res = await fetch("/api/chores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          description: newDesc,
          skill: newSkill,
          assignedToId: newAssignedTo,
          dueDate: newDueDate,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to schedule chore");

      setNewTitle("");
      setNewDesc("");
      setNewAssignedTo("");
      setNewDueDate("");
      setShowAddChore(false);
      fetchData(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerifyChore = async (choreId: string) => {
    setError("");
    try {
      const res = await fetch("/api/chores/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ choreId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed");
      fetchData(true);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleInitiateChallenge = async (choreId: string) => {
    setError("");
    try {
      const res = await fetch("/api/chores/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ choreId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Challenge failed");
      fetchData(true);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCastVote = async (choreId: string, vote: "agree" | "disagree") => {
    setError("");
    try {
      const res = await fetch("/api/chores/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ choreId, vote }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Vote failed");
      fetchData(true);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRequestSwap = async (targetUserId: string) => {
    if (!swapChoreId || !targetUserId) return;
    setError("");
    setShowSwapModal(false);

    try {
      const res = await fetch("/api/chores/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ choreId: swapChoreId, targetUserId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Swap request failed");
      fetchData(true);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRespondSwap = async (choreId: string, action: "accept" | "reject") => {
    setError("");
    try {
      const res = await fetch("/api/chores/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ choreId, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Swap response failed");
      fetchData(true);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const getSkillEmoji = (skill: string) => {
    switch (skill) {
      case "cooking": return "🍳";
      case "cleaning": return "🧹";
      case "laundry": return "🧺";
      case "grocery runs": return "🛒";
      case "trash": return "🗑";
      default: return "📋";
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#030303]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground text-sm">Syncing chores schedule...</p>
        </div>
      </div>
    );
  }

  const userId = (session?.user as any)?.id;
  const isAdmin = (session?.user as any)?.role === "admin";
  const myChores = chores.filter((c) => c.assignedTo._id === userId && c.status !== "completed");
  const otherChores = chores.filter((c) => c.assignedTo._id !== userId);

  // Filter flatmates capable of doing the selected swap chore type
  const activeSwapChore = chores.find((c) => c._id === swapChoreId);
  const eligibleSwapPartners = flatmates.filter(
    (f) => f._id !== userId && f.capabilities.includes(activeSwapChore?.skill || "")
  );

  return (
    <div className="flex-1 px-4 py-6 overflow-y-auto no-scrollbar pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <span className="text-[10px] text-primary uppercase font-bold tracking-widest">Rotations</span>
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-primary" /> Chores Room
          </h2>
        </div>
        {isAdmin && (
          <button
            onClick={() => {
              setError("");
              setShowAddChore(true);
            }}
            className="p-2.5 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 active:scale-95 transition-all flex items-center gap-1 shadow-lg shadow-primary/20"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs text-center">
          {error}
        </div>
      )}

      {/* Chore swap requests pending for ME */}
      {chores
        .filter((c) => c.swapRequestedWith?._id === userId && c.swapStatus === "pending")
        .map((chore) => (
          <div key={chore._id} className="mb-6 p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs">
            <p className="text-white leading-relaxed">
              🔄 <strong>{chore.assignedTo.name}</strong> wants to swap <strong>"{chore.title}"</strong> with you.
            </p>
            <div className="flex gap-2.5 mt-3 justify-end">
              <button
                onClick={() => handleRespondSwap(chore._id, "reject")}
                className="py-1 px-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold"
              >
                Reject
              </button>
              <button
                onClick={() => handleRespondSwap(chore._id, "accept")}
                className="py-1 px-3 rounded-lg bg-primary text-white font-bold shadow shadow-primary/20"
              >
                Accept Swap
              </button>
            </div>
          </div>
        ))}

      {/* MY CHORES */}
      <div className="mb-8">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">🏠 My Assigned Duties</h3>
        {myChores.length === 0 ? (
          <div className="glass rounded-xl p-6 text-center text-xs text-muted-foreground border border-white/5">
            🎉 Nice! No pending chores for you today.
          </div>
        ) : (
          <div className="space-y-4">
            {myChores.map((chore) => {
              const isOverdue = new Date(chore.dueDate) < new Date() && chore.status === "pending";
              return (
                <div 
                  key={chore._id} 
                  className={`glass rounded-2xl p-4 border relative ${
                    isOverdue 
                      ? "border-red-500/30 bg-red-500/[0.02] shadow-lg shadow-red-500/5 animate-pulse" 
                      : chore.swapStatus === "pending"
                        ? "border-purple-500/20 bg-purple-500/[0.01]"
                        : "border-white/5"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-lg">{getSkillEmoji(chore.skill)}</span>
                        <h4 className="text-sm font-bold text-white">{chore.title}</h4>
                        {isOverdue && (
                          <span className="text-[8px] bg-red-500/20 border border-red-500/30 text-red-400 px-1.5 py-0.5 rounded font-black tracking-wider uppercase">
                            Overdue Escalated
                          </span>
                        )}
                        {chore.swapStatus === "pending" && (
                          <span className="text-[8px] bg-purple-500/25 border border-purple-500/30 text-purple-400 px-1.5 py-0.5 rounded font-bold uppercase">
                            Swap Pending ({chore.swapRequestedWith?.name})
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1.5">{chore.description}</p>
                      
                      <div className="flex items-center gap-2 mt-3 text-[10px] text-muted-foreground">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Due: {new Date(chore.dueDate).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/5 flex justify-between items-center gap-2">
                    <button
                      onClick={() => {
                        setSwapChoreId(chore._id);
                        setShowSwapModal(true);
                      }}
                      className="py-1.5 px-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-[10px] font-bold text-white flex items-center gap-1 active:scale-95 transition-all"
                    >
                      <ArrowLeftRight className="w-3 h-3" /> Swap
                    </button>
                    
                    <span className="text-[10px] text-amber-400 font-bold bg-amber-500/5 px-2.5 py-1 rounded border border-amber-500/10">
                      Waiting for Flatmate to Verify
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ALL FLAT DUTIES */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">👥 Roommate Duties</h3>
        {chores.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-6">No scheduled chores.</p>
        ) : (
          <div className="space-y-4">
            {chores.map((chore) => {
              const isMine = chore.assignedTo._id === userId;
              if (isMine && chore.status !== "completed") return null; // already rendered in "My Assigned Duties"

              const isOverdue = new Date(chore.dueDate) < new Date() && chore.status === "pending";
              const isChallenged = chore.status === "challenged";
              const hasVoted = chore.challengeVotes.some((v) => v.userId === userId);

              return (
                <div 
                  key={chore._id} 
                  className={`glass rounded-2xl p-4 border ${
                    isChallenged
                      ? "border-amber-500/30 bg-amber-500/[0.01]" 
                      : chore.status === "completed"
                        ? "border-green-500/10 opacity-70 bg-green-500/[0.005]"
                        : isOverdue
                          ? "border-red-500/30 bg-red-500/[0.02]"
                          : "border-white/5"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-lg">{getSkillEmoji(chore.skill)}</span>
                        <h4 className="text-sm font-bold text-white">{chore.title}</h4>
                        {isChallenged && (
                          <span className="text-[8px] bg-amber-500/20 border border-amber-500/30 text-amber-400 px-1.5 py-0.5 rounded font-black tracking-wider uppercase animate-pulse">
                            Challenged
                          </span>
                        )}
                        {chore.status === "completed" && (
                          <span className="text-[8px] bg-green-500/20 border border-green-500/30 text-green-400 px-1.5 py-0.5 rounded font-bold uppercase">
                            Done
                          </span>
                        )}
                        {isOverdue && (
                          <span className="text-[8px] bg-red-500/20 border border-red-500/30 text-red-400 px-1.5 py-0.5 rounded font-black tracking-wider uppercase">
                            Overdue
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1.5">{chore.description}</p>
                      
                      <div className="flex items-center gap-3 mt-3 text-[10px] text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1 text-white/80">
                          <User className="w-3 h-3 text-primary" /> {chore.assignedTo.name}
                        </span>
                        <span>•</span>
                        <span>Due: {new Date(chore.dueDate).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions / Buttons depending on status */}
                  <div className="mt-4 pt-3 border-t border-white/5 flex justify-between items-center flex-wrap gap-2">
                    {chore.status === "pending" && (
                      <>
                        <span className="text-[10px] text-muted-foreground">Requires verification</span>
                        <button
                          onClick={() => handleVerifyChore(chore._id)}
                          className="py-1 px-3 rounded-lg bg-green-500/10 border border-green-500/30 hover:bg-green-500/20 text-green-400 text-[10px] font-bold active:scale-95 transition-all"
                        >
                          Verify Completed
                        </button>
                      </>
                    )}

                    {chore.status === "completed" && (
                      <>
                        <span className="text-[9px] text-muted-foreground">
                          Verified by {chore.verifiedBy?.name}
                        </span>
                        <button
                          onClick={() => handleInitiateChallenge(chore._id)}
                          className="py-1 px-3 rounded-lg bg-rose-500/15 border border-rose-500/25 hover:bg-rose-500/25 text-rose-400 text-[10px] font-bold active:scale-95 transition-all flex items-center gap-0.5"
                        >
                          <Flame className="w-3 h-3 text-rose-400 animate-bounce" /> Challenge
                        </button>
                      </>
                    )}

                    {isChallenged && (
                      <div className="w-full">
                        <div className="flex items-center justify-between text-xs mb-3 text-white/95 bg-white/[0.02] p-2 rounded-lg border border-white/5">
                          <span className="flex items-center gap-1 font-semibold text-amber-300">
                            <Vote className="w-3.5 h-3.5" /> Challenged by {chore.challengedBy?.name}
                          </span>
                          <span className="text-[10px] font-bold text-muted-foreground">
                            Votes: {chore.challengeVotes.filter(v => v.vote === "disagree").length} Disagree | {chore.challengeVotes.filter(v => v.vote === "agree").length} Agree
                          </span>
                        </div>

                        {hasVoted ? (
                          <p className="text-center text-[10px] text-muted-foreground italic py-1.5">You have cast your vote on this challenge.</p>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleCastVote(chore._id, "agree")}
                              className="flex-1 py-1.5 rounded-lg border border-green-500/20 bg-green-500/5 hover:bg-green-500/10 text-[10px] font-bold text-green-400 text-center active:scale-95 transition-all"
                            >
                              👍 Chore is Done
                            </button>
                            <button
                              onClick={() => handleCastVote(chore._id, "disagree")}
                              className="flex-1 py-1.5 rounded-lg border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 text-[10px] font-bold text-rose-400 text-center active:scale-95 transition-all"
                            >
                              👎 Performer Lied
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL: Add Chore */}
      {showAddChore && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="glass w-full max-w-sm rounded-2xl p-6 border border-white/10 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-lg font-bold text-white mb-4">Schedule a Duty</h3>
            <form onSubmit={handleAddChoreSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Chore Title</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Wash Bathroom, Clean Hall"
                  className="w-full px-4 py-2.5 rounded-xl glass-input text-white text-sm outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Chore Type (Skill)</label>
                <select
                  required
                  value={newSkill}
                  onChange={(e) => {
                    setNewSkill(e.target.value);
                    setNewAssignedTo(""); // Reset assignment since skill changed
                  }}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#121214] border border-white/10 text-white text-sm outline-none focus:border-primary"
                >
                  <option value="cleaning">🧹 Cleaning</option>
                  <option value="cooking">🍳 Cooking</option>
                  <option value="laundry">🧺 Laundry</option>
                  <option value="grocery runs">🛒 Grocery Runs</option>
                  <option value="trash">🗑 Trash Duty</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Assign First Flatmate</label>
                <p className="text-[9px] text-muted-foreground mb-1.5">Only members with {newSkill} capability are shown:</p>
                <select
                  required
                  value={newAssignedTo}
                  onChange={(e) => setNewAssignedTo(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#121214] border border-white/10 text-white text-sm outline-none focus:border-primary"
                >
                  <option value="">Select flatmate</option>
                  {flatmates
                    .filter((f) => f.capabilities.includes(newSkill))
                    .map((f) => (
                      <option key={f._id} value={f._id}>{f.name}</option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Due Date</label>
                <input
                  type="date"
                  required
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#121214] border border-white/10 text-white text-sm outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Description</label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Optional details..."
                  className="w-full px-4 py-2.5 rounded-xl glass-input text-white text-sm outline-none resize-none h-16"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddChore(false)}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-white font-semibold text-xs active:scale-95 transition-all text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-white font-bold text-xs active:scale-95 transition-all text-center disabled:opacity-50"
                >
                  Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Swap Chore */}
      {showSwapModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="glass w-full max-w-sm rounded-2xl p-6 border border-white/10 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-1">
              <ArrowLeftRight className="w-5 h-5 text-primary" /> Swap Assignment
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Select a roommate to swap this task with. They must have the "{activeSwapChore?.skill}" capability.
            </p>

            {eligibleSwapPartners.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-xs text-rose-400">No other flatmates possess this capability.</p>
                <button
                  type="button"
                  onClick={() => setShowSwapModal(false)}
                  className="mt-4 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white"
                >
                  Back
                </button>
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1 no-scrollbar">
                {eligibleSwapPartners.map((partner) => (
                  <button
                    key={partner._id}
                    onClick={() => handleRequestSwap(partner._id)}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-white/5 bg-white/[0.01] hover:bg-white/[0.03] active:scale-98 transition-all text-left text-xs"
                  >
                    <div>
                      <h4 className="font-bold text-white">{partner.name}</h4>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Points: {partner.points}</p>
                    </div>
                    <span className="text-[10px] bg-primary/20 text-primary px-2.5 py-1 rounded font-bold">Request Swap</span>
                  </button>
                ))}
                
                <button
                  type="button"
                  onClick={() => setShowSwapModal(false)}
                  className="w-full mt-3 py-2.5 rounded-xl border border-white/10 text-white font-semibold text-xs active:scale-95 transition-all text-center"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
