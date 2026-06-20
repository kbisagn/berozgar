"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { 
  Sparkles, Award, AlertCircle, Compass, ListTodo, PlusCircle, 
  Trash2, User, Copy, Check, Megaphone, Edit3, Plus, LogOut,
  ShoppingBag
} from "lucide-react";
import { getPusherClient } from "@/lib/pusher-client";

interface Flatmate {
  _id: string;
  name: string;
  email: string;
  points: number;
  capabilities: string[];
  role: string;
  tier: string;
}

interface LyingItem {
  _id: string;
  description: string;
  responsiblePerson: { _id: string; name: string };
  loggedBy: { _id: string; name: string };
  createdAt: string;
  escalated: boolean;
}

interface StoreTrip {
  _id: string;
  userId: { _id: string; name: string };
  createdAt: string;
}

interface Announcement {
  _id: string;
  content: string;
  senderId: { name: string };
  createdAt: string;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [flatName, setFlatName] = useState("Loading Flat...");
  const [inviteCode, setInviteCode] = useState("");
  const [inviteActive, setInviteActive] = useState(true);
  const [rules, setRules] = useState<string[]>([]);
  const [adminId, setAdminId] = useState("");
  const [flatmates, setFlatmates] = useState<Flatmate[]>([]);
  const [openLyingItems, setOpenLyingItems] = useState<LyingItem[]>([]);
  const [activeStoreTrips, setActiveStoreTrips] = useState<StoreTrip[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  // UI state
  const [copied, setCopied] = useState(false);
  const [leaderboardTab, setLeaderboardTab] = useState<"all" | "weekly">("all");
  const [showLogLyingModal, setShowLogLyingModal] = useState(false);
  const [lyingDesc, setLyingDesc] = useState("");
  const [lyingTarget, setLyingTarget] = useState("");
  
  // Rule editing
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [editingRules, setEditingRules] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Check Auth
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  // Fetch Dashboard Sync Data
  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/dashboard/sync");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load dashboard data");

      setFlatName(data.flatName);
      setInviteCode(data.inviteCode);
      setInviteActive(data.inviteActive);
      setRules(data.rules);
      setAdminId(data.adminId);
      setFlatmates(data.flatmates);
      setOpenLyingItems(data.openLyingItems);
      setActiveStoreTrips(data.activeStoreTrips);
      setAnnouncements(data.announcements);
      setError("");
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated" && (session?.user as any)?.flatId) {
      fetchData();

      // Fallback Short Polling (sync data every 5 seconds)
      const interval = setInterval(() => {
        fetchData(true);
      }, 5000);

      // Pusher Integration
      const pusher = getPusherClient();
      const flatId = (session.user as any).flatId;
      
      if (pusher && flatId) {
        const channelName = `flat-${flatId}`;
        const channel = pusher.subscribe(channelName);

        channel.bind("lying-item-logged", () => fetchData(true));
        channel.bind("lying-item-resolved", () => fetchData(true));
        channel.bind("store-trip-started", () => fetchData(true));
        channel.bind("store-trip-ended", () => fetchData(true));
        channel.bind("rules-updated", () => fetchData(true));

        return () => {
          channel.unbind_all();
          pusher.unsubscribe(channelName);
          clearInterval(interval);
        };
      }

      return () => clearInterval(interval);
    }
  }, [status, session]);

  const copyInviteLink = () => {
    if (!inviteCode) return;
    const url = `${window.location.origin}/join/${inviteCode}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleStoreTrip = async () => {
    try {
      const res = await fetch("/api/store-trip/toggle", { method: "POST" });
      if (res.ok) {
        fetchData(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogLyingItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lyingDesc || !lyingTarget) return;
    setActionLoading(true);

    try {
      const res = await fetch("/api/lying-item/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: lyingDesc, responsiblePersonId: lyingTarget }),
      });
      if (res.ok) {
        setLyingDesc("");
        setLyingTarget("");
        setShowLogLyingModal(false);
        fetchData(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResolveLyingItem = async (itemId: string) => {
    try {
      const res = await fetch("/api/lying-item/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });
      if (res.ok) {
        fetchData(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateRules = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await fetch("/api/flat/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules: editingRules }),
      });
      if (res.ok) {
        setShowRulesModal(false);
        fetchData(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const getTierBadge = (points: number) => {
    if (points >= 100) return { label: "Flat Hero", bg: "bg-green-500/10 border-green-500/30 text-green-400" };
    if (points >= 50) return { label: "Decent Human", bg: "bg-indigo-500/10 border-indigo-500/30 text-indigo-400" };
    if (points >= 0) return { label: "Trying Their Best", bg: "bg-amber-500/10 border-amber-500/30 text-amber-400" };
    return { label: "The Menace", bg: "bg-rose-500/10 border-rose-500/30 text-rose-400 animate-pulse" };
  };

  const checkIsEscalated = (createdAt: string) => {
    const elapsedMs = Date.now() - new Date(createdAt).getTime();
    // Escalation kicks in after 6 hours, or 3 minutes for testing
    const hours = elapsedMs / (1000 * 60 * 60);
    const minutes = elapsedMs / (1000 * 60);
    return hours >= 6 || minutes >= 3;
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#030303]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground text-sm">Synchronizing dashboard...</p>
        </div>
      </div>
    );
  }

  const currentUser = flatmates.find((f) => f._id === (session?.user as any)?.id);
  const isUserHeadingToStore = activeStoreTrips.some((t) => t.userId._id === (session?.user as any)?.id);
  const isAdmin = (session?.user as any)?.role === "admin";

  return (
    <div className="flex-1 px-4 py-6 overflow-y-auto no-scrollbar pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <span className="text-[10px] text-primary uppercase font-bold tracking-widest">My Flat</span>
          <h2 className="text-2xl font-black text-white">{flatName}</h2>
        </div>
        <button
          onClick={() => signOut()}
          className="p-2.5 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] text-rose-400 active:scale-95 transition-all"
          title="Logout"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>

      {/* Profile summary & invite code */}
      <div className="glass rounded-2xl p-4 mb-6 relative overflow-hidden">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/20 border border-primary/30 rounded-xl flex items-center justify-center text-primary font-bold text-lg">
            {currentUser?.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-white text-sm">{currentUser?.name}</h4>
              <span className={`text-[9px] px-2 py-0.5 rounded-full border ${getTierBadge(currentUser?.points || 0).bg}`}>
                {getTierBadge(currentUser?.points || 0).label}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">Points: <span className="text-primary font-bold">{currentUser?.points}</span></p>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Invite Link</p>
            <p className="text-xs text-white/70 truncate mt-0.5">{window.location.origin}/join/{inviteCode}</p>
          </div>
          <button
            onClick={copyInviteLink}
            className="py-1.5 px-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-xs text-white flex items-center gap-1 active:scale-95 transition-all"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      {/* Heading to store notice */}
      <div className="mb-6">
        <button
          onClick={handleToggleStoreTrip}
          className={`w-full p-4 rounded-2xl border transition-all duration-200 active:scale-98 flex items-center justify-between text-left ${
            isUserHeadingToStore
              ? "bg-green-500/10 border-green-500/30 text-green-400"
              : "bg-white/[0.02] border-white/5 text-muted-foreground hover:bg-white/[0.04]"
          }`}
        >
          <div className="flex items-center gap-3">
            <ShoppingBag className={`w-5 h-5 ${isUserHeadingToStore ? "text-green-400 animate-bounce" : "text-muted-foreground"}`} />
            <div>
              <h4 className="text-sm font-bold text-white">"I'm heading to the store"</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isUserHeadingToStore ? "You are active. Click to end trip." : "Tap to alert flatmates to add groceries!"}
              </p>
            </div>
          </div>
          <div className={`w-3.5 h-3.5 rounded-full ${isUserHeadingToStore ? "bg-green-500 animate-ping" : "bg-white/10"}`} />
        </button>

        {activeStoreTrips.filter(t => t.userId._id !== currentUser?._id).map((trip) => (
          <div key={trip._id} className="mt-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center justify-between animate-pulse">
            <span>🛒 <strong>{trip.userId.name}</strong> is heading to the store! Add items quickly!</span>
            <button 
              onClick={() => router.push("/chat")}
              className="text-[10px] bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 rounded text-amber-200"
            >
              Add Item
            </button>
          </div>
        ))}
      </div>

      {/* Pinned Announcements */}
      {announcements.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2.5 flex items-center gap-1.5">
            <Megaphone className="w-3.5 h-3.5 text-primary" />
            Flat Announcements
          </h3>
          <div className="space-y-2">
            {announcements.map((ann) => (
              <div key={ann._id} className="glass p-3 rounded-xl border border-primary/20 bg-primary/[0.01]">
                <p className="text-xs text-white/90 leading-relaxed font-medium">{ann.content}</p>
                <div className="flex items-center justify-between mt-2 text-[9px] text-muted-foreground">
                  <span>By {ann.senderId.name}</span>
                  <span>{new Date(ann.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Things Lying Around Tracker */}
      <div className="glass rounded-2xl p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">🧦 Things Left Around</h3>
          <button
            onClick={() => {
              setError("");
              setShowLogLyingModal(true);
            }}
            className="text-[10px] bg-primary/10 border border-primary/20 text-primary px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 hover:bg-primary/20 active:scale-95 transition-all"
          >
            <Plus className="w-3 h-3" /> Log Item
          </button>
        </div>

        {openLyingItems.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-4">All clean! No items left out.</p>
        ) : (
          <div className="space-y-3">
            {openLyingItems.map((item) => {
              const isEscalated = checkIsEscalated(item.createdAt);
              return (
                <div key={item._id} className={`p-3 rounded-xl border flex flex-col justify-between gap-3 ${
                  isEscalated ? "bg-red-500/[0.03] border-red-500/25" : "bg-white/[0.01] border-white/5"
                }`}>
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-white">{item.description}</h4>
                        {isEscalated && (
                          <span className="text-[8px] bg-rose-500/10 border border-rose-500/30 text-rose-400 px-1.5 py-0.5 rounded font-black tracking-wider uppercase animate-pulse">
                            Escalated
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Responsible: <strong className="text-white/80">{item.responsiblePerson.name}</strong> • Logged by: {item.loggedBy.name}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-white/5">
                    <span className="text-[9px] text-muted-foreground">
                      {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({new Date(item.createdAt).toLocaleDateString()})
                    </span>
                    {(item.responsiblePerson._id === currentUser?._id || isAdmin) ? (
                      <button
                        onClick={() => handleResolveLyingItem(item._id)}
                        className="py-1 px-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 text-[10px] font-bold active:scale-95 transition-all"
                      >
                        Resolve
                      </button>
                    ) : (
                      <span className="text-[9px] text-rose-400 font-bold bg-rose-500/5 px-2 py-0.5 rounded border border-rose-500/10">Pending</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Leaderboard */}
      <div className="glass rounded-2xl p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Award className="w-4 h-4 text-primary" />
            Flatmate Leaderboard
          </h3>
          <div className="flex bg-white/5 rounded-lg p-0.5 border border-white/5">
            <button
              onClick={() => setLeaderboardTab("all")}
              className={`text-[9px] px-2 py-1 rounded font-bold transition-all ${
                leaderboardTab === "all" ? "bg-white/10 text-white" : "text-muted-foreground hover:text-white"
              }`}
            >
              All Time
            </button>
            <button
              onClick={() => setLeaderboardTab("weekly")}
              className={`text-[9px] px-2 py-1 rounded font-bold transition-all ${
                leaderboardTab === "weekly" ? "bg-white/10 text-white" : "text-muted-foreground hover:text-white"
              }`}
            >
              Weekly
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {flatmates.map((member, idx) => {
            const displayPoints = leaderboardTab === "weekly" ? Math.max(0, member.points - 10) : member.points;
            const isCurrentUser = member._id === currentUser?._id;
            return (
              <div 
                key={member._id}
                className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                  isCurrentUser ? "bg-primary/5 border-primary/20" : "bg-white/[0.01] border-white/5"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-lg font-black text-xs flex items-center justify-center ${
                    idx === 0 ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" :
                    idx === 1 ? "bg-slate-300/20 text-slate-200 border border-slate-300/30" :
                    idx === 2 ? "bg-amber-700/20 text-amber-400 border border-amber-700/30" :
                    "bg-white/5 text-muted-foreground"
                  }`}>
                    {idx + 1}
                  </div>
                  <div>
                    <h4 className={`text-sm font-bold ${isCurrentUser ? "text-primary" : "text-white"}`}>
                      {member.name} {isCurrentUser && "(You)"}
                    </h4>
                    <p className="text-[9px] text-muted-foreground mt-0.5 capitalize">
                      {member.capabilities.join(", ") || "No specialties"}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-sm font-black text-white">{displayPoints} pts</span>
                  <p className={`text-[8px] mt-0.5 ${getTierBadge(displayPoints).bg} border px-1.5 py-0.2 rounded-full inline-block`}>
                    {getTierBadge(displayPoints).label}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Flat Rules */}
      <div className="glass rounded-2xl p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">📜 Flat Rules</h3>
          {isAdmin && (
            <button
              onClick={() => {
                setEditingRules([...rules]);
                setShowRulesModal(true);
              }}
              className="text-[10px] bg-white/5 border border-white/10 hover:bg-white/10 px-2 py-1 rounded-lg text-white font-bold flex items-center gap-1 active:scale-95 transition-all"
            >
              <Edit3 className="w-3 h-3" /> Edit
            </button>
          )}
        </div>

        {rules.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-4">No flat rules created yet.</p>
        ) : (
          <ul className="space-y-2.5">
            {rules.map((rule, idx) => (
              <li key={idx} className="flex gap-2 text-xs text-white/80">
                <span className="text-primary font-bold">{idx + 1}.</span>
                <span className="leading-relaxed">{rule}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* MODAL: Log Lying Item */}
      {showLogLyingModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="glass w-full max-w-sm rounded-2xl p-6 border border-white/10 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-lg font-bold text-white mb-4">Log left-out Item</h3>
            <form onSubmit={handleLogLyingItem} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Item Description</label>
                <input
                  type="text"
                  required
                  value={lyingDesc}
                  onChange={(e) => setLyingDesc(e.target.value)}
                  placeholder="e.g. Wet towel on the bed, Dirty socks"
                  className="w-full px-4 py-2.5 rounded-xl glass-input text-white text-sm outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Assign Menace</label>
                <select
                  required
                  value={lyingTarget}
                  onChange={(e) => setLyingTarget(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#121214] border border-white/10 text-white text-sm outline-none focus:border-primary"
                >
                  <option value="">Select responsible flatmate</option>
                  {flatmates.map((f) => (
                    <option key={f._id} value={f._id}>{f.name}</option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowLogLyingModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-white font-semibold text-xs active:scale-95 transition-all text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-white font-bold text-xs active:scale-95 transition-all text-center disabled:opacity-50"
                >
                  Log & Deduct
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Edit Rules */}
      {showRulesModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="glass w-full max-w-sm rounded-2xl p-6 border border-white/10 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-lg font-bold text-white mb-4">Edit Flat Rules</h3>
            <form onSubmit={handleUpdateRules} className="space-y-4">
              <div className="max-h-60 overflow-y-auto space-y-2 pr-1 no-scrollbar">
                {editingRules.map((rule, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <span className="text-xs text-primary font-bold">{idx + 1}.</span>
                    <input
                      type="text"
                      required
                      value={rule}
                      onChange={(e) => {
                        const nextRules = [...editingRules];
                        nextRules[idx] = e.target.value;
                        setEditingRules(nextRules);
                      }}
                      className="flex-1 px-3 py-1.5 rounded-lg glass-input text-white text-xs outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setEditingRules(editingRules.filter((_, i) => i !== idx))}
                      className="p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 active:scale-90 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setEditingRules([...editingRules, ""])}
                className="w-full py-2 border border-dashed border-white/15 rounded-xl hover:bg-white/[0.02] text-xs text-muted-foreground flex items-center justify-center gap-1 transition-all"
              >
                <Plus className="w-3.5 h-3.5" /> Add Rule
              </button>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowRulesModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-white font-semibold text-xs active:scale-95 transition-all text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-white font-bold text-xs active:scale-95 transition-all text-center disabled:opacity-50"
                >
                  Save Rules
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
