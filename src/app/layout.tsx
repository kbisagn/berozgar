import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { PwaRegister } from "@/components/providers/PwaRegister";
import BottomNav from "@/components/layout/BottomNav";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "FlatMate (berozgar) — Share Smartly",
  description: "A premium mobile-first application to manage flat chores, split expenses, cook meals, track items, and chat in real-time.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "FlatMate",
  },
};

export const viewport: Viewport = {
  themeColor: "#8b5cf6",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} bg-[#030303] text-foreground min-h-screen flex justify-center font-sans antialiased`}>
        <div className="w-full max-w-md bg-[#08080c] min-h-screen flex flex-col shadow-2xl relative border-x border-white/5 pb-20">
          <SessionProvider>
            <PwaRegister />
            {children}
            <BottomNav />
          </SessionProvider>
        </div>
      </body>
    </html>
  );
}
