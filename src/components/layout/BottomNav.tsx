"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ClipboardList, Utensils, IndianRupee, MessageSquare } from "lucide-react";
import { useSession } from "next-auth/react";

export default function BottomNav() {
  const pathname = usePathname();
  const { data: session } = useSession();

  // Hide BottomNav on onboarding or login pages where user is not logged in or doesn't have a flat yet
  if (!session || !session.user || !(session.user as any).flatId) {
    if (pathname === "/login" || pathname?.startsWith("/join")) {
      return null;
    }
  }

  const tabs = [
    { name: "Home", href: "/", icon: Home },
    { name: "Chores", href: "/chores", icon: ClipboardList },
    { name: "Meals", href: "/meals", icon: Utensils },
    { name: "Bills", href: "/bills", icon: IndianRupee },
    { name: "Chat", href: "/chat", icon: MessageSquare },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-md bg-[#0b0c10]/90 backdrop-blur-lg border-t border-white/10 px-4 py-2 flex justify-around items-center">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = pathname === tab.href;

        return (
          <Link
            key={tab.name}
            href={tab.href}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all-200 duration-200 active:scale-95 ${
              isActive
                ? "text-primary bg-primary/10 font-semibold"
                : "text-muted-foreground hover:text-white"
            }`}
          >
            <Icon className={`w-5 h-5 ${isActive ? "stroke-[2.5px]" : "stroke-[2px]"}`} />
            <span className="text-[10px] mt-1 select-none">{tab.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}
