"use client";

import { useState, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Shield, Sparkles, User, Mail, Lock, Plus, Link as LinkIcon, Check } from "lucide-react";

const CAPABILITIES = [
  { id: "cooking", label: "🍳 Cooking" },
  { id: "cleaning", label: "🧹 Cleaning" },
  { id: "laundry", label: "🧺 Laundry" },
  { id: "grocery runs", label: "🛒 Grocery Runs" },
  { id: "trash", label: "🗑 Trash Duty" },
];

export default function LoginPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Tabs: 'login' | 'register'
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  
  // Registration / Login Inputs
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Onboarding state
  const [onboardStep, setOnboardStep] = useState<"choose" | "create" | "join">("choose");
  const [flatName, setFlatName] = useState("");
  const [inviteCodeInput, setInviteCodeInput] = useState("");
  const [selectedCapabilities, setSelectedCapabilities] = useState<string[]>([]);
  const [onboardingName, setOnboardingName] = useState("");

  // Pre-fill invite code if present in query parameters (e.g. from /join/[code])
  useEffect(() => {
    const invite = searchParams.get("invite");
    if (invite) {
      setInviteCodeInput(invite);
      setActiveTab("register");
      setOnboardStep("join");
    }
  }, [searchParams]);

  // Redirect to dashboard if logged in and flat associated
  useEffect(() => {
    if (status === "authenticated" && (session?.user as any)?.flatId) {
      router.push("/");
    }
  }, [status, session, router]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (activeTab === "register") {
      try {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Signup failed");
        
        // Auto login on signup
        const loginRes = await signIn("credentials", {
          email,
          password,
          redirect: false,
        });

        if (loginRes?.error) {
          throw new Error(loginRes.error);
        }
        
        setOnboardingName(name);
        // ✅ Reset loading so onboarding form is interactive
        setLoading(false);
      } catch (err: any) {
        setError(err.message);
        setLoading(false);
      }
    } else {
      try {
        const res = await signIn("credentials", {
          email,
          password,
          redirect: false,
        });

        if (res?.error) {
          throw new Error(res.error);
        }

        // Wait a small moment to let NextAuth refresh session
        router.refresh();
      } catch (err: any) {
        setError(err.message || "Invalid credentials");
        setLoading(false);
      }
    }
  };

  const handleCreateFlat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!flatName) return;
    setError("");
    setLoading(true);

    try {
      // Small delay to ensure NextAuth session cookie is fully committed before server reads it
      await new Promise((resolve) => setTimeout(resolve, 400));

      const res = await fetch("/api/flat/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: flatName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create flat");

      // Update name and capabilities
      await fetch("/api/user/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: onboardingName || name || session?.user?.name, capabilities: selectedCapabilities }),
      });

      await update(); // refresh NextAuth session with new flatId & role
      router.push("/");
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleJoinFlat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCodeInput) return;
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/flat/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inviteCode: inviteCodeInput,
          capabilities: selectedCapabilities,
          name: onboardingName || name || session?.user?.name,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to join flat");

      await update(); // update NextAuth session client state
      router.push("/");
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const toggleCapability = (id: string) => {
    setSelectedCapabilities((prev) =>
      prev.includes(id) ? prev.filter((cap) => cap !== id) : [...prev, id]
    );
  };

  // If user is authenticated but has no flatId, show Onboarding options
  if (status === "authenticated" && !(session?.user as any)?.flatId) {
    return (
      <div className="min-h-screen w-full flex flex-col justify-center px-6 py-12 relative overflow-hidden bg-[#030303]">
        {/* Decorative background glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full bg-primary/10 blur-[80px]" />
        
        <div className="w-full max-w-sm mx-auto z-10">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-black tracking-tight text-white flex items-center justify-center gap-2">
              <Sparkles className="w-8 h-8 text-primary fill-primary/20" />
              FlatMate
            </h1>
            <p className="text-muted-foreground text-xs mt-2">Let's set up your shared living space</p>
          </div>

          <div className="glass rounded-2xl p-6 shadow-xl border border-white/10">
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs text-center">
                {error}
              </div>
            )}

            {onboardStep === "choose" && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-white/90 text-center mb-4">Choose your path:</h3>
                
                <button
                  onClick={() => setOnboardStep("create")}
                  className="w-full flex items-center justify-between p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] active:scale-95 transition-all text-left group"
                >
                  <div>
                    <h4 className="font-bold text-white text-sm group-hover:text-primary transition-colors">Start a New Flat</h4>
                    <p className="text-xs text-muted-foreground mt-1">Initialize rules, chores, and invite friends.</p>
                  </div>
                  <Plus className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </button>

                <button
                  onClick={() => setOnboardStep("join")}
                  className="w-full flex items-center justify-between p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] active:scale-95 transition-all text-left group"
                >
                  <div>
                    <h4 className="font-bold text-white text-sm group-hover:text-primary transition-colors">Join Existing Flat</h4>
                    <p className="text-xs text-muted-foreground mt-1">Use an invite link or code shared by flatmate.</p>
                  </div>
                  <LinkIcon className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </button>
              </div>
            )}

            {(onboardStep === "create" || onboardStep === "join") && (
              <form onSubmit={onboardStep === "create" ? handleCreateFlat : handleJoinFlat} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Your Name
                  </label>
                  <input
                    type="text"
                    value={onboardingName}
                    onChange={(e) => setOnboardingName(e.target.value)}
                    placeholder="Enter your name"
                    required
                    className="w-full px-4 py-3 rounded-xl glass-input text-white text-sm outline-none"
                  />
                </div>

                {onboardStep === "create" ? (
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Flat Name
                    </label>
                    <input
                      type="text"
                      value={flatName}
                      onChange={(e) => setFlatName(e.target.value)}
                      placeholder="e.g. Baker Street 221B"
                      required
                      className="w-full px-4 py-3 rounded-xl glass-input text-white text-sm outline-none"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Invite Code
                    </label>
                    <input
                      type="text"
                      value={inviteCodeInput}
                      onChange={(e) => setInviteCodeInput(e.target.value)}
                      placeholder="e.g. c8ef432d"
                      required
                      className="w-full px-4 py-3 rounded-xl glass-input text-white text-sm outline-none"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    My Capabilities
                  </label>
                  <p className="text-[10px] text-muted-foreground mb-3">Which tasks are you capable of doing?</p>
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

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setError("");
                      setOnboardStep("choose");
                    }}
                    className="flex-1 py-3 px-4 rounded-xl border border-white/10 text-white font-semibold text-sm hover:bg-white/5 active:scale-95 transition-all text-center"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-2 py-3 px-6 rounded-xl bg-primary text-white font-bold text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50 text-center"
                  >
                    {loading ? "Processing..." : onboardStep === "create" ? "Create Flat" : "Join Flat"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Login & Register screens
  return (
    <div className="min-h-screen w-full flex flex-col justify-center px-6 py-12 relative overflow-hidden bg-[#030303]">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full bg-primary/10 blur-[80px]" />
      
      <div className="w-full max-w-sm mx-auto z-10">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black tracking-tight text-white flex items-center justify-center gap-2">
            <Shield className="w-8 h-8 text-primary fill-primary/20" />
            FlatMate
          </h1>
          <p className="text-muted-foreground text-xs mt-2">Shared living, managed intelligently.</p>
        </div>

        {/* Tab buttons */}
        <div className="flex bg-white/[0.02] border border-white/5 p-1 rounded-xl mb-6">
          <button
            onClick={() => {
              setError("");
              setActiveTab("login");
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === "login" ? "bg-white/[0.08] text-white" : "text-muted-foreground hover:text-white"
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => {
              setError("");
              setActiveTab("register");
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === "register" ? "bg-white/[0.08] text-white" : "text-muted-foreground hover:text-white"
            }`}
          >
            Register
          </button>
        </div>

        <div className="glass rounded-2xl p-6 shadow-xl border border-white/10">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            {activeTab === "register" && (
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3.5 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    required
                    className="w-full pl-10 pr-4 py-3 rounded-xl glass-input text-white text-sm outline-none"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-xl glass-input text-white text-sm outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-muted-foreground" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-xl glass-input text-white text-sm outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-xl bg-primary text-white font-bold text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50 mt-2"
            >
              {loading ? "Authenticating..." : activeTab === "login" ? "Sign In" : "Create Account"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
