import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Slots — Unlimited Website Platform",
    template: "%s",
  },
  description:
    "One control deck for an unlimited number of independently owned websites — build each in its own slot, extract any into a standalone project.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#0b0b0d] font-sans text-stone-200 antialiased">
        {children}
      </body>
    </html>
  );
}
