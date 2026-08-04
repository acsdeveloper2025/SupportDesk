import "./globals.css";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SupportDesk",
  description: "Enterprise Ticketing Platform",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
