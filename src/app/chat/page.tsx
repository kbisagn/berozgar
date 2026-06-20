"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { 
  Send, Megaphone, Trash2, Pin, MessageSquare, AlertCircle, 
  Sparkles, AtSign, ChevronUp, ChevronDown, X
} from "lucide-react";
import { getPusherClient } from "@/lib/pusher-client";

interface MessageType {
  _id: string;
  content: string;
  senderId: { _id: string; name: string; role: string };
  isAnnouncement: boolean;
  pinned: boolean;
  createdAt: string;
}

interface Flatmate {
  _id: string;
  name: string;
}

export default function ChatPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [messages, setMessages] = useState<MessageType[]>([]);
  const [flatmates, setFlatmates] = useState<Flatmate[]>([]);
  const [input, setInput] = useState("");
  const [isAnnouncement, setIsAnnouncement] = useState(false);
  const [showMentionGrid, setShowMentionGrid] = useState(false);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/chat");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load chat history");
      setMessages(data.messages);

      // Fetch flatmates for mentions
      const fmRes = await fetch("/api/dashboard/sync");
      const fmData = await fmRes.json();
      if (fmRes.ok) {
        setFlatmates(fmData.flatmates);
      }
    } catch (err: any) {
      setError(err.message || "Failed to sync chat");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated" && (session?.user as any)?.flatId) {
      fetchData();

      // Poll every 5s in case Pusher fails
      const interval = setInterval(() => fetchData(true), 5000);

      const pusher = getPusherClient();
      const flatId = (session.user as any).flatId;

      if (pusher && flatId) {
        const channelName = `flat-${flatId}`;
        const channel = pusher.subscribe(channelName);

        channel.bind("chat-message", (msg: MessageType) => {
          setMessages((prev) => {
            if (prev.some((m) => m._id === msg._id)) return prev;
            return [...prev, msg];
          });
        });

        channel.bind("chat-cleared", () => {
          setMessages([]);
        });

        channel.bind("chat-message-pinned", () => {
          fetchData(true);
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

  // Scroll to bottom whenever messages list updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    setActionLoading(true);
    setError("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: input, isAnnouncement }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send message");

      setInput("");
      setIsAnnouncement(false);
      fetchData(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleClearChat = async () => {
    if (!confirm("Are you sure you want to clear the entire chat history?")) return;
    setError("");
    try {
      const res = await fetch("/api/chat/clear", { method: "POST" });
      if (!res.ok) throw new Error("Failed to clear chat");
      setMessages([]);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleTogglePin = async (messageId: string, currentPinStatus: boolean) => {
    try {
      await fetch("/api/chat/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, pin: !currentPinStatus }),
      });
      fetchData(true);
    } catch (err) {
      console.error(err);
    }
  };

  const handleMentionClick = (name: string) => {
    setInput((prev) => prev + `@${name} `);
    setShowMentionGrid(false);
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#030303]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground text-sm">Entering flat chat...</p>
        </div>
      </div>
    );
  }

  const userId = (session?.user as any)?.id;
  const isAdmin = (session?.user as any)?.role === "admin";
  const pinnedMessages = messages.filter((m) => m.pinned);

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-64px)] pb-16 overflow-hidden bg-[#030303]">
      {/* Header */}
      <div className="px-4 py-3 bg-white/[0.01] border-b border-white/5 flex items-center justify-between min-h-[56px] shrink-0">
        <div>
          <span className="text-[9px] text-primary uppercase font-bold tracking-widest">Real-time room</span>
          <h2 className="text-base font-black text-white flex items-center gap-1.5">
            <MessageSquare className="w-4 h-4 text-primary" /> Flat Talk
          </h2>
        </div>
        {isAdmin && (
          <button
            onClick={handleClearChat}
            className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/25 active:scale-95 transition-all text-xs flex items-center gap-1"
            title="Clear Chat History"
          >
            <Trash2 className="w-3.5 h-3.5" /> Clear
          </button>
        )}
      </div>

      {error && (
        <div className="p-2.5 bg-destructive/10 border-b border-destructive/20 text-destructive text-[10px] text-center shrink-0">
          {error}
        </div>
      )}

      {/* Pinned / Announcements Tray */}
      {pinnedMessages.length > 0 && (
        <div className="px-4 py-2 bg-primary/[0.02] border-b border-primary/10 shrink-0 max-h-24 overflow-y-auto no-scrollbar">
          <div className="flex items-center gap-1.5 text-[9px] text-primary uppercase font-black tracking-wider mb-1">
            <Pin className="w-3 h-3 rotate-45" /> Pinned Announcements
          </div>
          <div className="space-y-1">
            {pinnedMessages.map((pin) => (
              <div key={pin._id} className="flex justify-between items-start gap-3 bg-white/[0.02] p-1.5 rounded-lg border border-white/5">
                <p className="text-[10px] text-white/95 leading-relaxed truncate flex-1">
                  <strong>{pin.senderId.name}:</strong> {pin.content}
                </p>
                <button
                  onClick={() => handleTogglePin(pin._id, pin.pinned)}
                  className="text-muted-foreground hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4">
        <p className="text-center text-[10px] text-muted-foreground italic py-2">
          ⏰ Conversation history auto-deletes after 24 hours.
        </p>

        {messages.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-xs">
            💬 No active conversation. Say hello to your flatmates!
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId._id === userId;
            return (
              <div 
                key={msg._id} 
                className={`flex flex-col max-w-[80%] ${
                  isMe ? "ml-auto items-end" : "mr-auto items-start"
                }`}
              >
                {/* Sender name label */}
                <span className="text-[9px] text-muted-foreground mb-1 px-1 flex items-center gap-1">
                  {msg.senderId.name} 
                  {msg.senderId.role === "admin" && (
                    <span className="text-[7.5px] bg-primary/20 text-primary border border-primary/30 px-1 rounded-sm uppercase font-bold">Admin</span>
                  )}
                </span>

                {/* Message Bubble */}
                <div 
                  className={`px-3 py-2 rounded-2xl text-xs relative group ${
                    msg.isAnnouncement
                      ? "bg-amber-500/10 border border-amber-500/25 text-amber-100 rounded-tl-none"
                      : isMe
                        ? "bg-primary text-white rounded-tr-none"
                        : "bg-white/[0.03] border border-white/5 text-white/95 rounded-tl-none"
                  }`}
                >
                  <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  
                  {/* Pin option */}
                  <button
                    onClick={() => handleTogglePin(msg._id, msg.pinned)}
                    className="absolute top-1/2 -translate-y-1/2 hidden group-hover:block bg-black/80 border border-white/10 p-1 rounded-lg text-muted-foreground hover:text-white transition-all z-10"
                    style={{ left: isMe ? "-28px" : "auto", right: !isMe ? "-28px" : "auto" }}
                    title={msg.pinned ? "Unpin Message" : "Pin Message"}
                  >
                    <Pin className={`w-3 h-3 ${msg.pinned ? "text-primary" : "rotate-45"}`} />
                  </button>
                </div>

                <span className="text-[8px] text-muted-foreground/60 mt-1 px-1">
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input container */}
      <div className="p-3 bg-white/[0.01] border-t border-white/5 shrink-0 relative">
        {/* Quick Roommate Mention Grid */}
        {showMentionGrid && (
          <div className="absolute bottom-full left-3 right-3 bg-[#0d0d0f] border border-white/15 rounded-xl p-2.5 mb-2.5 max-h-32 overflow-y-auto no-scrollbar shadow-xl shadow-black animate-in slide-in-from-bottom-2 duration-150">
            <p className="text-[9px] text-muted-foreground uppercase font-black mb-1.5">Mention roommate:</p>
            <div className="grid grid-cols-3 gap-1.5">
              {flatmates
                .filter((f) => f._id !== userId)
                .map((f) => (
                  <button
                    type="button"
                    key={f._id}
                    onClick={() => handleMentionClick(f.name)}
                    className="py-1 px-2 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 text-[10px] text-white truncate text-center active:scale-95 transition-all"
                  >
                    @{f.name}
                  </button>
                ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSendMessage} className="space-y-2">
          <div className="flex gap-2">
            {/* Mention trigger button */}
            <button
              type="button"
              onClick={() => setShowMentionGrid(!showMentionGrid)}
              className={`p-2.5 rounded-xl border text-muted-foreground active:scale-95 transition-all ${
                showMentionGrid ? "bg-primary/20 border-primary text-primary" : "bg-white/5 border-white/10 hover:bg-white/10"
              }`}
            >
              <AtSign className="w-4 h-4" />
            </button>

            <input
              type="text"
              required
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Send message..."
              className="flex-1 px-4 py-2.5 rounded-xl glass-input text-white text-xs outline-none"
            />
            
            <button
              type="submit"
              disabled={actionLoading}
              className="p-2.5 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>

          {/* Admin toggle announcement */}
          {isAdmin && (
            <div className="flex items-center gap-2 px-1">
              <input
                type="checkbox"
                id="isAnnCheckbox"
                checked={isAnnouncement}
                onChange={(e) => setIsAnnouncement(e.target.checked)}
                className="w-3.5 h-3.5 rounded bg-white/5 border-white/10 text-primary focus:ring-0 focus:ring-offset-0"
              />
              <label htmlFor="isAnnCheckbox" className="text-[10px] text-muted-foreground flex items-center gap-1 cursor-pointer font-medium select-none">
                <Megaphone className="w-3 h-3 text-amber-400" />
                Make announcement & pin to top
              </label>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
