import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Line Haul Voice Lookup",
  description: "Say a lane, get a rate.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-page text-textPrimary">{children}</body>
    </html>
  );
}
