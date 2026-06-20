"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { 
  IndianRupee, Plus, AlertCircle, Calendar, Sparkles, Check, 
  ArrowUpRight, ArrowDownLeft, Bell, Wallet, History
} from "lucide-react";
import { getPusherClient } from "@/lib/pusher-client";

interface SplitType {
  userId: { _id: string; name: string };
  amount: number;
  paid: boolean;
}

interface BillType {
  _id: string;
  description: string;
  amount: number;
  category: string;
  paidBy: { _id: string; name: string };
  splitType: "equal" | "custom";
  splits: SplitType[];
  createdAt: string;
}

interface DebtUser {
  userId: string;
  name: string;
  amount: number;
}

export default function BillsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [bills, setBills] = useState<BillType[]>([]);
  const [iOwe, setIOwe] = useState<DebtUser[]>([]);
  const [uOwe, setUOwe] = useState<DebtUser[]>([]);
  const [flatmates, setFlatmates] = useState<any[]>([]);

  // Modals & form state
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("groceries");
  const [splitType, setSplitType] = useState<"equal" | "custom">("equal");

  // Splits tracking state
  // key: userId, value: amount or active checked
  const [equalCheckedUsers, setEqualCheckedUsers] = useState<string[]>([]);
  const [customSplits, setCustomSplits] = useState<{ [userId: string]: string }>({});

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/bills");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load expenses");

      setBills(data.bills);
      setIOwe(data.iOwe);
      setUOwe(data.uOwe);

      const fmRes = await fetch("/api/dashboard/sync");
      const fmData = await fmRes.json();
      if (fmRes.ok) {
        setFlatmates(fmData.flatmates);
        // Default equal splits to check everyone
        if (equalCheckedUsers.length === 0) {
          setEqualCheckedUsers(fmData.flatmates.map((f: any) => f._id));
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to sync ledger");
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

        channel.bind("bill-added", () => fetchData(true));
        channel.bind("bills-settled", () => fetchData(true));
        channel.bind("payment-nudge", (data: any) => {
          if (data.toUserId === userId) {
            alert(`🔔 Nudge from ${data.from}: Reminder to pay ₹${data.amount}!`);
          }
        });

        return () => {
          channel.unbind_all();
          pusher.unsubscribe(channelName);
          clearInterval(interval);
        };
      }

      return () => clearInterval(interval);
    }
  }, [status, session]);

  const handleSettle = async (targetUserId: string) => {
    setError("");
    try {
      const res = await fetch("/api/bills/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId }),
      });
      if (!res.ok) throw new Error("Failed to settle");
      fetchData(true);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRemind = async (targetUserId: string, amt: number) => {
    setError("");
    try {
      const res = await fetch("/api/bills/remind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId, amount: amt }),
      });
      if (res.ok) {
        alert("Payment reminder notification sent successfully!");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const totalAmt = Number(amount);
    if (!desc || isNaN(totalAmt) || totalAmt <= 0) {
      setError("Please enter a valid description and amount.");
      return;
    }

    let finalSplits: Array<{ userId: string; amount: number }> = [];

    if (splitType === "equal") {
      if (equalCheckedUsers.length === 0) {
        setError("You must select at least one roommate to split with.");
        return;
      }
      const share = Math.round((totalAmt / equalCheckedUsers.length) * 100) / 100;
      finalSplits = equalCheckedUsers.map((uid) => ({ userId: uid, amount: share }));
    } else {
      // Custom split
      let customSum = 0;
      const parsedSplits = flatmates.map((f) => {
        const val = Number(customSplits[f._id] || 0);
        customSum += val;
        return { userId: f._id, amount: val };
      });

      const diff = Math.abs(customSum - totalAmt);
      if (diff > 0.5) {
        setError(`Custom splits total (₹${customSum}) must match the total bill amount (₹${totalAmt})`);
        return;
      }
      finalSplits = parsedSplits.filter((s) => s.amount > 0);
    }

    setActionLoading(true);

    try {
      const res = await fetch("/api/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: desc,
          amount: totalAmt,
          category,
          splitType,
          splits: finalSplits,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to log bill");

      // Reset Form
      setDesc("");
      setAmount("");
      setCategory("groceries");
      setSplitType("equal");
      setCustomSplits({});
      setEqualCheckedUsers(flatmates.map((f) => f._id));
      setShowAddExpense(false);
      fetchData(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const toggleEqualChecked = (userId: string) => {
    setEqualCheckedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleCustomSplitChange = (userId: string, val: string) => {
    setCustomSplits((prev) => ({ ...prev, [userId]: val }));
  };

  const getCategoryEmoji = (cat: string) => {
    switch (cat) {
      case "groceries": return "🛒";
      case "utilities": return "⚡";
      case "rent": return "🏠";
      default: return "💸";
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#030303]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground text-sm">Syncing ledger balances...</p>
        </div>
      </div>
    );
  }

  const userId = (session?.user as any)?.id;
  const noDebts = iOwe.length === 0 && uOwe.length === 0;

  return (
    <div className="flex-1 px-4 py-6 overflow-y-auto no-scrollbar pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <span className="text-[10px] text-primary uppercase font-bold tracking-widest">Shared Ledger</span>
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            <IndianRupee className="w-6 h-6 text-primary" /> Bills & Split
          </h2>
        </div>
        <button
          onClick={() => {
            setError("");
            setShowAddExpense(true);
          }}
          className="p-2.5 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 active:scale-95 transition-all flex items-center gap-1 shadow-lg shadow-primary/20"
        >
          <Plus className="w-4 h-4" /> Add Bill
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs text-center">
          {error}
        </div>
      )}

      {/* IOwe / UOwe Matrix Summary */}
      <div className="glass rounded-2xl p-4 mb-6">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-1.5">
          <Wallet className="w-4 h-4 text-primary" />
          Flat Ledger Balance
        </h3>

        {noDebts ? (
          <div className="text-center py-4 text-xs text-muted-foreground">
            🤝 All settled! No outstanding balances in the flat.
          </div>
        ) : (
          <div className="space-y-4">
            {/* I OWE */}
            {iOwe.map((item) => (
              <div key={item.userId} className="flex items-center justify-between p-3.5 rounded-xl bg-rose-500/[0.02] border border-rose-500/10">
                <div className="flex items-center gap-2">
                  <ArrowDownLeft className="w-4 h-4 text-rose-400" />
                  <span className="text-xs text-white/90">
                    You owe <strong>{item.name}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-black text-rose-400">₹{item.amount}</span>
                  <button
                    onClick={() => handleSettle(item.userId)}
                    className="py-1 px-3 rounded-lg bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-400 text-[10px] font-bold active:scale-95 transition-all"
                  >
                    Settle Up
                  </button>
                </div>
              </div>
            ))}

            {/* U OWE */}
            {uOwe.map((item) => (
              <div key={item.userId} className="flex items-center justify-between p-3.5 rounded-xl bg-green-500/[0.02] border border-green-500/10">
                <div className="flex items-center gap-2">
                  <ArrowUpRight className="w-4 h-4 text-green-400" />
                  <span className="text-xs text-white/90">
                    <strong>{item.name}</strong> owes you
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-black text-green-400">₹{item.amount}</span>
                  <button
                    onClick={() => handleRemind(item.userId, item.amount)}
                    className="py-1 px-2.5 rounded-lg bg-green-500/10 border border-green-500/20 hover:bg-green-500/20 text-green-400 text-[10px] font-bold active:scale-95 transition-all flex items-center gap-0.5"
                  >
                    <Bell className="w-3 h-3" /> Nudge
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* EXPENSES LIST */}
      <div className="glass rounded-2xl p-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-1.5">
          <History className="w-4 h-4 text-primary" />
          Expense History
        </h3>

        {bills.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-4">No logged expenses.</p>
        ) : (
          <div className="space-y-3.5">
            {bills.map((bill) => {
              const isPayer = bill.paidBy._id === userId;
              const payerName = isPayer ? "You" : bill.paidBy.name;
              
              // Find if splits are fully settled
              const allSplitsPaid = bill.splits.every((s) => s.paid);

              return (
                <div key={bill._id} className="p-3.5 rounded-xl border border-white/5 bg-white/[0.005] flex flex-col gap-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm">{getCategoryEmoji(bill.category)}</span>
                        <h4 className="text-xs font-bold text-white leading-snug">{bill.description}</h4>
                        {allSplitsPaid ? (
                          <span className="text-[7.5px] bg-green-500/10 border border-green-500/25 text-green-400 px-1.5 py-0.2 rounded uppercase font-bold">Settled</span>
                        ) : (
                          <span className="text-[7.5px] bg-amber-500/10 border border-amber-500/25 text-amber-400 px-1.5 py-0.2 rounded uppercase font-bold">Unpaid</span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Paid by {payerName} • ₹{bill.amount}
                      </p>
                    </div>
                    <span className="text-xs font-black text-white">₹{bill.amount}</span>
                  </div>

                  <div className="border-t border-white/5 pt-2 flex items-center justify-between text-[9px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {new Date(bill.createdAt).toLocaleDateString()}
                    </span>
                    <span className="truncate max-w-[180px]">
                      Split: {bill.splitType === "equal" ? "Equal" : "Custom"} ({bill.splits.length} people)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL: Add Expense */}
      {showAddExpense && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="glass w-full max-w-sm rounded-2xl p-6 border border-white/10 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-lg font-bold text-white mb-4">Log Expense</h3>
            <form onSubmit={handleAddExpenseSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Description</label>
                <input
                  type="text"
                  required
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="e.g. Grocery restock, Gas bill"
                  className="w-full px-4 py-2.5 rounded-xl glass-input text-white text-sm outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-2.5 rounded-xl glass-input text-white text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#121214] border border-white/10 text-white text-sm outline-none focus:border-primary"
                  >
                    <option value="groceries">🛒 Groceries</option>
                    <option value="utilities">⚡ Utilities</option>
                    <option value="rent">🏠 Rent</option>
                    <option value="other">💸 Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Split Type</label>
                <div className="flex bg-white/5 rounded-xl p-1 border border-white/5 mb-3">
                  <button
                    type="button"
                    onClick={() => setSplitType("equal")}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                      splitType === "equal" ? "bg-white/[0.08] text-white" : "text-muted-foreground hover:text-white"
                    }`}
                  >
                    Split Equally
                  </button>
                  <button
                    type="button"
                    onClick={() => setSplitType("custom")}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                      splitType === "custom" ? "bg-white/[0.08] text-white" : "text-muted-foreground hover:text-white"
                    }`}
                  >
                    Custom Split
                  </button>
                </div>

                {/* EQUAL SPLITS SELECTOR */}
                {splitType === "equal" && (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1 no-scrollbar border border-white/5 p-2 rounded-xl bg-white/[0.01]">
                    <p className="text-[10px] text-muted-foreground mb-2">Select flatmates to split with:</p>
                    {flatmates.map((f) => {
                      const isChecked = equalCheckedUsers.includes(f._id);
                      return (
                        <button
                          type="button"
                          key={f._id}
                          onClick={() => toggleEqualChecked(f._id)}
                          className={`w-full flex items-center justify-between p-2 rounded-lg border text-xs text-left transition-all ${
                            isChecked
                              ? "bg-primary/10 border-primary text-white"
                              : "bg-transparent border-white/5 text-muted-foreground hover:bg-white/5"
                          }`}
                        >
                          <span>{f.name}</span>
                          <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border ${
                            isChecked ? "bg-primary border-primary" : "border-white/20"
                          }`}>
                            {isChecked && <Check className="w-2.5 h-2.5 text-white stroke-[3px]" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* CUSTOM SPLITS INPUTS */}
                {splitType === "custom" && (
                  <div className="space-y-2.5 max-h-36 overflow-y-auto pr-1 no-scrollbar border border-white/5 p-2 rounded-xl bg-white/[0.01]">
                    <p className="text-[10px] text-muted-foreground mb-2">Enter custom share for each roommate:</p>
                    {flatmates.map((f) => (
                      <div key={f._id} className="flex items-center justify-between gap-3">
                        <span className="text-xs text-white/90 truncate flex-1">{f.name}</span>
                        <div className="relative max-w-[80px]">
                          <span className="absolute left-2.5 top-2 text-[10px] text-muted-foreground">₹</span>
                          <input
                            type="number"
                            placeholder="0"
                            value={customSplits[f._id] || ""}
                            onChange={(e) => handleCustomSplitChange(f._id, e.target.value)}
                            className="w-full pl-6 pr-2 py-1 rounded-lg glass-input text-white text-xs outline-none text-right"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddExpense(false)}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-white font-semibold text-xs active:scale-95 transition-all text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-white font-bold text-xs active:scale-95 transition-all text-center disabled:opacity-50"
                >
                  Split Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
