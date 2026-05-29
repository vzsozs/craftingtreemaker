import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Crafting Tree Maker",
  description:
    "Plan complex Minecraft modpack crafting chains with batch calculations, catalyst tracking, and exportable shopping lists.",
  keywords: ["Minecraft", "modpack", "crafting", "GregTech", "factory planner"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        style={{ background: "#1a1a1a", color: "#e5e5e5" }}
      >
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
