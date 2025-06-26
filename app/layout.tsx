import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Warranty Watcher",
  description: "A warranty information management system that bridges the gap between IT management platforms and manufacturer warranty databases.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}