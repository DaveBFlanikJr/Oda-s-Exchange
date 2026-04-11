import "./globals.css";
import type { Metadata } from "next";

import { QueryProvider } from "@/components/providers/query-provider";

export const metadata: Metadata = {
  title: "OPTCG Japan Tracker",
  description: "Tokyo secondary market tracker for One Piece Card Game prices in JPY."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
