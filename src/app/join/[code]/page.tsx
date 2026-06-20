"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Sparkles, Check, Home } from "lucide-react";

const CAPABILITIES = [
  { id: "cooking", label: "🍳 Cooking" },
  { id: "cleaning", label: "🧹 Cleaning" },
  { id: "laundry", label: "🧺 Laundry" },
  { id: "grocery runs", label: "🛒 Grocery Runs" },
  { id: "trash", label: "🗑 Trash Duty" },
];

export default function JoinFlatPage({ params }: { params: { code: string } }) {
  const { code } = params;
  const { data: session, status, update } = useSession();
  const router = useRouter();

  const [flatName, setFlatName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);

  const [selectedCapabilities, setSelectedCapabilities] = useState<string[]>([]);
  const [displayName, setDisplayName] = useState("");

  // Step 1: Validate invite code
  useEffect(() => {
    async function checkInvite() {
      try {
        const res = await fetch(`/api/flat/invite-info?code=${code}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Invalid invite link");
        }
        setFlatName(data.flatName);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    if (code) {
      checkInvite();
    }
  }, [code]);

  // Step 2: Handle redirect if not logged in
  useEffect(() => {
    if (status === "unauthenticated" && !loading && !error) {
      router.push(`/login?invite=${code}`);
    }
  }, [status, loading, error, code, router]);

  // Initialize display name from session if available
  useEffect(() => {
    if (session?.user?.name) {
      setDisplayName(session.user.name);
    }
  }, [session]);

  const toggleCapability = (id: string) => {
    setSelectedCapabilities((prev) =>
      prev.includes(id) ? prev.filter((cap) => cap !== id) : [...prev, id]
    );
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setJoining(true);

    try {
      const res = await fetch("/api/flat/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inviteCode: code,
          capabilities: selectedCapabilities,
          name: displayName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to join flat");

      // Update session client cache
      await update();
      router.push("/");
    } catch (err: any) {
      setError(err.message);
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#030303]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground text-sm">Validating invite link...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center p-6 bg-[#030303]">
        <div className="glass rounded-2xl p-6 w-full max-w-sm border border-destructive/20 text-center">
          <div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-destructive font-bold">!</span>
          </div>
          <h2 className="text-white font-bold text-lg mb-2">Invite Error</h2>
          <p className="text-muted-foreground text-xs mb-6">{error}</p>
          <button
            onClick={() => router.push("/login")}
            className="w-full py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-semibold text-xs active:scale-95 transition-all"
          >
            Back to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col justify-center px-6 py-12 relative overflow-hidden bg-[#030303]">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full bg-primary/10 blur-[80px]" />

      <div className="w-full max-w-sm mx-auto z-10">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black tracking-tight text-white flex items-center justify-center gap-2">
            <Sparkles className="w-8 h-8 text-primary fill-primary/20" />
            FlatMate
          </h1>
          <p className="text-muted-foreground text-xs mt-2">You've been invited to join flatmates</p>
        </div>

        <div className="glass rounded-2xl p-6 shadow-xl border border-white/10">
          <div className="text-center mb-6">
            <div className="w-12 h-12 bg-primary/10 border border-primary/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <Home className="w-6 h-6 text-primary" />
            </div>
            <p className="text-xs text-muted-foreground">You are joining</p>
            <h3 className="text-xl font-bold text-white mt-1">{flatName}</h3>
          </div>

          <form onSubmit={handleJoin} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                My Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter your name"
                required
                className="w-full px-4 py-3 rounded-xl glass-input text-white text-sm outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                My Capabilities
              </label>
              <p className="text-[10px] text-muted-foreground mb-3">Select the tasks you can assist with:</p>
              <div className="grid grid-cols-2 gap-2">
                {CAPABILITIES.map((cap) => {
                  const isSelected = selectedCapabilities.includes(cap.id);
                  return (
                    <button
                      type="button"
                      key={cap.id}
                      onClick={() => toggleCapability(cap.id)}
                      className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs text-left transition-all ${
                        isSelected
                          ? "bg-primary/20 border-primary text-white"
                          : "bg-white/[0.01] border-white/5 text-muted-foreground hover:bg-white/[0.03]"
                      }`}
                    >
                      <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border ${
                        isSelected ? "bg-primary border-primary" : "border-white/20"
                      }`}>
                        {isSelected && <Check className="w-2.5 h-2.5 text-white stroke-[3px]" />}
                      </div>
                      {cap.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              disabled={joining}
              className="w-full py-3.5 px-4 rounded-xl bg-primary text-white font-bold text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50 mt-2"
            >
              {joining ? "Joining Flat..." : "Accept Invite & Join"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
