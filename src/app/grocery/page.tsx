"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { 
  ShoppingBag, Plus, Trash2, CheckCircle2, Shield, UserX,
  Link, Link2Off, Sparkles, AlertCircle, ShoppingCart, Check, User
} from "lucide-react";
import { getPusherClient } from "@/lib/pusher-client";

interface GroceryItemType {
  _id: string;
  name: string;
  quantity: string;
  category: string;
  addedBy: { _id: string; name: string };
  purchased: boolean;
}

interface FlatmateType {
  _id: string;
  name: string;
  email: string;
  role: string;
  points: number;
}

export default function GroceryAndAdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Tabs: "grocery" or "admin"
  const [activeTab, setActiveTab] = useState<"grocery" | "admin">("grocery");

  const [groceryItems, setGroceryItems] = useState<GroceryItemType[]>([]);
  const [flatmates, setFlatmates] = useState<FlatmateType[]>([]);
  const [inviteActive, setInviteActive] = useState(true);
  const [inviteCode, setInviteCode] = useState("");

  // Grocery Form States
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [category, setCategory] = useState("groceries");

  // Selected items to purchase in bulk
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // 1. Fetch groceries
      const gRes = await fetch("/api/grocery");
      const gData = await gRes.json();
      if (!gRes.ok) throw new Error(gData.error || "Failed to load groceries");
      setGroceryItems(gData.items);

      // 2. Fetch flat sync details (flatmates & invite status)
      const fRes = await fetch("/api/dashboard/sync");
      const fData = await fRes.json();
      if (fRes.ok) {
        setFlatmates(fData.flatmates);
        setInviteActive(fData.inviteActive);
        setInviteCode(fData.inviteCode);
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

        channel.bind("grocery-added", () => fetchData(true));
        channel.bind("grocery-purchased", () => fetchData(true));
        channel.bind("invite-status-toggled", () => fetchData(true));
        channel.bind("roommate-kicked", () => fetchData(true));

        return () => {
          channel.unbind_all();
          pusher.unsubscribe(channelName);
          clearInterval(interval);
        };
      }

      return () => clearInterval(interval);
    }
  }, [status, session]);

  const handleAddGrocery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !quantity) return;
    setActionLoading(true);
    setError("");

    try {
      const res = await fetch("/api/grocery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, quantity, category }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add item");

      setName("");
      setQuantity("");
      setCategory("groceries");
      fetchData(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePurchaseSelected = async () => {
    if (selectedItems.length === 0) return;
    setActionLoading(true);
    setError("");

    try {
      const res = await fetch("/api/grocery/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemIds: selectedItems }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to buy groceries");

      setSelectedItems([]);
      fetchData(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleInvite = async () => {
    setError("");
    try {
      const res = await fetch("/api/flat/invite/toggle", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to toggle link");
      fetchData(true);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleKickMember = async (memberId: string) => {
    if (!confirm("Are you sure you want to remove this flatmate from your flat?")) return;
    setError("");
    try {
      const res = await fetch("/api/flat/members/kick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to kick roommate");
      fetchData(true);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const toggleSelectItem = (itemId: string) => {
    setSelectedItems((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  };

  const getCategoryEmoji = (cat: string) => {
    switch (cat) {
      case "groceries": return "🍉";
      case "vegetables": return "🥦";
      case "household": return "🧻";
      case "snacks": return "🍿";
      default: return "📦";
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#030303]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground text-sm">Opening flat inventory...</p>
        </div>
      </div>
    );
  }

  const isAdmin = (session?.user as any)?.role === "admin";
  const userId = (session?.user as any)?.id;

  return (
    <div className="flex-1 px-4 py-6 overflow-y-auto no-scrollbar pb-24">
      {/* Tab Switcher */}
      <div className="flex bg-white/5 rounded-2xl p-1 border border-white/5 mb-6">
        <button
          onClick={() => {
            setError("");
            setActiveTab("grocery");
          }}
          className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            activeTab === "grocery" ? "bg-white/[0.08] text-white" : "text-muted-foreground hover:text-white"
          }`}
        >
          <ShoppingCart className="w-4 h-4" /> Shopping List
        </button>
        {isAdmin && (
          <button
            onClick={() => {
              setError("");
              setActiveTab("admin");
            }}
            className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "admin" ? "bg-white/[0.08] text-white animate-pulse" : "text-muted-foreground hover:text-white"
            }`}
          >
            <Shield className="w-4 h-4 text-primary" /> Admin Panel
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs text-center animate-shake">
          {error}
        </div>
      )}

      {activeTab === "grocery" && (
        <div className="space-y-6">
          {/* Add grocery item form */}
          <div className="glass rounded-2xl p-4 border border-white/5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-primary" />
              Add Grocery Item
            </h3>
            <form onSubmit={handleAddGrocery} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Item name (e.g. Milk, Eggs)"
                  className="w-full px-3.5 py-2.5 rounded-xl glass-input text-white text-xs outline-none"
                />
                <input
                  type="text"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="Quantity (e.g. 2L, 1 Dozen)"
                  className="w-full px-3.5 py-2.5 rounded-xl glass-input text-white text-xs outline-none"
                />
              </div>

              <div className="flex gap-2">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#121214] border border-white/10 text-white text-xs outline-none focus:border-primary"
                >
                  <option value="groceries">🍉 Groceries</option>
                  <option value="vegetables">🥦 Vegetables</option>
                  <option value="household">🧻 Household</option>
                  <option value="snacks">🍿 Snacks</option>
                  <option value="other">📦 Other</option>
                </select>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2.5 rounded-xl bg-primary text-white font-bold text-xs hover:bg-primary/95 active:scale-95 transition-all disabled:opacity-50"
                >
                  Add Item
                </button>
              </div>
            </form>
          </div>

          {/* Active shopping list */}
          <div className="glass rounded-2xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">🛒 Active Cart Items</h3>
              {selectedItems.length > 0 && (
                <button
                  onClick={handlePurchaseSelected}
                  disabled={actionLoading}
                  className="text-[10px] bg-green-500/20 border border-green-500/30 text-green-400 px-3 py-1 rounded-lg font-bold flex items-center gap-1 active:scale-95 transition-all disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Buy Selected ({selectedItems.length})
                </button>
              )}
            </div>

            {groceryItems.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-6">All stocked up! No pending grocery runs.</p>
            ) : (
              <div className="space-y-2.5">
                {groceryItems.map((item) => {
                  const isSelected = selectedItems.includes(item._id);
                  return (
                    <button
                      key={item._id}
                      onClick={() => toggleSelectItem(item._id)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                        isSelected
                          ? "bg-primary/10 border-primary"
                          : "bg-white/[0.01] border-white/5 hover:bg-white/[0.02]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded flex items-center justify-center border ${
                          isSelected ? "bg-primary border-primary" : "border-white/20"
                        }`}>
                          {isSelected && <Check className="w-3 h-3 text-white stroke-[3px]" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-1">
                            <span className="text-xs">{getCategoryEmoji(item.category)}</span>
                            <h4 className="text-xs font-bold text-white leading-snug">{item.name}</h4>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">Quantity: {item.quantity}</p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[9px] text-muted-foreground block">Added by: {item.addedBy.name}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "admin" && isAdmin && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Invite Code Control */}
          <div className="glass rounded-2xl p-4 border border-white/5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">🚪 Invitation Link</h3>
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.01] border border-white/5 gap-4">
              <div>
                <h4 className="text-xs font-bold text-white">Invite Link Status</h4>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {inviteActive 
                    ? "Link is currently ACTIVE. Roommates can join." 
                    : "Link is DEACTIVATED. New signups are blocked."
                  }
                </p>
              </div>
              <button
                onClick={handleToggleInvite}
                className={`py-1.5 px-3 rounded-lg border text-[10px] font-bold flex items-center gap-1 active:scale-95 transition-all ${
                  inviteActive
                    ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                    : "bg-green-500/10 border-green-500/30 text-green-400"
                }`}
              >
                {inviteActive ? (
                  <>
                    <Link2Off className="w-3.5 h-3.5" /> Deactivate Link
                  </>
                ) : (
                  <>
                    <Link className="w-3.5 h-3.5" /> Activate Link
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Flatmates Management (Kick Panel) */}
          <div className="glass rounded-2xl p-4 border border-white/5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">👥 Manage Roommates</h3>
            <div className="space-y-2.5">
              {flatmates.map((member) => {
                const isMemberMe = member._id === userId;
                return (
                  <div key={member._id} className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-white/[0.01]">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-xs font-bold text-muted-foreground uppercase">
                        {member.name.slice(0, 2)}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white flex items-center gap-1">
                          {member.name} {isMemberMe && "(You)"}
                          {member.role === "admin" && (
                            <span className="text-[7px] bg-primary/25 text-primary border border-primary/30 px-1 rounded uppercase font-bold">Admin</span>
                          )}
                        </h4>
                        <p className="text-[9px] text-muted-foreground mt-0.5">Points: {member.points}</p>
                      </div>
                    </div>

                    {!isMemberMe && (
                      <button
                        onClick={() => handleKickMember(member._id)}
                        className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/25 active:scale-90 transition-all"
                        title="Kick from Flat"
                      >
                        <UserX className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
