"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { 
  Utensils, Calendar, ChevronLeft, ChevronRight, Check, X,
  UserCheck, AlertCircle, Sparkles, Ban, Award
} from "lucide-react";
import { getPusherClient } from "@/lib/pusher-client";

interface MealRSVP {
  userId: { _id: string; name: string };
  status: "eating" | "skipping";
}

interface MealType {
  _id: string;
  cookId: { _id: string; name: string };
  date: string;
  mealDescription: string;
  portionCount: number;
  status: "active" | "cancelled" | "completed";
  rsvps: MealRSVP[];
}

export default function MealsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Date management: default is today (local YYYY-MM-DD)
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    return d.toLocaleDateString("en-CA"); // YYYY-MM-DD format local
  });

  const [meal, setMeal] = useState<MealType | null>(null);
  const [hasCookingCapability, setHasCookingCapability] = useState(false);
  const [flatmates, setFlatmates] = useState<any[]>([]);

  // Form states
  const [mealDescInput, setMealDescInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  // Completion modal state
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [noShows, setNoShows] = useState<string[]>([]); // array of userIds

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  // Determine user capabilities
  useEffect(() => {
    if (session?.user) {
      const caps = (session.user as any).capabilities || [];
      setHasCookingCapability(caps.includes("cooking"));
    }
  }, [session]);

  const fetchMealData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/meals?date=${selectedDate}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load meal");
      setMeal(data.meal);

      // fetch flatmates too
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
      fetchMealData();

      // Poll every 5s
      const interval = setInterval(() => fetchMealData(true), 5000);

      const pusher = getPusherClient();
      const flatId = (session.user as any).flatId;

      if (pusher && flatId) {
        const channelName = `flat-${flatId}`;
        const channel = pusher.subscribe(channelName);

        channel.bind("meal-announced", () => fetchMealData(true));
        channel.bind("meal-updated", () => fetchMealData(true));
        channel.bind("meal-rsvp-updated", () => fetchMealData(true));
        channel.bind("meal-cancelled", () => fetchMealData(true));
        channel.bind("meal-completed", () => fetchMealData(true));

        return () => {
          channel.unbind_all();
          pusher.unsubscribe(channelName);
          clearInterval(interval);
        };
      }

      return () => clearInterval(interval);
    }
  }, [selectedDate, status, session]);

  const handleAnnounceMeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mealDescInput) return;
    setActionLoading(true);
    setError("");

    try {
      const res = await fetch("/api/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mealDescription: mealDescInput, date: selectedDate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to announce meal");
      
      setMealDescInput("");
      fetchMealData(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRSVP = async (rsvpStatus: "eating" | "skipping") => {
    if (!meal) return;
    setError("");
    try {
      const res = await fetch("/api/meals/rsvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mealId: meal._id, rsvpStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "RSVP failed");
      fetchMealData(true);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCancelMeal = async () => {
    if (!meal) return;
    setError("");
    try {
      const res = await fetch("/api/meals/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mealId: meal._id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Cancellation failed");
      fetchMealData(true);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCompleteMealSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!meal) return;
    setActionLoading(true);
    setError("");

    try {
      const res = await fetch("/api/meals/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mealId: meal._id, noShowUserIds: noShows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to complete meal");

      setShowCompleteModal(false);
      setNoShows([]);
      fetchMealData(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const adjustDate = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toLocaleDateString("en-CA"));
  };

  const getMyRSVP = () => {
    if (!meal) return null;
    const userId = (session?.user as any)?.id;
    const myR = meal.rsvps.find((r) => r.userId._id === userId);
    return myR ? myR.status : null;
  };

  const toggleNoShow = (userId: string) => {
    setNoShows((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#030303]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground text-sm">Syncing menu planner...</p>
        </div>
      </div>
    );
  }

  const userId = (session?.user as any)?.id;
  const isMealCook = meal?.cookId._id === userId;
  const activeEaters = meal?.rsvps.filter((r) => r.status === "eating") || [];
  const myRsvp = getMyRSVP();

  return (
    <div className="flex-1 px-4 py-6 overflow-y-auto no-scrollbar pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <span className="text-[10px] text-primary uppercase font-bold tracking-widest">Dinner Call</span>
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            <Utensils className="w-6 h-6 text-primary" /> Cook's Corner
          </h2>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs text-center">
          {error}
        </div>
      )}

      {/* Date Switcher */}
      <div className="flex items-center justify-between bg-white/[0.02] border border-white/5 rounded-xl p-2 mb-6">
        <button
          onClick={() => adjustDate(-1)}
          className="p-2 rounded-lg text-muted-foreground hover:text-white hover:bg-white/5 active:scale-95 transition-all"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 text-xs font-bold text-white">
          <Calendar className="w-4 h-4 text-primary" />
          <span>
            {selectedDate === new Date().toLocaleDateString("en-CA") ? "Today, " : ""}
            {new Date(selectedDate).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
          </span>
        </div>
        <button
          onClick={() => adjustDate(1)}
          className="p-2 rounded-lg text-muted-foreground hover:text-white hover:bg-white/5 active:scale-95 transition-all"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Main Meal details or Announce menu */}
      {!meal || meal.status === "cancelled" ? (
        <div className="space-y-6">
          {/* Announce form */}
          {hasCookingCapability ? (
            <div className="glass rounded-2xl p-4 border border-white/5">
              <div className="flex items-center gap-2 text-sm font-bold text-white mb-3">
                <Sparkles className="w-4 h-4 text-primary" />
                <span>You are the Cook! Announce Menu:</span>
              </div>
              <form onSubmit={handleAnnounceMeal} className="space-y-4">
                <textarea
                  required
                  value={mealDescInput}
                  onChange={(e) => setMealDescInput(e.target.value)}
                  placeholder="e.g. Chicken Biryani with Raita, paneer butter masala & roti..."
                  className="w-full px-4 py-3 rounded-xl glass-input text-white text-xs outline-none resize-none h-20"
                />
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="w-full py-3 rounded-xl bg-primary text-white font-bold text-xs shadow-lg shadow-primary/20 hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" /> Announce Meal
                </button>
              </form>
            </div>
          ) : (
            <div className="glass rounded-xl p-8 text-center border border-white/5">
              <Utensils className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-xs text-muted-foreground">No meals announced for today yet.</p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">Contact your flat cooks to post what they are making!</p>
            </div>
          )}

          {meal?.status === "cancelled" && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs text-center flex items-center justify-center gap-1.5">
              <Ban className="w-4 h-4" /> Today's meal announcement has been cancelled by the cook.
            </div>
          )}
        </div>
      ) : (
        /* Meal is announced */
        <div className="space-y-6">
          <div className={`glass rounded-2xl p-5 border ${
            meal.status === "completed" ? "border-green-500/20 bg-green-500/[0.005]" : "border-white/10"
          }`}>
            <div className="flex justify-between items-start gap-4 mb-4">
              <div>
                <span className="text-[9px] bg-primary/20 text-primary border border-primary/30 px-2 py-0.5 rounded-full font-bold uppercase">
                  Cook: {meal.cookId.name}
                </span>
                <p className="text-sm font-bold text-white mt-2 leading-relaxed">{meal.mealDescription}</p>
              </div>
              <div className="bg-white/5 border border-white/5 rounded-xl p-2.5 text-center min-w-[64px]">
                <span className="block text-lg font-black text-white">{meal.portionCount}</span>
                <span className="text-[8px] text-muted-foreground uppercase font-black">Portions</span>
              </div>
            </div>

            {meal.status === "active" && (
              <div className="border-t border-white/5 pt-4">
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wide mb-3 text-center">Will you eat today?</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleRSVP("skipping")}
                    className={`flex-1 py-2.5 rounded-xl border font-bold text-xs flex items-center justify-center gap-1 active:scale-95 transition-all ${
                      myRsvp === "skipping"
                        ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                        : "bg-white/5 border-white/10 text-white hover:bg-white/10"
                    }`}
                  >
                    <X className="w-3.5 h-3.5" /> Skipping
                  </button>
                  <button
                    onClick={() => handleRSVP("eating")}
                    className={`flex-1 py-2.5 rounded-xl border font-bold text-xs flex items-center justify-center gap-1 active:scale-95 transition-all ${
                      myRsvp === "eating"
                        ? "bg-green-500/20 border-green-500 text-white shadow shadow-green-500/10"
                        : "bg-white/5 border-white/10 text-white hover:bg-white/10"
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" /> Eating
                  </button>
                </div>
              </div>
            )}

            {meal.status === "completed" && (
              <div className="border-t border-white/5 pt-3 mt-3 flex items-center justify-center gap-1.5 text-xs text-green-400 font-bold bg-green-500/5 p-2 rounded-xl">
                <Award className="w-4 h-4" /> This meal is completed. Cook points distributed!
              </div>
            )}
          </div>

          {/* Active RSVPs list */}
          <div className="glass rounded-2xl p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">📋 RSVPs</h3>
            {meal.rsvps.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-2">No responses yet.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {meal.rsvps.map((rsvp) => (
                  <div key={rsvp.userId._id} className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.01] border border-white/5">
                    <div className={`w-2 h-2 rounded-full ${rsvp.status === "eating" ? "bg-green-500" : "bg-rose-500"}`} />
                    <span className="text-xs text-white/90 truncate flex-1">{rsvp.userId.name}</span>
                    <span className={`text-[8px] font-bold ${rsvp.status === "eating" ? "text-green-400" : "text-rose-400"}`}>
                      {rsvp.status === "eating" ? "Eating" : "Skipping"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cook settings */}
          {isMealCook && meal.status === "active" && (
            <div className="glass rounded-2xl p-4 border border-rose-500/10 bg-rose-500/[0.005]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Cook Operations</h3>
              <div className="flex gap-3">
                <button
                  onClick={handleCancelMeal}
                  disabled={meal.portionCount > 0}
                  className="flex-1 py-2.5 rounded-xl border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 text-rose-400 text-xs font-bold active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                  title={meal.portionCount > 0 ? "You cannot cancel while people are eating!" : ""}
                >
                  <Ban className="w-3.5 h-3.5" /> Cancel Menu
                </button>
                <button
                  onClick={() => {
                    setNoShows([]);
                    setShowCompleteModal(true);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-white text-xs font-bold active:scale-95 transition-all flex items-center justify-center gap-1 shadow-md shadow-green-500/10"
                >
                  <UserCheck className="w-3.5 h-3.5" /> Serve & Finish
                </button>
              </div>
              {meal.portionCount > 0 && (
                <p className="text-[10px] text-muted-foreground text-center mt-2.5">
                  Note: You cannot cancel because {meal.portionCount} flatmates are RSVP'd to eat.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* MODAL: Complete Meal & No-Show selector */}
      {showCompleteModal && meal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="glass w-full max-w-sm rounded-2xl p-6 border border-white/10 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-lg font-bold text-white mb-2">Mark Dinner Served</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Select anyone who RSVP'd "Eating" but didn't show up. They will receive a small penalty (-2 points).
            </p>

            <form onSubmit={handleCompleteMealSubmit} className="space-y-4">
              {activeEaters.length === 0 ? (
                <p className="text-xs text-muted-foreground italic text-center py-2">Nobody RSVP'd "Eating" today.</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1 no-scrollbar">
                  {activeEaters.map((rsvp) => {
                    const isNoShow = noShows.includes(rsvp.userId._id);
                    return (
                      <button
                        type="button"
                        key={rsvp.userId._id}
                        onClick={() => toggleNoShow(rsvp.userId._id)}
                        className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-xs text-left transition-all ${
                          isNoShow
                            ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                            : "bg-green-500/10 border-green-500/30 text-green-400"
                        }`}
                      >
                        <span>{rsvp.userId.name}</span>
                        <span className="font-bold">
                          {isNoShow ? "❌ No Show (Penalty)" : "✔️ Showed Up"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCompleteModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-white font-semibold text-xs active:scale-95 transition-all text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-white font-bold text-xs active:scale-95 transition-all text-center disabled:opacity-50"
                >
                  Complete Meal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
